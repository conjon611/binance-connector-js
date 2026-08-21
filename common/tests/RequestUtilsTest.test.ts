import { platform, arch } from 'os';
import { expect, describe, it } from '@jest/globals';
import { buildUserAgent, parseRateLimitHeaders, setSearchParams, toPathString } from '../src';

describe('setSearchParams()', () => {
    it('should write a flat object onto the URL query string', () => {
        const url = new URL('https://api.binance.com/api/v3/order');

        setSearchParams(url, { symbol: 'BNBUSDT', side: 'BUY' });

        expect(url.search).toBe('?symbol=BNBUSDT&side=BUY');
    });

    it('should preserve query parameters already present on the URL', () => {
        const url = new URL('https://api.binance.com/api/v3/order?recvWindow=5000');

        setSearchParams(url, { symbol: 'BNBUSDT' });

        expect(url.searchParams.get('recvWindow')).toBe('5000');
        expect(url.searchParams.get('symbol')).toBe('BNBUSDT');
    });

    it('should merge multiple objects into one query string', () => {
        const url = new URL('https://api.binance.com/api/v3/order');

        setSearchParams(url, { symbol: 'BNBUSDT' }, { side: 'SELL' });

        expect(url.searchParams.get('symbol')).toBe('BNBUSDT');
        expect(url.searchParams.get('side')).toBe('SELL');
    });

    it('should leave the query untouched when given no objects', () => {
        const url = new URL('https://api.binance.com/api/v3/ping');

        setSearchParams(url);

        expect(url.search).toBe('');
    });

    it('should percent-encode reserved characters', () => {
        const url = new URL('https://api.binance.com/api/v3/order');

        setSearchParams(url, { signature: 'a+b/c=' });

        expect(url.search).toContain('signature=a%2Bb%2Fc%3D');
    });
});

describe('toPathString()', () => {
    it('should return the pathname when there is nothing else', () => {
        expect(toPathString(new URL('https://api.binance.com/api/v3/ping'))).toBe('/api/v3/ping');
    });

    it('should append the query string', () => {
        expect(toPathString(new URL('https://api.binance.com/api/v3/depth?symbol=BNBUSDT'))).toBe(
            '/api/v3/depth?symbol=BNBUSDT'
        );
    });

    it('should append the hash fragment', () => {
        expect(toPathString(new URL('https://api.binance.com/api/v3/depth?a=1#frag'))).toBe(
            '/api/v3/depth?a=1#frag'
        );
    });

    it('should return a bare slash for a root URL', () => {
        expect(toPathString(new URL('https://api.binance.com'))).toBe('/');
    });
});

describe('buildUserAgent()', () => {
    it('should combine package name, version and runtime details', () => {
        expect(buildUserAgent('@binance/spot', '13.0.0')).toBe(
            `@binance/spot/13.0.0 (Node.js/${process.version}; ${platform()}; ${arch()})`
        );
    });

    it('should start with the package name and version', () => {
        expect(buildUserAgent('@binance/wallet', '1.2.3')).toMatch(/^@binance\/wallet\/1\.2\.3 \(/);
    });
});

describe('parseRateLimitHeaders()', () => {
    it('should parse a per-second request weight header', () => {
        expect(parseRateLimitHeaders({ 'x-mbx-used-weight-10s': '25' })).toEqual([
            { rateLimitType: 'REQUEST_WEIGHT', interval: 'SECOND', intervalNum: 10, count: 25 },
        ]);
    });

    it('should parse per-minute, per-hour and per-day intervals', () => {
        expect(
            parseRateLimitHeaders({
                'x-mbx-used-weight-1m': '10',
                'x-mbx-order-count-1h': '20',
                'x-mbx-order-count-1d': '30',
            })
        ).toEqual([
            { rateLimitType: 'REQUEST_WEIGHT', interval: 'MINUTE', intervalNum: 1, count: 10 },
            { rateLimitType: 'ORDERS', interval: 'HOUR', intervalNum: 1, count: 20 },
            { rateLimitType: 'ORDERS', interval: 'DAY', intervalNum: 1, count: 30 },
        ]);
    });

    it('should ignore a header whose interval unit is not recognised', () => {
        expect(parseRateLimitHeaders({ 'x-mbx-used-weight-1y': '10' })).toEqual([]);
    });

    it('should ignore a header with no interval suffix at all', () => {
        expect(parseRateLimitHeaders({ 'x-mbx-used-weight-': '10' })).toEqual([]);
    });

    it('should ignore unrelated headers', () => {
        expect(parseRateLimitHeaders({ 'content-type': 'application/json' })).toEqual([]);
    });

    it('should skip headers with an undefined value', () => {
        expect(parseRateLimitHeaders({ 'x-mbx-used-weight-1m': undefined })).toEqual([]);
    });

    it('should match header names case-insensitively', () => {
        expect(parseRateLimitHeaders({ 'X-MBX-USED-WEIGHT-1M': '15' })).toEqual([
            { rateLimitType: 'REQUEST_WEIGHT', interval: 'MINUTE', intervalNum: 1, count: 15 },
        ]);
    });

    it('should stamp retry-after onto every parsed limit', () => {
        expect(
            parseRateLimitHeaders({
                'x-mbx-used-weight-1m': '10',
                'x-mbx-order-count-1d': '20',
                'retry-after': '30',
            })
        ).toEqual([
            {
                rateLimitType: 'REQUEST_WEIGHT',
                interval: 'MINUTE',
                intervalNum: 1,
                count: 10,
                retryAfter: 30,
            },
            {
                rateLimitType: 'ORDERS',
                interval: 'DAY',
                intervalNum: 1,
                count: 20,
                retryAfter: 30,
            },
        ]);
    });

    it('should return an empty array for empty headers', () => {
        expect(parseRateLimitHeaders({})).toEqual([]);
    });
});
