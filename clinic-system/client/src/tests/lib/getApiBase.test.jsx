import getApiBase, { resolveApiBase } from '../../lib/getApiBase'

describe('getApiBase', () => {
  test('resolveApiBase returns injected API base for non-localhost hosts', () => {
    expect(
      resolveApiBase('example.com', 'https://ubuntu-health-api.example.com')
    ).toBe('https://ubuntu-health-api.example.com')
  })

  test('resolveApiBase uses localhost URL for localhost', () => {
    expect(
      resolveApiBase('localhost', 'https://ubuntu-health-api.example.com')
    ).toBe('http://localhost:8080')
  })

  test('resolveApiBase falls back to empty string for non-localhost when no API base is defined', () => {
    expect(resolveApiBase('example.com', '')).toBe('')
  })

  test('getApiBase returns a string', () => {
    expect(typeof getApiBase()).toBe('string')
  })
})
