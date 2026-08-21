/**
 * Covers the hand-written facade in src/dual-investment.ts: which transports get
 * constructed, the production URL defaults, and User-Agent injection.
 */

import { platform, arch } from 'os';
import { expect, describe, it } from '@jest/globals';
import { ConfigurationRestAPI, DUAL_INVESTMENT_REST_API_PROD_URL } from '@binance/common';
import { name, version } from '../../package.json';
import { DualInvestment, type ConfigurationDualInvestment } from '../../src/dual-investment';

/** The exact header value the server sees. */
const userAgent = `${name}/${version} (Node.js/${process.version}; ${platform()}; ${arch()})`;

/** The transports keep their config private; tests assert on what the facade stored. */
const configOf = (transport: unknown) =>
    (transport as { configuration: Record<string, unknown> }).configuration;

const headersOf = (transport: unknown) =>
    (configOf(transport).baseOptions as { headers: Record<string, string> }).headers;

describe('DualInvestment', () => {
    describe('REST API transport', () => {
        it('should not be constructed when no REST configuration is supplied', () => {
            const client = new DualInvestment({} as ConfigurationDualInvestment);

            expect(client.restAPI).toBeUndefined();
        });

        it('should default basePath to the production REST URL', () => {
            const client = new DualInvestment({ configurationRestAPI: { apiKey: 'test-api-key' } });

            expect(client.restAPI).toBeDefined();
            expect(configOf(client.restAPI).basePath).toBe(DUAL_INVESTMENT_REST_API_PROD_URL);
        });

        it('should keep an explicitly supplied basePath', () => {
            const client = new DualInvestment({
                configurationRestAPI: {
                    apiKey: 'test-api-key',
                    basePath: 'https://example.invalid',
                },
            });

            expect(configOf(client.restAPI).basePath).toBe('https://example.invalid');
        });

        it('should inject the User-Agent header', () => {
            const client = new DualInvestment({ configurationRestAPI: { apiKey: 'test-api-key' } });

            expect(headersOf(client.restAPI)['User-Agent']).toBe(userAgent);
        });

        it('should keep the API key header alongside the User-Agent', () => {
            const client = new DualInvestment({ configurationRestAPI: { apiKey: 'test-api-key' } });

            expect(headersOf(client.restAPI)['X-MBX-APIKEY']).toBe('test-api-key');
            expect(headersOf(client.restAPI)['Content-Type']).toBe('application/json');
        });

        it('should preserve custom headers the caller supplied', () => {
            const client = new DualInvestment({
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
            const client = new DualInvestment({
                configurationRestAPI: new ConfigurationRestAPI({
                    apiKey: 'test-api-key',
                    timeout: 30000,
                }),
            });

            const baseOptions = configOf(client.restAPI).baseOptions as { timeout: number };
            expect(baseOptions.timeout).toBe(1000);
        });

        it('should drop the proxy', () => {
            const client = new DualInvestment({
                configurationRestAPI: new ConfigurationRestAPI({
                    apiKey: 'test-api-key',
                    proxy: { host: '127.0.0.1', port: 8080 },
                }),
            });

            const baseOptions = configOf(client.restAPI).baseOptions as { proxy?: unknown };
            expect(baseOptions.proxy).toBeUndefined();
        });

        it('should drop custom headers', () => {
            const client = new DualInvestment({
                configurationRestAPI: new ConfigurationRestAPI({
                    apiKey: 'test-api-key',
                    customHeaders: { 'X-Trace-Id': 'abc-123' },
                }),
            });

            expect(headersOf(client.restAPI)['X-Trace-Id']).toBeUndefined();
        });

        it('should still carry the credentials and apply the URL default', () => {
            const client = new DualInvestment({
                configurationRestAPI: new ConfigurationRestAPI({ apiKey: 'test-api-key' }),
            });

            expect(headersOf(client.restAPI)['X-MBX-APIKEY']).toBe('test-api-key');
            expect(configOf(client.restAPI).basePath).toBe(DUAL_INVESTMENT_REST_API_PROD_URL);
        });
    });

    describe('construction', () => {
        it('should construct every configured transport together', () => {
            const client = new DualInvestment({
                configurationRestAPI: { apiKey: 'test-api-key' },
            });

            expect(client.restAPI).toBeDefined();
        });

        it('should construct no transports for an empty configuration', () => {
            const client = new DualInvestment({} as ConfigurationDualInvestment);

            expect(client.restAPI).toBeUndefined();
        });
    });
});
