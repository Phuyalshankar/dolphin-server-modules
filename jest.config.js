export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/auth/**/*.ts', 'src/controller/**/*.ts', 'src/crud/**/*.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
    '[\\\\/]scripts[\\\\/].+\\.js$': '<rootDir>/scripts/jest-esm-strip-transform.cjs',
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    '/node_modules/',
  ],
};
