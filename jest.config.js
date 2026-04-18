/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/auth/**/*.ts', 'src/controller/**/*.ts', 'src/curd/**/*.ts']
};
