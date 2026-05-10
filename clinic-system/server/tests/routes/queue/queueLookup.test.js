const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validQueueEntryId = '00000000-0000-0000-0000-000000000003'
const validAppointmentId = '00000000-0000-0000-0000-000000000004'
const validSlotId = '00000000-0000-0000-0000-000000000005'
const invalidId = 'invalid-id'

let app
let scenario

beforeEach(() => {
  const mockContext = setupMockApp({
    mockQueueNotificationService: false,
  })

  app = mockContext.app
  scenario = mockContext.scenario
})

describe('queue status lookup', () => {
  test('GET /api/queue/:clinicId/status/:patientId returns 400 for invalid clinic id', async () => {
    const res = await request(app).get(
      `/api/queue/${invalidId}/status/${validPatientId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('GET /api/queue/:clinicId/status/:patientId returns 400 for invalid patient id', async () => {
    const res = await request(app).get(
      `/api/queue/${validClinicId}/status/${invalidId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('GET /api/queue/:clinicId/status/:patientId returns active queue status', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          status: 'Waiting',
          position: 2,
          joined_at: '2026-04-20T10:00:00.000Z',
        },
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/status/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      status: 'Waiting',
      position: 2,
      joined_at: '2026-04-20T10:00:00.000Z',
    })
  })

  test('GET /api/queue/:clinicId/status/:patientId returns 404 when no active queue entry exists', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/status/${validPatientId}`
    )

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({
      error: 'No active queue entry found for this patient',
    })
  })

  test('GET /api/queue/:clinicId/status/:patientId returns 500 when lookup fails', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: null,
        error: new Error('Queue status lookup failed'),
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/status/${validPatientId}`
    )

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch queue status' })
  })
})

describe('clinic queue list', () => {
  test('GET /api/queue/:clinicId returns 400 for invalid clinic id', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}`)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid clinic ID format' })
  })

  test('GET /api/queue/:clinicId returns queue with patient names', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: validQueueEntryId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            position: 1,
            status: 'Waiting',
            joined_at: '2026-04-20T10:00:00.000Z',
            called_at: null,
            completed_at: null,
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        data: [
          {
            id: validPatientId,
            full_name: 'Test Patient',
            email: 'patient@example.com',
          },
        ],
        error: null,
      },
    ]

    const res = await request(app).get(`/api/queue/${validClinicId}`)

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('queue')
    expect(res.body.queue).toHaveLength(1)
    expect(res.body.queue[0]).toEqual(
      expect.objectContaining({
        id: validQueueEntryId,
        patient_id: validPatientId,
        position: 1,
        status: 'Waiting',
        patient: {
          full_name: 'Test Patient',
          email: 'patient@example.com',
        },
      })
    )
  })

  test('GET /api/queue/:clinicId includes same-day appointment time for queued patients', async () => {
    const today = new Date().toISOString().slice(0, 10)

    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: validQueueEntryId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            position: 1,
            status: 'Waiting',
            joined_at: '2026-04-20T10:00:00.000Z',
            called_at: null,
            completed_at: null,
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        data: [
          {
            id: validPatientId,
            full_name: 'Test Patient',
            email: 'patient@example.com',
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.appointments = [
      {
        data: [
          {
            id: validAppointmentId,
            patient_id: validPatientId,
            clinic_id: validClinicId,
            slot_id: validSlotId,
            status: 'Waiting',
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.slots = [
      {
        data: [
          {
            id: validSlotId,
            slot_datetime: `${today}T07:45:00.000Z`,
          },
        ],
        error: null,
      },
    ]

    const res = await request(app).get(`/api/queue/${validClinicId}`)

    expect(res.statusCode).toBe(200)
    expect(res.body.queue).toHaveLength(1)
    expect(res.body.queue[0]).toEqual(
      expect.objectContaining({
        id: validQueueEntryId,
        patient_id: validPatientId,
        position: 1,
        status: 'Waiting',
        appointment_time: '09:45',
      })
    )
  })

  test('GET /api/queue/:clinicId returns null appointment time for walk-in queued patients', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: validQueueEntryId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            position: 1,
            status: 'Waiting',
            joined_at: '2026-04-20T10:00:00.000Z',
            called_at: null,
            completed_at: null,
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        data: [
          {
            id: validPatientId,
            full_name: 'Walk In Patient',
            email: 'walkin@example.com',
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.appointments = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(`/api/queue/${validClinicId}`)

    expect(res.statusCode).toBe(200)
    expect(res.body.queue).toHaveLength(1)
    expect(res.body.queue[0]).toEqual(
      expect.objectContaining({
        id: validQueueEntryId,
        patient_id: validPatientId,
        position: 1,
        status: 'Waiting',
        appointment_time: null,
      })
    )
  })

  test('GET /api/queue/:clinicId returns empty queue when no active entries exist', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(`/api/queue/${validClinicId}`)

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('queue')
    expect(res.body.queue).toEqual([])
  })

  test('GET /api/queue/:clinicId returns 500 when queue lookup fails', async () => {
    scenario.thenable.queue_entries = [
      {
        data: null,
        error: new Error('Queue lookup failed'),
      },
    ]

    const res = await request(app).get(`/api/queue/${validClinicId}`)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch clinic queue' })
  })
})

describe('queue entry lookup', () => {
  test('GET /api/queue/:clinicId/entry/:patientId returns 400 for invalid clinic id', async () => {
    const res = await request(app).get(
      `/api/queue/${invalidId}/entry/${validPatientId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('GET /api/queue/:clinicId/entry/:patientId returns 400 for invalid patient id', async () => {
    const res = await request(app).get(
      `/api/queue/${validClinicId}/entry/${invalidId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('GET /api/queue/:clinicId/entry/:patientId returns active queue entry', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          id: validQueueEntryId,
          clinic_id: validClinicId,
          patient_id: validPatientId,
          position: 1,
          status: 'Waiting',
        },
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/entry/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      entry: {
        id: validQueueEntryId,
        clinic_id: validClinicId,
        patient_id: validPatientId,
        position: 1,
        status: 'Waiting',
      },
    })
  })

  test('GET /api/queue/:clinicId/entry/:patientId returns 404 when no active entry exists', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/entry/${validPatientId}`
    )

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({
      error: 'No active queue entry found for this patient',
    })
  })

  test('GET /api/queue/:clinicId/entry/:patientId returns 500 when lookup fails', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: null,
        error: new Error('Entry lookup failed'),
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/entry/${validPatientId}`
    )

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch queue entry' })
  })
})

describe('users list used by queue screens', () => {
  test('GET /api/users returns users successfully', async () => {
    scenario.thenable.users = [
      {
        data: [
          {
            id: validPatientId,
            full_name: 'Test Patient',
            phone: '0123456789',
            email: 'test@example.com',
            role: 'Patient',
            clinic_id: null,
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.patients = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get('/api/users')

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('users')
    expect(Array.isArray(res.body.users)).toBe(true)
    expect(res.body.users).toHaveLength(1)
  })

  test('GET /api/users returns 500 when user query fails', async () => {
    scenario.thenable.users = [
      {
        data: null,
        error: new Error('Users query failed'),
      },
    ]

    const res = await request(app).get('/api/users')

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch users' })
  })
})