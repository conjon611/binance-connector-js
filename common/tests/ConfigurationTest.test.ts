import { expect, beforeEach, afterEach, describe, it, jest } from '@jest/globals';
import { Agent } from 'https';
import {
    ConfigurationRestAPI,
    ConfigurationWebsocketAPI,
    ConfigurationWebsocketStreams,
    TimeUnit,
} from '../src';

describe('ConfigurationRestAPI', () => {
    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('defaults', () => {
        it('should apply every documented default when only an apiKey is given', () => {
            const config = new ConfigurationRestAPI({ apiKey: 'test-api-key' });

            expect(config.keepAlive).toBe(true);
            expect(config.compression).toBe(true);
            expect(config.retries).toBe(3);
            expect(config.backoff).toBe(1000);
            expect(config.baseOptions?.timeout).toBe(1000);
            expect(config.baseOptions?.httpsAgent).toBe(false);
        });

        it('should construct with an empty apiKey when no argument is passed', () => {
            const config = new ConfigurationRestAPI();

            expect(config.apiKey).toBe('');
            expect(config.retries).toBe(3);
        });

        it('should leave optional fields undefined when not supplied', () => {
            const config = new ConfigurationRestAPI({ apiKey: 'test-api-key' });

            expect(config.apiSecret).toBeUndefined();
            expect(config.basePath).toBeUndefined();
            expect(config.privateKey).toBeUndefined();
            expect(config.privateKeyPassphrase).toBeUndefined();
            expect(config.timeUnit).toBeUndefined();
            expect(config.baseOptions?.proxy).toBeUndefined();
        });
    });

    describe('overrides', () => {
        it('should keep explicit false over the true defaults', () => {
            const config = new ConfigurationRestAPI({
                apiKey: 'test-api-key',
                keepAlive: false,
                compression: false,
            });

            expect(config.keepAlive).toBe(false);
            expect(config.compression).toBe(false);
        });

        it('should keep an explicit zero rather than substituting the default', () => {
            const config = new ConfigurationRestAPI({
                apiKey: 'test-api-key',
                retries: 0,
                backoff: 0,
                timeout: 0,
            });

            expect(config.retries).toBe(0);
            expect(config.backoff).toBe(0);
            expect(config.baseOptions?.timeout).toBe(0);
        });

        it('should carry through credentials, basePath and timeUnit', () => {
            const config = new ConfigurationRestAPI({
                apiKey: 'test-api-key',
                apiSecret: 'test-api-secret',
                basePath: 'https://example.invalid',
                timeUnit: TimeUnit.MICROSECOND,
            });

            expect(config.apiKey).toBe('test-api-key');
            expect(config.apiSecret).toBe('test-api-secret');
            expect(config.basePath).toBe('https://example.invalid');
            expect(config.timeUnit).toBe(TimeUnit.MICROSECOND);
        });

        it('should accept a custom https agent', () => {
            const agent = new Agent({ keepAlive: true });
            const config = new ConfigurationRestAPI({ apiKey: 'test-api-key', httpsAgent: agent });

            expect(config.baseOptions?.httpsAgent).toBe(agent);
        });
    });

    describe('baseOptions.headers', () => {
        it('should always set Content-Type and the API key header', () => {
            const config = new ConfigurationRestAPI({ apiKey: 'test-api-key' });

            expect(config.baseOptions?.headers).toEqual({
                'Content-Type': 'application/json',
                'X-MBX-APIKEY': 'test-api-key',
            });
        });

        it('should merge custom headers alongside the defaults', () => {
            const config = new ConfigurationRestAPI({
                apiKey: 'test-api-key',
                customHeaders: { 'X-Trace-Id': 'abc-123' },
            });

            expect(config.baseOptions?.headers).toEqual({
                'X-Trace-Id': 'abc-123',
                'Content-Type': 'application/json',
                'X-MBX-APIKEY': 'test-api-key',
            });
        });

        it('should drop forbidden custom headers', () => {
            const config = new ConfigurationRestAPI({
                apiKey: 'test-api-key',
                customHeaders: { authorization: 'Bearer leak', cookie: 'a=b', host: 'evil' },
            });

            expect(config.baseOptions?.headers).toEqual({
                'Content-Type': 'application/json',
                'X-MBX-APIKEY': 'test-api-key',
            });
        });

        it('should not let a custom header overwrite the API key header', () => {
            const config = new ConfigurationRestAPI({
                apiKey: 'test-api-key',
                customHeaders: { 'X-MBX-APIKEY': 'spoofed' },
            });

            expect((config.baseOptions?.headers as Record<string, string>)['X-MBX-APIKEY']).toBe(
                'test-api-key'
            );
        });
    });

    describe('proxy', () => {
        it('should map host, port and auth into baseOptions', () => {
            const auth = { username: 'user', password: 'pass' };
            const config = new ConfigurationRestAPI({
                apiKey: 'test-api-key',
                proxy: { host: '127.0.0.1', port: 8080, protocol: 'http', auth },
            });

            expect(config.baseOptions?.proxy).toEqual({ host: '127.0.0.1', port: 8080, auth });
        });

        it('should omit auth when the proxy has no credentials', () => {
            const config = new ConfigurationRestAPI({
                apiKey: 'test-api-key',
                proxy: { host: '127.0.0.1', port: 8080 },
            });

            expect(config.baseOptions?.proxy).toEqual({
                host: '127.0.0.1',
                port: 8080,
                auth: undefined,
            });
        });
    });
});

describe('ConfigurationWebsocketAPI', () => {
    it('should apply every documented default when only an apiKey is given', () => {
        const config = new ConfigurationWebsocketAPI({ apiKey: 'test-api-key' });

        expect(config.timeout).toBe(5000);
        expect(config.reconnectDelay).toBe(5000);
        expect(config.compression).toBe(true);
        expect(config.agent).toBe(false);
        expect(config.mode).toBe('single');
        expect(config.poolSize).toBe(1);
        expect(config.autoSessionReLogon).toBe(true);
    });

    it('should construct with an empty apiKey when no argument is passed', () => {
        const config = new ConfigurationWebsocketAPI();

        expect(config.apiKey).toBe('');
        expect(config.mode).toBe('single');
    });

    it('should keep explicit false over the true defaults', () => {
        const config = new ConfigurationWebsocketAPI({
            apiKey: 'test-api-key',
            compression: false,
            autoSessionReLogon: false,
        });

        expect(config.compression).toBe(false);
        expect(config.autoSessionReLogon).toBe(false);
    });

    it('should carry through pool configuration', () => {
        const config = new ConfigurationWebsocketAPI({
            apiKey: 'test-api-key',
            mode: 'pool',
            poolSize: 4,
        });

        expect(config.mode).toBe('pool');
        expect(config.poolSize).toBe(4);
    });

    it('should carry through the websocket URL, credentials and timeUnit', () => {
        const config = new ConfigurationWebsocketAPI({
            apiKey: 'test-api-key',
            apiSecret: 'test-api-secret',
            wsURL: 'ws://localhost:3000',
            timeUnit: TimeUnit.MILLISECOND,
        });

        expect(config.wsURL).toBe('ws://localhost:3000');
        expect(config.apiSecret).toBe('test-api-secret');
        expect(config.timeUnit).toBe(TimeUnit.MILLISECOND);
    });

    it('should leave the private key fields undefined when not supplied', () => {
        const config = new ConfigurationWebsocketAPI({ apiKey: 'test-api-key' });

        expect(config.privateKey).toBeUndefined();
        expect(config.privateKeyPassphrase).toBeUndefined();
    });
});

describe('ConfigurationWebsocketStreams', () => {
    it('should apply every documented default when constructed empty', () => {
        const config = new ConfigurationWebsocketStreams();

        expect(config.reconnectDelay).toBe(5000);
        expect(config.compression).toBe(true);
        expect(config.agent).toBe(false);
        expect(config.mode).toBe('single');
        expect(config.poolSize).toBe(1);
        expect(config.wsURL).toBeUndefined();
        expect(config.timeUnit).toBeUndefined();
    });

    it('should keep explicit false over the compression default', () => {
        const config = new ConfigurationWebsocketStreams({ compression: false });

        expect(config.compression).toBe(false);
    });

    it('should keep an explicit zero reconnect delay', () => {
        const config = new ConfigurationWebsocketStreams({ reconnectDelay: 0 });

        expect(config.reconnectDelay).toBe(0);
    });

    it('should carry through pool configuration and websocket URL', () => {
        const config = new ConfigurationWebsocketStreams({
            wsURL: 'ws://localhost:3000',
            mode: 'pool',
            poolSize: 3,
        });

        expect(config.wsURL).toBe('ws://localhost:3000');
        expect(config.mode).toBe('pool');
        expect(config.poolSize).toBe(3);
    });

    it('should accept a custom agent', () => {
        const agent = new Agent({ keepAlive: true });
        const config = new ConfigurationWebsocketStreams({ agent });

        expect(config.agent).toBe(agent);
    });
});
