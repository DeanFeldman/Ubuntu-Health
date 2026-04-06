const request = require('supertest')
const app = require('../src/app')

describe('Health check', () => {
  test('GET /api returns 200', async () => {
    const res = await request(app).get('/api')
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('message')
  })
})
