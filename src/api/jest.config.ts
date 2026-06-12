import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@domains/(.*)$': '<rootDir>/src/domains/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!**/*.module.ts', '!**/index.ts'],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      lines: 85,
      functions: 85,
      branches: 85,
      statements: 85,
    },
  },
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      transform: { '^.+\\.(t|j)s$': 'ts-jest' },
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@domains/(.*)$': '<rootDir>/src/domains/$1',
      },
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
      transform: { '^.+\\.(t|j)s$': 'ts-jest' },
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@domains/(.*)$': '<rootDir>/src/domains/$1',
      },
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
      transform: { '^.+\\.(t|j)s$': 'ts-jest' },
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@domains/(.*)$': '<rootDir>/src/domains/$1',
      },
    },
  ],
};

export default config;
