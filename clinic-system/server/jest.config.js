module.exports = {
  testEnvironment: 'node',

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  collectCoverage: true,

  coverageDirectory: 'coverage',

  collectCoverageFrom: [
    'src/**/*.js',

    '!src/**/*.test.js',
    '!src/tests/**',
    '!src/**/__tests__/**',

    '!src/index.js'
  ],

  coverageReporters: ['text', 'lcov', 'html']
}