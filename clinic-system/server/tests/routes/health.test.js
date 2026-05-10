const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

let app

beforeEach(() => {
  const mockContext = setupMockApp()
  app = mockContext.app
})

describe('Health check', () => {
  test('GET /api returns API health message', async () => {
    const res = await request(app).get('/api')

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      message: 'Ubuntu Health API running',
    })
  })

  test('GET unknown route returns frontend fallback or 404', async () => {
    const res = await request(app).get('/some-random-page')

    expect([200, 404]).toContain(res.statusCode)
  })
})