/**
 * Covers the hand-written facade in src/auto-invest.ts: which transports get
 * constructed, the production URL defaults, and User-Agent injection.
 */

import { platform, arch } from 'os';
import { expect, describe, it } from '@jest/globals';
import { AUTO_INVEST_REST_API_PROD_URL, ConfigurationRestAPI } from '@binance/common';
import { name, version } from '../../package.json';
import { AutoInvest, type ConfigurationAutoInvest } from '../../src/auto-invest';

/** The exact header value the server sees. */
const userAgent = `${name}/${version} (Node.js/${process.version}; ${platform()}; ${arch()})`;

/** The transports keep their config private; tests assert on what the facade stored. */
const configOf = (transport: unknown) =>
    (transport as { configuration: Record<string, unknown> }).configuration;

const headersOf = (transport: unknown) =>
    (configOf(transport).baseOptions as { headers: Record<string, string> }).headers;

describe('AutoInvest', () => {
    describe('REST API transport', () => {
        it('should not be constructed when no REST configuration is supplied', () => {
            const client = new AutoInvest({} as ConfigurationAutoInvest);

            expect(client.restAPI).toBeUndefined();
        });

        it('should default basePath to the production REST URL', () => {
            const client = new AutoInvest({ configurationRestAPI: { apiKey: 'test-api-key' } });

            expect(client.restAPI).toBeDefined();
            expect(configOf(client.restAPI).basePath).toBe(AUTO_INVEST_REST_API_PROD_URL);
        });

        it('should keep an explicitly supplied basePath', () => {
            const client = new AutoInvest({
                configurationRestAPI: {
                    apiKey: 'test-api-key',
                    basePath: 'https://example.invalid',
                },
            });

            expect(configOf(client.restAPI).basePath).toBe('https://example.invalid');
        });

        it('should inject the User-Agent header', () => {
            const client = new AutoInvest({ configurationRestAPI: { apiKey: 'test-api-key' } });

            expect(headersOf(client.restAPI)['User-Agent']).toBe(userAgent);
        });

        it('should keep the API key header alongside the User-Agent', () => {
            const client = new AutoInvest({ configurationRestAPI: { apiKey: 'test-api-key' } });

            expect(headersOf(client.restAPI)['X-MBX-APIKEY']).toBe('test-api-key');
            expect(headersOf(client.restAPI)['Content-Type']).toBe('application/json');
        });
    });

    describe('a pre-built ConfigurationRestAPI instance', () => {
        // The facade always re-runs new ConfigurationRestAPI(config.configurationRestAPI).
        // ConfigurationRestAPI keeps timeout, proxy and httpsAgent only inside
        // baseOptions, never as own properties, so re-constructing from an instance silently
        // resets them. Documented usage passes an object literal, which is unaffected.
        it('should reset the timeout to the default', () => {
            const client = new AutoInvest({
                configurationRestAPI: new ConfigurationRestAPI({
                    apiKey: 'test-api-key',
                    timeout: 30000,
                }),
            });

            const baseOptions = configOf(client.restAPI).baseOptions as { timeout: number };
            expect(baseOptions.timeout).toBe(1000);
        });

        it('should drop the proxy', () => {
            const client = new AutoInvest({
                configurationRestAPI: new ConfigurationRestAPI({
                    apiKey: 'test-api-key',
                    proxy: { host: '127.0.0.1', port: 8080 },
                }),
            });

            const baseOptions = configOf(client.restAPI).baseOptions as { proxy?: unknown };
            expect(baseOptions.proxy).toBeUndefined();
        });

        it('should still carry the credentials and apply the URL default', () => {
            const client = new AutoInvest({
                configurationRestAPI: new ConfigurationRestAPI({ apiKey: 'test-api-key' }),
            });

            expect(headersOf(client.restAPI)['X-MBX-APIKEY']).toBe('test-api-key');
            expect(configOf(client.restAPI).basePath).toBe(AUTO_INVEST_REST_API_PROD_URL);
        });
    });

    describe('construction', () => {
        it('should construct every configured transport together', () => {
            const client = new AutoInvest({
                configurationRestAPI: { apiKey: 'test-api-key' },
            });

            expect(client.restAPI).toBeDefined();
        });

        it('should construct no transports for an empty configuration', () => {
            const client = new AutoInvest({} as ConfigurationAutoInvest);

            expect(client.restAPI).toBeUndefined();
        });
    });
});
