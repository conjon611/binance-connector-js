import { expect, beforeEach, afterEach, describe, it, jest } from '@jest/globals';
import { Logger, LogLevel } from '../src';

describe('Logger', () => {
    const originalEnv = process.env.LOG_LEVEL;
    let debugSpy: jest.SpiedFunction<typeof console.debug>;
    let infoSpy: jest.SpiedFunction<typeof console.info>;
    let warnSpy: jest.SpiedFunction<typeof console.warn>;
    let errorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
        debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
        infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (originalEnv === undefined) delete process.env.LOG_LEVEL;
        else process.env.LOG_LEVEL = originalEnv;
    });

    describe('constructor()', () => {
        it('should default to INFO when LOG_LEVEL is not set', () => {
            delete process.env.LOG_LEVEL;
            const logger = new Logger();

            logger.debug('suppressed');
            logger.info('emitted');

            expect(debugSpy).not.toHaveBeenCalled();
            expect(infoSpy).toHaveBeenCalled();
        });

        it('should honour a valid LOG_LEVEL from the environment', () => {
            process.env.LOG_LEVEL = 'debug';
            const logger = new Logger();

            logger.debug('emitted');

            expect(debugSpy).toHaveBeenCalled();
        });

        it('should accept LOG_LEVEL case-insensitively', () => {
            process.env.LOG_LEVEL = 'DEBUG';
            const logger = new Logger();

            logger.debug('emitted');

            expect(debugSpy).toHaveBeenCalled();
        });

        it('should fall back to INFO when LOG_LEVEL is not a recognised level', () => {
            process.env.LOG_LEVEL = 'verbose';
            const logger = new Logger();

            logger.debug('suppressed');
            logger.info('emitted');

            expect(debugSpy).not.toHaveBeenCalled();
            expect(infoSpy).toHaveBeenCalled();
        });
    });

    describe('getInstance()', () => {
        it('should return the same instance on repeated calls', () => {
            expect(Logger.getInstance()).toBe(Logger.getInstance());
        });

        it('should return a Logger', () => {
            expect(Logger.getInstance()).toBeInstanceOf(Logger);
        });
    });

    describe('setMinLogLevel()', () => {
        it('should raise the threshold so lower levels are suppressed', () => {
            const logger = new Logger();
            logger.setMinLogLevel(LogLevel.ERROR);

            logger.info('suppressed');
            logger.warn('suppressed');
            logger.error('emitted');

            expect(infoSpy).not.toHaveBeenCalled();
            expect(warnSpy).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalled();
        });

        it('should lower the threshold so debug messages are emitted', () => {
            const logger = new Logger();
            logger.setMinLogLevel(LogLevel.DEBUG);

            logger.debug('emitted');

            expect(debugSpy).toHaveBeenCalled();
        });

        it('should throw on a level outside the known set', () => {
            const logger = new Logger();

            expect(() => logger.setMinLogLevel('trace' as LogLevel)).toThrow(
                'Invalid log level: trace'
            );
        });

        it('should leave the previous threshold in place when the new level is rejected', () => {
            const logger = new Logger();
            logger.setMinLogLevel(LogLevel.ERROR);

            expect(() => logger.setMinLogLevel('trace' as LogLevel)).toThrow();

            logger.info('still suppressed');
            expect(infoSpy).not.toHaveBeenCalled();
        });

        it('should emit every level once the threshold is NONE, which sorts below DEBUG', () => {
            const logger = new Logger();
            logger.setMinLogLevel(LogLevel.NONE);

            logger.debug('emitted');
            logger.info('emitted');
            logger.warn('emitted');
            logger.error('emitted');

            expect(debugSpy).toHaveBeenCalled();
            expect(infoSpy).toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalled();
        });
    });

    describe('log output', () => {
        it('should prefix messages with an ISO timestamp and the level', () => {
            const logger = new Logger();
            logger.info('hello');

            expect(infoSpy).toHaveBeenCalledWith(
                expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[info\]$/),
                'hello'
            );
        });

        it('should forward every argument to the console method', () => {
            const logger = new Logger();
            const payload = { symbol: 'BNBUSDT' };

            logger.error('failed', payload, 42);

            expect(errorSpy).toHaveBeenCalledWith(expect.any(String), 'failed', payload, 42);
        });

        it('should route each level to its matching console method', () => {
            const logger = new Logger();
            logger.setMinLogLevel(LogLevel.DEBUG);

            logger.debug('d');
            logger.info('i');
            logger.warn('w');
            logger.error('e');

            expect(debugSpy).toHaveBeenCalledTimes(1);
            expect(infoSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy).toHaveBeenCalledTimes(1);
        });
    });
});
