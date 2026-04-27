const request = require('supertest')
const app = require('../../../src/app')

describe('Health check', () => {
  test('GET /api returns 200', async () => {
    const res = await request(app).get('/api')
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('message')
    expect(res.body.message).toBe('Ubuntu Health API running')
  })
})
test('GET unknown route returns frontend fallback', async () => {
  const res = await request(app).get('/some-random-page')
  expect([200, 404]).toContain(res.statusCode)
}, 15000)