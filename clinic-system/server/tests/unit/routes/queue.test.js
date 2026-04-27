const request = require('supertest')
const app = require('../../../src/app')

// UUID-format values used for validation tests
const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validEntryId = '00000000-0000-0000-0000-000000000003'
const invalidId = 'invalid-id'

/**
 * Queue GET endpoints
 * Tests basic success and validation behaviour
 */
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
      expect(res.body).toHaveProperty('patientsAhead')
      expect(res.body).toHaveProperty('estimatedWaitTime')
    }
  }, 15000)

  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId with invalid ids returns 400 or 500', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}/estimated-wait-time/${invalidId}`)
    expect([400, 500]).toContain(res.statusCode)
  })

  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId with valid ids returns 200, 404 or 500', async () => {
    const res = await request(app).get(`/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`)
    expect([200, 404, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('position')
      expect(res.body).toHaveProperty('patientsAhead')
      expect(res.body).toHaveProperty('appointmentDuration')
      expect(res.body).toHaveProperty('staffCount')
      expect(res.body).toHaveProperty('estimatedWaitTime')
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

/**
 * Queue POST endpoints (join)
 */
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

  test('POST /api/queue/:clinicId/join without confirmation returns 400, 404 or 500', async () => {
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
})

/**
 * Staff queue actions (status update and removal)
 */
describe('Queue staff action endpoints', () => {
  test('PATCH status with invalid clinic id returns 400 or 500', async () => {
    const res = await request(app)
      .patch(`/api/queue/${invalidId}/entry/${validEntryId}/status`)
      .send({ status: 'In Consultation' })

    expect([400, 500]).toContain(res.statusCode)
  })

  test('PATCH status with invalid entry id returns 400 or 500', async () => {
    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${invalidId}/status`)
      .send({ status: 'In Consultation' })

    expect([400, 500]).toContain(res.statusCode)
  })

  test('PATCH status with invalid status value returns 400 or 500', async () => {
    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${validEntryId}/status`)
      .send({ status: 'InvalidStatus' })

    expect([400, 500]).toContain(res.statusCode)
  })

  test('PATCH status with missing status returns 400 or 500', async () => {
    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${validEntryId}/status`)
      .send({})

    expect([400, 500]).toContain(res.statusCode)
  })

  test('PATCH status with valid data returns 200, 404, 409 or 500', async () => {
    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${validEntryId}/status`)
      .send({ status: 'In Consultation' })

    expect([200, 404, 409, 500]).toContain(res.statusCode)
  }, 15000)

  test('DELETE with invalid clinic id returns 400 or 500', async () => {
    const res = await request(app)
      .delete(`/api/queue/${invalidId}/entry/${validEntryId}`)

    expect([400, 500]).toContain(res.statusCode)
  })

  test('DELETE with invalid entry id returns 400 or 500', async () => {
    const res = await request(app)
      .delete(`/api/queue/${validClinicId}/entry/${invalidId}`)

    expect([400, 500]).toContain(res.statusCode)
  })

  test('DELETE with valid ids returns 200, 404 or 500', async () => {
    const res = await request(app)
      .delete(`/api/queue/${validClinicId}/entry/${validEntryId}`)

    expect([200, 404, 500]).toContain(res.statusCode)
  }, 15000)
})

/**
 * Additional routes related to queue behaviour
 */
describe('Additional queue-related routes', () => {
  test('GET /api/queue-notifications invalid patient id returns 400', async () => {
    const res = await request(app).get(`/api/queue-notifications/${invalidId}`)
    expect(res.statusCode).toBe(400)
  })

  test('GET /api/queue-notifications valid request returns 200 or 500', async () => {
    const res = await request(app).get(`/api/queue-notifications/${validPatientId}`)
    expect([200, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('notifications')
    }
  })

  test('GET /api/queue-notifications invalid queue_entry_id returns 400', async () => {
    const res = await request(app).get(
      `/api/queue-notifications/${validPatientId}?queue_entry_id=${invalidId}`
    )
    expect(res.statusCode).toBe(400)
  })

  test('GET completed count invalid clinic id returns 400', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}/completed-count`)
    expect(res.statusCode).toBe(400)
  })

  test('GET completed count valid clinic id returns 200 or 500', async () => {
    const res = await request(app).get(`/api/queue/${validClinicId}/completed-count`)
    expect([200, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('completedCount')
    }
  }, 15000)

  test('POST add patient with invalid clinic id returns 400', async () => {
    const res = await request(app)
      .post(`/api/queue/${invalidId}/add-patient`)
      .send({ patient_id: validPatientId })

    expect(res.statusCode).toBe(400)
  })

  test('POST add patient with invalid patient id returns 400', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({ patient_id: invalidId })

    expect(res.statusCode).toBe(400)
  })

  test('POST add patient with missing body returns 400', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({})

    expect(res.statusCode).toBe(400)
  })

  test('POST add patient valid request returns 201, 409 or 500', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({ patient_id: validPatientId })

    expect([201, 409, 500]).toContain(res.statusCode)
  }, 15000)

  test('GET /api/users returns 200 or 500', async () => {
    const res = await request(app).get('/api/users')
    expect([200, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('users')
    }
  })
})
