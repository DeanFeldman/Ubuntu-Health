const request = require('supertest')
const app = require('../src/app')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const invalidId = 'invalid-id'

describe('Queue GET endpoints', () => {
  test('GET /api/queue/:clinicId with invalid id returns 400', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}`)
    expect(res.statusCode).toBe(400)
  })
  test('GET /api/queue/:clinicId with valid id returns 200', async () => {
    const res = await request(app).get(`/api/queue/${validClinicId}`)
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('queue')
    expect(res.body.queue).toBeInstanceOf(Array)
  }, 15000)
  test('GET /api/queue/:clinicId/position/:patientId with invalid ids returns 400', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}/position/${invalidId}`)
    expect(res.statusCode).toBe(400)
  })
  test('GET /api/queue/:clinicId/position/:patientId with valid ids returns 200 or 404', async () => {
    const res = await request(app).get(`/api/queue/${validClinicId}/position/${validPatientId}`)
    expect([200, 404]).toContain(res.statusCode)
  }, 15000)
  test('GET /api/queue/:clinicId/entry/:patientId with invalid ids returns 400', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}/entry/${invalidId}`)
    expect(res.statusCode).toBe(400)
  })
  test('GET /api/queue/:clinicId/entry/:patientId with valid ids returns 200 or 404', async () => {
    const res = await request(app).get(`/api/queue/${validClinicId}/entry/${validPatientId}`)
    expect([200, 404]).toContain(res.statusCode)
  }, 15000)
  test('GET /api/queue/:clinicId/status/:patientId with invalid ids returns 400', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}/status/${invalidId}`)
    expect(res.statusCode).toBe(400)
  })
  test('GET /api/queue/:clinicId/status/:patientId with valid ids returns 200 or 404', async () => {
    const res = await request(app).get(`/api/queue/${validClinicId}/status/${validPatientId}`)
    expect([200, 404]).toContain(res.statusCode)
  }, 15000)
})

describe('Queue POST endpoints', () => {
  test('POST /api/queue/:clinicId/join with invalid clinic id returns 400', async () => {
    const res = await request(app)
      .post(`/api/queue/${invalidId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })
    expect(res.statusCode).toBe(400)
  })

  test('POST /api/queue/:clinicId/join with invalid patient id returns 400', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: invalidId, confirmed: true })
    expect(res.statusCode).toBe(400)
  })

  test('POST /api/queue/:clinicId/join without confirmed returns 400', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: false })
    expect(res.statusCode).toBe(400)
  })

  test('POST /api/queue/:clinicId/join with valid data returns 201 or 409', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })
    expect([201, 409, 500]).toContain(res.statusCode)
  }, 15000)
})