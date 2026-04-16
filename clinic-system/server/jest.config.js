module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
}
