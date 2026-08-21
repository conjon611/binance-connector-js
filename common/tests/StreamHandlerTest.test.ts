import { expect, beforeEach, afterEach, describe, it, jest } from '@jest/globals';
import {
    ConfigurationWebsocketAPI,
    ConfigurationWebsocketStreams,
    Logger,
    WebsocketAPIBase,
    WebsocketStreamsBase,
    createStreamHandler,
} from '../src';

jest.mock('ws');
jest.mock('../src/logger');

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('createStreamHandler()', () => {
    let mockLogger: jest.Mocked<Logger>;
    let streamsBase: WebsocketStreamsBase;
    let apiBase: WebsocketAPIBase;

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        } as unknown as jest.Mocked<Logger>;

        (Logger.getInstance as jest.MockedFunction<typeof Logger.getInstance>).mockReturnValue(
            mockLogger
        );

        streamsBase = new WebsocketStreamsBase(
            new ConfigurationWebsocketStreams({ wsURL: 'ws://localhost:3000' })
        );
        apiBase = new WebsocketAPIBase(
            new ConfigurationWebsocketAPI({ apiKey: 'test-api-key', wsURL: 'ws://localhost:3000' })
        );

        jest.spyOn(streamsBase, 'subscribe').mockImplementation(() => {});
        jest.spyOn(streamsBase, 'unsubscribe').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    describe('with a streams connection', () => {
        it('should subscribe to the stream on creation', () => {
            createStreamHandler(streamsBase, 'bnbusdt@trade');

            expect(streamsBase.subscribe).toHaveBeenCalledWith('bnbusdt@trade', undefined);
        });

        it('should pass the optional id through to subscribe', () => {
            createStreamHandler(streamsBase, 'bnbusdt@trade', 'req-1');

            expect(streamsBase.subscribe).toHaveBeenCalledWith('bnbusdt@trade', 'req-1');
        });

        it('should unsubscribe from the stream on teardown', () => {
            const handler = createStreamHandler(streamsBase, 'bnbusdt@trade', 'req-1');

            handler.unsubscribe();

            expect(streamsBase.unsubscribe).toHaveBeenCalledWith('bnbusdt@trade', 'req-1');
        });
    });

    describe('with a websocket API connection', () => {
        it('should not attempt to subscribe', () => {
            const subscribeSpy = jest.spyOn(
                WebsocketStreamsBase.prototype,
                'subscribe'
            ) as unknown as jest.SpiedFunction<() => void>;

            createStreamHandler(apiBase, 'userDataStream');

            expect(subscribeSpy).not.toHaveBeenCalled();
        });

        it('should still register and remove callbacks', () => {
            const handler = createStreamHandler(apiBase, 'userDataStream');
            handler.on('message', () => {});

            expect(apiBase.streamCallbackMap.get('userDataStream')?.size).toBe(1);

            handler.unsubscribe();

            expect(apiBase.streamCallbackMap.get('userDataStream')?.size).toBe(0);
        });
    });

    describe('on()', () => {
        it('should register a callback under the stream name', () => {
            const handler = createStreamHandler(streamsBase, 'bnbusdt@trade');

            handler.on('message', () => {});

            expect(streamsBase.streamCallbackMap.get('bnbusdt@trade')?.size).toBe(1);
        });

        it('should invoke the callback with the payload delivered to the stream', async () => {
            const received: unknown[] = [];
            const handler = createStreamHandler<{ p: string }>(streamsBase, 'bnbusdt@trade');
            handler.on('message', (data) => {
                received.push(data);
            });

            streamsBase.streamCallbackMap
                .get('bnbusdt@trade')
                ?.forEach((cb) => cb({ p: '600.00' }));
            await flush();

            expect(received).toEqual([{ p: '600.00' }]);
        });

        it('should keep callbacks from separate handlers on the same stream', () => {
            createStreamHandler(streamsBase, 'bnbusdt@trade').on('message', () => {});
            createStreamHandler(streamsBase, 'bnbusdt@trade').on('message', () => {});

            expect(streamsBase.streamCallbackMap.get('bnbusdt@trade')?.size).toBe(2);
        });

        it('should ignore events other than "message"', () => {
            const handler = createStreamHandler(streamsBase, 'bnbusdt@trade');

            handler.on('close' as 'message', () => {});

            expect(streamsBase.streamCallbackMap.get('bnbusdt@trade')).toBeUndefined();
        });

        // Known gap: the handler wraps the callback in `Promise.resolve(callback(data))`,
        // so a synchronous throw escapes before the promise exists and the `.catch()` that
        // logs 'Error in stream callback' never runs. Only async rejections are contained.
        it('should let a synchronous throw escape to the caller instead of logging it', () => {
            const handler = createStreamHandler(streamsBase, 'bnbusdt@trade');
            handler.on('message', () => {
                throw new Error('callback exploded');
            });

            expect(() =>
                streamsBase.streamCallbackMap.get('bnbusdt@trade')?.forEach((cb) => cb({}))
            ).toThrow('callback exploded');
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should log an error when an async callback rejects', async () => {
            const handler = createStreamHandler(streamsBase, 'bnbusdt@trade');
            handler.on('message', async () => {
                throw new Error('async explosion');
            });

            streamsBase.streamCallbackMap.get('bnbusdt@trade')?.forEach((cb) => cb({}));
            await flush();

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error in stream callback: Error: async explosion')
            );
        });

        // Consequence of the gap above: because the throw is not contained, iteration over the
        // callback set aborts and later subscribers on the same stream miss the payload.
        it('should stop delivering to later callbacks when an earlier one throws synchronously', () => {
            const seen: string[] = [];
            createStreamHandler(streamsBase, 'bnbusdt@trade').on('message', () => {
                throw new Error('boom');
            });
            createStreamHandler(streamsBase, 'bnbusdt@trade').on('message', () => {
                seen.push('second');
            });

            expect(() =>
                streamsBase.streamCallbackMap.get('bnbusdt@trade')?.forEach((cb) => cb({}))
            ).toThrow('boom');
            expect(seen).toEqual([]);
        });

        it('should keep delivering to later callbacks when an earlier one rejects async', async () => {
            const seen: string[] = [];
            createStreamHandler(streamsBase, 'bnbusdt@trade').on('message', async () => {
                throw new Error('boom');
            });
            createStreamHandler(streamsBase, 'bnbusdt@trade').on('message', () => {
                seen.push('second');
            });

            streamsBase.streamCallbackMap.get('bnbusdt@trade')?.forEach((cb) => cb({}));
            await flush();

            expect(seen).toEqual(['second']);
        });
    });

    describe('unsubscribe()', () => {
        it('should remove only its own callback from the stream', () => {
            const first = createStreamHandler(streamsBase, 'bnbusdt@trade');
            const second = createStreamHandler(streamsBase, 'bnbusdt@trade');
            first.on('message', () => {});
            second.on('message', () => {});

            first.unsubscribe();

            expect(streamsBase.streamCallbackMap.get('bnbusdt@trade')?.size).toBe(1);
        });

        it('should stop delivering payloads to the removed callback', async () => {
            const received: unknown[] = [];
            const handler = createStreamHandler(streamsBase, 'bnbusdt@trade');
            handler.on('message', (data) => {
                received.push(data);
            });

            handler.unsubscribe();
            streamsBase.streamCallbackMap.get('bnbusdt@trade')?.forEach((cb) => cb({}));
            await flush();

            expect(received).toEqual([]);
        });

        it('should be safe to call before any callback is registered', () => {
            const handler = createStreamHandler(streamsBase, 'bnbusdt@trade');

            expect(() => handler.unsubscribe()).not.toThrow();
            expect(streamsBase.unsubscribe).toHaveBeenCalledWith('bnbusdt@trade', undefined);
        });

        it('should be safe to call twice', () => {
            const handler = createStreamHandler(streamsBase, 'bnbusdt@trade');
            handler.on('message', () => {});

            handler.unsubscribe();

            expect(() => handler.unsubscribe()).not.toThrow();
        });
    });
});
