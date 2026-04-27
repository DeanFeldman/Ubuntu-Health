const request = require('supertest')
const app = require('../../src/app')

describe('Clinic endpoints', () => {
  test('GET /api/clinics returns 200', async () => {
    const res = await request(app).get('/api/clinics')
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('clinics')
  })

  test('GET /api/clinics with province filter returns 200', async () => {
    const res = await request(app).get('/api/clinics?province=Gauteng')
    expect(res.statusCode).toBe(200)
    expect(res.body.clinics).toBeInstanceOf(Array)
  })

  test('GET /api/clinics/:id with invalid id returns 400', async () => {
    const res = await request(app).get('/api/clinics/invalid-id')
    expect(res.statusCode).toBe(400)
  })
})
test('GET /api/clinics with district filter returns 200', async () => {
  const res = await request(app).get('/api/clinics?district=Test')
  expect(res.statusCode).toBe(200)
  expect(res.body).toHaveProperty('clinics')
})

test('GET /api/clinics with facility_type filter returns 200', async () => {
  const res = await request(app).get('/api/clinics?facility_type=Clinic')
  expect(res.statusCode).toBe(200)
  expect(res.body).toHaveProperty('clinics')
})

test('GET /api/clinics with municipality filter returns 200', async () => {
  const res = await request(app).get('/api/clinics?municipality=Test')
  expect(res.statusCode).toBe(200)
  expect(res.body).toHaveProperty('clinics')
})

test('GET /api/clinics with search filter returns 200', async () => {
  const res = await request(app).get('/api/clinics?search=test')
  expect(res.statusCode).toBe(200)
  expect(res.body).toHaveProperty('clinics')
})

test('GET /api/clinics/:id with valid id returns 200 or 404', async () => {
  const validClinicId = '00000000-0000-0000-0000-000000000001'
  const res = await request(app).get(`/api/clinics/${validClinicId}`)
  expect([200, 404]).toContain(res.statusCode)

  if (res.statusCode === 200) {
    expect(res.body).toHaveProperty('clinic')
  }
}, 15000)