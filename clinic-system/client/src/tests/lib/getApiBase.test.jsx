import getApiBase from '../../lib/getApiBase'

describe('getApiBase', () => {
  afterEach(() => {
    delete window.__API_BASE__
  })

  test('returns API base when defined', () => {
    window.__API_BASE__ = 'http://localhost:8080'

    expect(getApiBase()).toBe('http://localhost:8080')
  })

  test('returns empty string when not defined', () => {
    delete window.__API_BASE__

    expect(getApiBase()).toBe('')
  })
})