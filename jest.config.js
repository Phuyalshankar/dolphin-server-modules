export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/auth/**/*.ts', 'src/controller/**/*.ts', 'src/curd/**/*.ts'],
  transform: {
    // TypeScript files → ts-jest
    '^.+\\.tsx?$': 'ts-jest',
    // scripts/*.js (ESM with bare export) → custom strip transform
    '[\\\\/]scripts[\\\\/].+\\.js$': '<rootDir>/scripts/jest-esm-strip-transform.cjs',
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    '/node_modules/',
  ],
};
