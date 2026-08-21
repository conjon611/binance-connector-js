import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    verbose: true,
    collectCoverageFrom: ['src/**/*.ts'],
    coverageReporters: ['text-summary', 'lcov'],
    // Ratchet: these are the measured values at the time coverage was introduced,
    // floored to whole percents. Raise them as coverage improves; never lower them.
    coverageThreshold: {
        global: {
            statements: 37,
            branches: 6,
            functions: 34,
            lines: 39,
        },
    },
};

export default config;
