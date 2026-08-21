/**
 * Covers the hand-written facade in src/derivatives-trading-coin-futures.ts: which transports get
 * constructed, the production URL defaults, and User-Agent injection.
 */

import { platform, arch } from 'os';
import { expect, describe, it } from '@jest/globals';
import {
    ConfigurationRestAPI,
    DERIVATIVES_TRADING_COIN_FUTURES_REST_API_PROD_URL,
    DERIVATIVES_TRADING_COIN_FUTURES_WS_API_PROD_URL,
    DERIVATIVES_TRADING_COIN_FUTURES_WS_STREAMS_PROD_URL,
} from '@binance/common';
import { name, version } from '../../package.json';
import {
    DerivativesTradingCoinFutures,
    type ConfigurationDerivativesTradingCoinFutures,
} from '../../src/derivatives-trading-coin-futures';

/** The exact header value the server sees. */
const userAgent = `${name}/${version} (Node.js/${process.version}; ${platform()}; ${arch()})`;

/** The transports keep their config private; tests assert on what the facade stored. */
const configOf = (transport: unknown) =>
    (transport as { configuration: Record<string, unknown> }).configuration;

const headersOf = (transport: unknown) =>
    (configOf(transport).baseOptions as { headers: Record<string, string> }).headers;

describe('DerivativesTradingCoinFutures', () => {
    describe('REST API transport', () => {
        it('should not be constructed when no REST configuration is supplied', () => {
            const client = new DerivativesTradingCoinFutures(
                {} as ConfigurationDerivativesTradingCoinFutures
            );

            expect(client.restAPI).toBeUndefined();
        });

        it('should default basePath to the production REST URL', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationRestAPI: { apiKey: 'test-api-key' },
            });

            expect(client.restAPI).toBeDefined();
            expect(configOf(client.restAPI).basePath).toBe(
                DERIVATIVES_TRADING_COIN_FUTURES_REST_API_PROD_URL
            );
        });

        it('should keep an explicitly supplied basePath', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationRestAPI: {
                    apiKey: 'test-api-key',
                    basePath: 'https://example.invalid',
                },
            });

            expect(configOf(client.restAPI).basePath).toBe('https://example.invalid');
        });

        it('should inject the User-Agent header', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationRestAPI: { apiKey: 'test-api-key' },
            });

            expect(headersOf(client.restAPI)['User-Agent']).toBe(userAgent);
        });

        it('should keep the API key header alongside the User-Agent', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationRestAPI: { apiKey: 'test-api-key' },
            });

            expect(headersOf(client.restAPI)['X-MBX-APIKEY']).toBe('test-api-key');
            expect(headersOf(client.restAPI)['Content-Type']).toBe('application/json');
        });

        it('should preserve custom headers the caller supplied', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationRestAPI: {
                    apiKey: 'test-api-key',
                    customHeaders: { 'X-Trace-Id': 'abc-123' },
                },
            });

            expect(headersOf(client.restAPI)['X-Trace-Id']).toBe('abc-123');
            expect(headersOf(client.restAPI)['User-Agent']).toBe(userAgent);
        });
    });

    describe('a pre-built ConfigurationRestAPI instance', () => {
        // The facade always re-runs new ConfigurationRestAPI(config.configurationRestAPI).
        // ConfigurationRestAPI keeps timeout, proxy, customHeaders and httpsAgent only inside
        // baseOptions, never as own properties, so re-constructing from an instance silently
        // resets them. Documented usage passes an object literal, which is unaffected.
        it('should reset the timeout to the default', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationRestAPI: new ConfigurationRestAPI({
                    apiKey: 'test-api-key',
                    timeout: 30000,
                }),
            });

            const baseOptions = configOf(client.restAPI).baseOptions as { timeout: number };
            expect(baseOptions.timeout).toBe(1000);
        });

        it('should drop the proxy', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationRestAPI: new ConfigurationRestAPI({
                    apiKey: 'test-api-key',
                    proxy: { host: '127.0.0.1', port: 8080 },
                }),
            });

            const baseOptions = configOf(client.restAPI).baseOptions as { proxy?: unknown };
            expect(baseOptions.proxy).toBeUndefined();
        });

        it('should drop custom headers', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationRestAPI: new ConfigurationRestAPI({
                    apiKey: 'test-api-key',
                    customHeaders: { 'X-Trace-Id': 'abc-123' },
                }),
            });

            expect(headersOf(client.restAPI)['X-Trace-Id']).toBeUndefined();
        });

        it('should still carry the credentials and apply the URL default', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationRestAPI: new ConfigurationRestAPI({ apiKey: 'test-api-key' }),
            });

            expect(headersOf(client.restAPI)['X-MBX-APIKEY']).toBe('test-api-key');
            expect(configOf(client.restAPI).basePath).toBe(
                DERIVATIVES_TRADING_COIN_FUTURES_REST_API_PROD_URL
            );
        });
    });

    describe('WebSocket API transport', () => {
        it('should not be constructed when no WebSocket API configuration is supplied', () => {
            const client = new DerivativesTradingCoinFutures(
                {} as ConfigurationDerivativesTradingCoinFutures
            );

            expect(client.websocketAPI).toBeUndefined();
        });

        it('should default wsURL to the production URL', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationWebsocketAPI: { apiKey: 'test-api-key' },
            });

            expect(client.websocketAPI).toBeDefined();
            expect(configOf(client.websocketAPI).wsURL).toBe(
                DERIVATIVES_TRADING_COIN_FUTURES_WS_API_PROD_URL
            );
        });

        it('should keep an explicitly supplied wsURL', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationWebsocketAPI: {
                    ...{ apiKey: 'test-api-key' },
                    wsURL: 'ws://localhost:3000',
                },
            });

            expect(configOf(client.websocketAPI).wsURL).toBe('ws://localhost:3000');
        });

        it('should stamp the user agent onto the configuration', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationWebsocketAPI: { apiKey: 'test-api-key' },
            });

            expect(configOf(client.websocketAPI).userAgent).toBe(userAgent);
        });
    });

    describe('WebSocket Streams transport', () => {
        it('should not be constructed when no WebSocket Streams configuration is supplied', () => {
            const client = new DerivativesTradingCoinFutures(
                {} as ConfigurationDerivativesTradingCoinFutures
            );

            expect(client.websocketStreams).toBeUndefined();
        });

        it('should default wsURL to the production URL', () => {
            const client = new DerivativesTradingCoinFutures({ configurationWebsocketStreams: {} });

            expect(client.websocketStreams).toBeDefined();
            expect(configOf(client.websocketStreams).wsURL).toBe(
                DERIVATIVES_TRADING_COIN_FUTURES_WS_STREAMS_PROD_URL
            );
        });

        it('should keep an explicitly supplied wsURL', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationWebsocketStreams: { ...{}, wsURL: 'ws://localhost:3000' },
            });

            expect(configOf(client.websocketStreams).wsURL).toBe('ws://localhost:3000');
        });

        it('should stamp the user agent onto the configuration', () => {
            const client = new DerivativesTradingCoinFutures({ configurationWebsocketStreams: {} });

            expect(configOf(client.websocketStreams).userAgent).toBe(userAgent);
        });
    });

    describe('construction', () => {
        it('should construct every configured transport together', () => {
            const client = new DerivativesTradingCoinFutures({
                configurationRestAPI: { apiKey: 'test-api-key' },
                configurationWebsocketAPI: { apiKey: 'test-api-key' },
                configurationWebsocketStreams: {},
            });

            expect(client.restAPI).toBeDefined();
            expect(client.websocketAPI).toBeDefined();
            expect(client.websocketStreams).toBeDefined();
        });

        it('should construct no transports for an empty configuration', () => {
            const client = new DerivativesTradingCoinFutures(
                {} as ConfigurationDerivativesTradingCoinFutures
            );

            expect(client.restAPI).toBeUndefined();
            expect(client.websocketAPI).toBeUndefined();
            expect(client.websocketStreams).toBeUndefined();
        });
    });
});
