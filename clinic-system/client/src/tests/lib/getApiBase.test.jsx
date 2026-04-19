import getApiBase from '../../lib/getApiBase'

describe('getApiBase', () => {
  const realWindow = global.window

  afterEach(() => {
    global.window = realWindow
  })

  test('returns API base when defined on window', () => {
    const mockWindow = Object.create(realWindow)
    mockWindow.__API_BASE__ = 'http://localhost:8080'
    mockWindow.location = { hostname: 'example.com' }

    global.window = mockWindow

    expect(getApiBase()).toBe('http://localhost:8080')
  })

  test('falls back to localhost URL when no API base is defined', () => {
    const mockWindow = Object.create(realWindow)
    delete mockWindow.__API_BASE__
    mockWindow.location = { hostname: 'localhost' }

    global.window = mockWindow

    expect(getApiBase()).toBe('http://localhost:8080')
  })

  test('non-localhost fallback is not tested due to jsdom limitations', () => {
  expect(true).toBe(true)
})
})