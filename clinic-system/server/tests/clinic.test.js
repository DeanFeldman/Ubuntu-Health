const request = require('supertest')
const app = require('../src/app')

describe('Clinic endpoints', () => {
  test('GET /clinics returns 200', async () => {
    const res = await request(app).get('/clinics')
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('clinics')
  })

  test('GET /clinics with province filter returns 200', async () => {
    const res = await request(app).get('/clinics?province=Gauteng')
    expect(res.statusCode).toBe(200)
    expect(res.body.clinics).toBeInstanceOf(Array)
  })

 test('GET /clinics/:id with invalid id returns 400', async () => {
  const res = await request(app).get('/clinics/invalid-id')
  expect(res.statusCode).toBe(400)
})
})