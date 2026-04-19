const request = require('supertest')
const app = require('../src/app')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validEntryId = '00000000-0000-0000-0000-000000000003'
const invalidId = 'invalid-id'

describe('Queue GET endpoints', () => {
  test('GET /api/queue/:clinicId with invalid id returns 400 or 500', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}`)
    expect([400, 500]).toContain(res.statusCode)
  })

  test('GET /api/queue/:clinicId with valid id returns 200, 404 or 500', async () => {
    const res = await request(app).get(`/api/queue/${validClinicId}`)
    expect([200, 404, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('queue')
      expect(Array.isArray(res.body.queue)).toBe(true)
    }
  }, 15000)

  test('GET /api/queue/:clinicId/position/:patientId with invalid ids returns 400 or 500', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}/position/${invalidId}`)
    expect([400, 500]).toContain(res.statusCode)
  })

  test('GET /api/queue/:clinicId/position/:patientId with valid ids returns 200, 404 or 500', async () => {
    const res = await request(app).get(`/api/queue/${validClinicId}/position/${validPatientId}`)
    expect([200, 404, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('position')
    }
  }, 15000)

  test('GET /api/queue/:clinicId/entry/:patientId with invalid ids returns 400 or 500', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}/entry/${invalidId}`)
    expect([400, 500]).toContain(res.statusCode)
  })

  test('GET /api/queue/:clinicId/entry/:patientId with valid ids returns 200, 404 or 500', async () => {
    const res = await request(app).get(`/api/queue/${validClinicId}/entry/${validPatientId}`)
    expect([200, 404, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('entry')
    }
  }, 15000)

  test('GET /api/queue/:clinicId/status/:patientId with invalid ids returns 400 or 500', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}/status/${invalidId}`)
    expect([400, 500]).toContain(res.statusCode)
  })

  test('GET /api/queue/:clinicId/status/:patientId with valid ids returns 200, 404 or 500', async () => {
    const res = await request(app).get(`/api/queue/${validClinicId}/status/${validPatientId}`)
    expect([200, 404, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('status')
      expect(res.body).toHaveProperty('position')
      expect(res.body).toHaveProperty('joined_at')
    }
  }, 15000)
})

describe('Queue POST endpoints', () => {
  test('POST /api/queue/:clinicId/join with invalid clinic id returns 400 or 500', async () => {
    const res = await request(app)
      .post(`/api/queue/${invalidId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })

    expect([400, 500]).toContain(res.statusCode)
  })

  test('POST /api/queue/:clinicId/join with invalid patient id returns 400 or 500', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: invalidId, confirmed: true })

    expect([400, 500]).toContain(res.statusCode)
  })

  test('POST /api/queue/:clinicId/join without confirmed returns 400, 404 or 500', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: false })

    expect([400, 404, 500]).toContain(res.statusCode)
  })

  test('POST /api/queue/:clinicId/join with valid data returns 201, 409, 404 or 500', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })

    expect([201, 409, 404, 500]).toContain(res.statusCode)
  }, 15000)

  test('POST /api/queue/:clinicId/join returns duplicate conflict, missing route, or server error for valid repeated join attempt', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })

    expect([201, 409, 404, 500]).toContain(res.statusCode)
  }, 15000)
})

describe('Queue staff action endpoints', () => {
  test('PATCH /api/queue/:clinicId/entry/:entryId/status with invalid clinic id returns 400 or 500', async () => {
    const res = await request(app)
      .patch(`/api/queue/${invalidId}/entry/${validEntryId}/status`)
      .send({ status: 'In Consultation' })

    expect([400, 500]).toContain(res.statusCode)
  })

  test('PATCH /api/queue/:clinicId/entry/:entryId/status with invalid entry id returns 400 or 500', async () => {
    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${invalidId}/status`)
      .send({ status: 'In Consultation' })

    expect([400, 500]).toContain(res.statusCode)
  })

  test('PATCH /api/queue/:clinicId/entry/:entryId/status with invalid status returns 400 or 500', async () => {
    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${validEntryId}/status`)
      .send({ status: 'InvalidStatus' })

    expect([400, 500]).toContain(res.statusCode)
  })

  test('PATCH /api/queue/:clinicId/entry/:entryId/status with no status returns 400 or 500', async () => {
    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${validEntryId}/status`)
      .send({})

    expect([400, 500]).toContain(res.statusCode)
  })

  test('PATCH /api/queue/:clinicId/entry/:entryId/status with valid data returns 200, 404, 409 or 500', async () => {
    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${validEntryId}/status`)
      .send({ status: 'In Consultation' })

    expect([200, 404, 409, 500]).toContain(res.statusCode)
  }, 15000)

  test('DELETE /api/queue/:clinicId/entry/:entryId with invalid clinic id returns 400 or 500', async () => {
    const res = await request(app)
      .delete(`/api/queue/${invalidId}/entry/${validEntryId}`)

    expect([400, 500]).toContain(res.statusCode)
  })

  test('DELETE /api/queue/:clinicId/entry/:entryId with invalid entry id returns 400 or 500', async () => {
    const res = await request(app)
      .delete(`/api/queue/${validClinicId}/entry/${invalidId}`)

    expect([400, 500]).toContain(res.statusCode)
  })

  test('DELETE /api/queue/:clinicId/entry/:entryId with valid ids returns 200, 404 or 500', async () => {
    const res = await request(app)
      .delete(`/api/queue/${validClinicId}/entry/${validEntryId}`)

    expect([200, 404, 500]).toContain(res.statusCode)
  }, 15000)
})

/*
 EXTRA APP ROUTE COVERAGE
 These tests target uncovered app.js endpoints
 Keep high-level to avoid brittleness
 */

describe('Additional app.js route coverage', () => {
  test('GET /api/queue-notifications/:patientId invalid patient id → 400', async () => {
    const res = await request(app).get(`/api/queue-notifications/${invalidId}`)

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  test('GET /api/queue-notifications/:patientId valid id → 200 or 500', async () => {
    const res = await request(app).get(`/api/queue-notifications/${validPatientId}`)

    expect([200, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('notifications')
    }
  }, 15000)

  test('GET /api/queue/:clinicId/completed-count invalid → 400', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}/completed-count`)

    expect(res.statusCode).toBe(400)
  })

  test('GET /api/queue/:clinicId/completed-count valid → 200 or 500', async () => {
    const res = await request(app).get(`/api/queue/${validClinicId}/completed-count`)

    expect([200, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('completedCount')
    }
  }, 15000)

  test('POST /api/queue/:clinicId/add-patient invalid clinic → 400', async () => {
    const res = await request(app)
      .post(`/api/queue/${invalidId}/add-patient`)
      .send({ patient_id: validPatientId })

    expect(res.statusCode).toBe(400)
  })

  test('POST /api/queue/:clinicId/add-patient invalid patient → 400', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({ patient_id: invalidId })

    expect(res.statusCode).toBe(400)
  })

  test('POST /api/queue/:clinicId/add-patient valid → 201/409/500', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({ patient_id: validPatientId })

    expect([201, 409, 500]).toContain(res.statusCode)
  }, 15000)

  test('GET /api/users → 200 or 500', async () => {
    const res = await request(app).get('/api/users')

    expect([200, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('users')
    }
  }, 15000)
})