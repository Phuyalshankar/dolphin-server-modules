export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/auth/**/*.ts', 'src/controller/**/*.ts', 'src/curd/**/*.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '[\\\\/]scripts[\\\\/].+\\.js$': '<rootDir>/scripts/jest-esm-strip-transform.cjs',
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    '/node_modules/',
  ],
};
