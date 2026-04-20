beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
})