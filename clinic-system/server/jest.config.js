const testArgs = process.argv.slice(2)
const isTargetedTestRun = testArgs.some((arg) => {
  return (
    (!arg.startsWith('-') && !arg.includes('node_modules')) ||
    arg.startsWith('--testPathPattern') ||
    arg.startsWith('--testMatch') ||
    arg.startsWith('--runTestsByPath')
  )
})
module.exports = {
  testEnvironment: 'node',

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  silent: !isTargetedTestRun,
  verbose: isTargetedTestRun,

  collectCoverage: true,

  coverageDirectory: 'coverage',

  collectCoverageFrom: [
    'src/**/*.js',

    '!src/**/*.test.js',
    '!src/tests/**',
    '!src/**/__tests__/**',
    '!src/index.js',
  ],

  coverageReporters: ['text', 'lcov', 'html', 'json-summary']
}