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
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],

  silent: !isTargetedTestRun,
  verbose: isTargetedTestRun,

  moduleFileExtensions: ['js', 'jsx'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/tests/__mocks__/fileMock.js',
  },
  testMatch: ['<rootDir>/src/tests/**/*.test.jsx'],

  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/main.jsx',
    '!src/tests/**',
    '!src/**/*.test.{js,jsx}',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
}