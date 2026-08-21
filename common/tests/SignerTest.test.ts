import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect, afterAll, beforeAll, describe, it } from '@jest/globals';
import { getSignature, clearSignerCache, buildQueryString } from '../src';

const QUERY = { symbol: 'BNBUSDT', side: 'BUY', timestamp: 1700000000000 };

let tmpDir: string;
let rsaPem: string;
let ed25519Pem: string;
let ecPem: string;
let encryptedEd25519Pem: string;
const PASSPHRASE = 'correct horse battery staple';

beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'binance-signer-'));

    rsaPem = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey as string;

    ed25519Pem = crypto.generateKeyPairSync('ed25519', {
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey as string;

    ecPem = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey as string;

    encryptedEd25519Pem = crypto.generateKeyPairSync('ed25519', {
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
            cipher: 'aes-256-cbc',
            passphrase: PASSPHRASE,
        },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey as string;
});

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getSignature()', () => {
    describe('HMAC-SHA256 signing', () => {
        it('should sign with the API secret when no private key is present', () => {
            const signature = getSignature({ apiSecret: 'test-api-secret' }, QUERY);

            const expected = crypto
                .createHmac('sha256', 'test-api-secret')
                .update(buildQueryString(QUERY))
                .digest('hex');

            expect(signature).toBe(expected);
        });

        it('should prefer the private key when both are supplied', () => {
            const hmac = getSignature({ apiSecret: 'test-api-secret' }, QUERY);
            const asymmetric = getSignature(
                { apiSecret: 'test-api-secret', privateKey: ed25519Pem },
                QUERY
            );

            expect(asymmetric).not.toBe(hmac);
        });
    });

    describe('ED25519 signing', () => {
        it('should produce a base64 signature that verifies against the public key', () => {
            const keyObject = crypto.createPrivateKey(ed25519Pem);
            const publicKey = crypto.createPublicKey(keyObject);

            const signature = getSignature({ privateKey: ed25519Pem }, QUERY);

            expect(
                crypto.verify(
                    null,
                    Buffer.from(buildQueryString(QUERY)),
                    publicKey,
                    Buffer.from(signature, 'base64')
                )
            ).toBe(true);
        });

        it('should accept a Buffer private key', () => {
            const signature = getSignature({ privateKey: Buffer.from(ed25519Pem) }, QUERY);

            expect(signature).toEqual(expect.any(String));
            expect(signature.length).toBeGreaterThan(0);
        });
    });

    describe('RSA signing', () => {
        it('should produce an RSA-SHA256 signature that verifies against the public key', () => {
            const publicKey = crypto.createPublicKey(crypto.createPrivateKey(rsaPem));

            const signature = getSignature({ privateKey: rsaPem }, QUERY);

            expect(
                crypto.verify(
                    'RSA-SHA256',
                    Buffer.from(buildQueryString(QUERY)),
                    publicKey,
                    Buffer.from(signature, 'base64')
                )
            ).toBe(true);
        });
    });

    describe('private key supplied as a file path', () => {
        it('should read an ED25519 key from disk and sign with it', () => {
            const keyPath = path.join(tmpDir, 'ed25519.pem');
            fs.writeFileSync(keyPath, ed25519Pem);

            const fromFile = getSignature({ privateKey: keyPath }, QUERY);
            const fromString = getSignature({ privateKey: ed25519Pem }, QUERY);

            expect(fromFile).toBe(fromString);
        });

        it('should read an RSA key from disk and sign with it', () => {
            const keyPath = path.join(tmpDir, 'rsa.pem');
            fs.writeFileSync(keyPath, rsaPem);

            const fromFile = getSignature({ privateKey: keyPath }, QUERY);
            const fromString = getSignature({ privateKey: rsaPem }, QUERY);

            expect(fromFile).toBe(fromString);
        });

        it('should treat a non-existent path as key material and reject it', () => {
            expect(() =>
                getSignature({ privateKey: path.join(tmpDir, 'missing.pem') }, QUERY)
            ).toThrow('Invalid private key. Please provide a valid RSA or ED25519 private key.');
        });
    });

    describe('passphrase-protected private keys', () => {
        it('should decrypt the key when the correct passphrase is supplied', () => {
            const signature = getSignature(
                { privateKey: encryptedEd25519Pem, privateKeyPassphrase: PASSPHRASE },
                QUERY
            );

            expect(signature).toEqual(expect.any(String));
            expect(signature.length).toBeGreaterThan(0);
        });

        it('should reject an encrypted key when the passphrase is missing', () => {
            expect(() => getSignature({ privateKey: encryptedEd25519Pem }, QUERY)).toThrow(
                'Invalid private key. Please provide a valid RSA or ED25519 private key.'
            );
        });

        it('should reject an encrypted key when the passphrase is wrong', () => {
            expect(() =>
                getSignature(
                    { privateKey: encryptedEd25519Pem, privateKeyPassphrase: 'wrong' },
                    QUERY
                )
            ).toThrow('Invalid private key. Please provide a valid RSA or ED25519 private key.');
        });

        it('should read an encrypted key from disk and decrypt it', () => {
            const keyPath = path.join(tmpDir, 'ed25519-encrypted.pem');
            fs.writeFileSync(keyPath, encryptedEd25519Pem);

            const signature = getSignature(
                { privateKey: keyPath, privateKeyPassphrase: PASSPHRASE },
                QUERY
            );

            expect(signature).toEqual(expect.any(String));
        });
    });

    describe('rejected configurations', () => {
        it('should throw when neither an API secret nor a private key is supplied', () => {
            expect(() => getSignature({}, QUERY)).toThrow(
                "Either 'apiSecret' or 'privateKey' must be provided for signed requests."
            );
        });

        it('should throw on key material that is not a valid PEM', () => {
            expect(() => getSignature({ privateKey: 'not-a-key' }, QUERY)).toThrow(
                'Invalid private key. Please provide a valid RSA or ED25519 private key.'
            );
        });

        it('should reject a well-formed key of an unsupported type', () => {
            expect(() => getSignature({ privateKey: ecPem }, QUERY)).toThrow(
                'Unsupported private key type. Must be RSA or ED25519.'
            );
        });
    });

    describe('signer cache', () => {
        it('should reuse the signer bound to a configuration object', () => {
            const config: { apiSecret?: string } = { apiSecret: 'first-secret' };
            const first = getSignature(config, QUERY);

            config.apiSecret = 'second-secret';
            const second = getSignature(config, QUERY);

            expect(second).toBe(first);
        });

        it('should rebuild the signer for a configuration object after the cache is cleared', () => {
            const config: { apiSecret?: string } = { apiSecret: 'first-secret' };
            const first = getSignature(config, QUERY);

            config.apiSecret = 'second-secret';
            clearSignerCache();
            const second = getSignature(config, QUERY);

            expect(second).not.toBe(first);
            expect(second).toBe(
                crypto
                    .createHmac('sha256', 'second-secret')
                    .update(buildQueryString(QUERY))
                    .digest('hex')
            );
        });

        it('should keep separate signers for separate configuration objects', () => {
            const a = getSignature({ apiSecret: 'secret-a' }, QUERY);
            const b = getSignature({ apiSecret: 'secret-b' }, QUERY);

            expect(a).not.toBe(b);
        });
    });
});
