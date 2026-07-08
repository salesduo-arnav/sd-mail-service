module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/**/*.test.ts'],
    roots: ['<rootDir>/src'],
    verbose: true,
    forceExit: true,
    detectOpenHandles: true,
    testTimeout: 60000,
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
};
