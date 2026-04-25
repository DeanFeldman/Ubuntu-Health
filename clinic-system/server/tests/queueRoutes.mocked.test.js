const request = require('supertest')

let app
let mockSupabase
let scenario
let createdBuilders = []

/**
 * Returns the next mocked response for a given table/method.
 * If nothing is queued, it returns a safe default.
 */
function getNextResponse(bucket, table, fallback = { data: null, error: null }) {
  if (!bucket[table] || bucket[table].length === 0) {
    return fallback
  }
  return bucket[table].shift()
}

/**
 * Creates a chainable mock builder similar to the Supabase query API.
 * This lets us force specific branches in app.js instead of relying on live DB state.
 */
function makeBuilder(table) {
  const builder = {
    table,

    select: jest.fn(function () {
      return this
    }),

    eq: jest.fn(function () {
      return this
    }),

    neq: jest.fn(function () {
      return this
    }),

    lt: jest.fn(function () {
      return this
    }),

    in: jest.fn(function () {
      return this
    }),

    order: jest.fn(function () {
      return this
    }),

    limit: jest.fn(function () {
      return this
    }),

    insert: jest.fn(function () {
      return this
    }),

    update: jest.fn(function () {
      return this
    }),

    maybeSingle: jest.fn(function () {
      return Promise.resolve(getNextResponse(scenario.maybeSingle, table))
    }),

    single: jest.fn(function () {
      return Promise.resolve(getNextResponse(scenario.single, table))
    }),

    then(resolve, reject) {
      return Promise.resolve(getNextResponse(scenario.thenable, table)).then(
        resolve,
        reject
      )
    },
  }

  createdBuilders.push(builder)
  return builder
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}))

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validQueueEntryId = '00000000-0000-0000-0000-000000000003'
const invalidId = 'invalid-id'

beforeEach(() => {
  jest.resetModules()
  createdBuilders = []

  // Safe env values so app.js can initialise
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

  scenario = {
    maybeSingle: {},
    single: {},
    thenable: {},
  }

  mockSupabase = {
    from: jest.fn((table) => makeBuilder(table)),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  }

  app = require('../src/app')
})

describe('Mocked app.js route branches', () => {
  /**
   * Clinic queue metrics:
   * valid request should return appointment duration and assigned staff count.
   */
  test('GET /api/clinics/:id/queue-metrics returns appointmentDuration and staffCount', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 20,
        },
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 2,
        error: null,
      },
    ]

    const res = await request(app).get(`/api/clinics/${validClinicId}/queue-metrics`)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      appointmentDuration: 20,
      staffCount: 2,
    })

    const clinicBuilder = createdBuilders[0]
    const staffBuilder = createdBuilders[1]

    expect(clinicBuilder.table).toBe('clinics')
    expect(clinicBuilder.select).toHaveBeenCalledWith('appointment_duration_minutes')
    expect(clinicBuilder.eq).toHaveBeenCalledWith('id', validClinicId)

    expect(staffBuilder.table).toBe('users')
    expect(staffBuilder.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    })
    expect(staffBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)
    expect(staffBuilder.in).toHaveBeenCalledWith('role', ['Staff', 'Admin'])
  })

  /**
   * Clinic queue metrics:
   * null duration falls back to 15 and zero staff falls back to 1.
   */
  test('GET /api/clinics/:id/queue-metrics applies duration and staff fallbacks', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: null,
        },
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 0,
        error: null,
      },
    ]

    const res = await request(app).get(`/api/clinics/${validClinicId}/queue-metrics`)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      appointmentDuration: 15,
      staffCount: 1,
    })
  })

  /**
   * Clinic queue metrics:
   * missing clinic returns 404 before querying staff.
   */
  test('GET /api/clinics/:id/queue-metrics returns 404 when clinic is missing', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app).get(`/api/clinics/${validClinicId}/queue-metrics`)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Clinic not found' })
    expect(createdBuilders).toHaveLength(1)
  })

  /**
   * Estimated wait time:
   * valid request should combine queue position, patients ahead, duration, staff count, and wait calculation.
   */
  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId returns the full wait estimate', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 5,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 10,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 4,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 3,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 5,
      patientsAhead: 4,
      appointmentDuration: 10,
      staffCount: 3,
      estimatedWaitTime: 14,
    })

    const positionLookupBuilder = createdBuilders[0]
    const patientsAheadBuilder = createdBuilders[1]
    const clinicMetricsBuilder = createdBuilders[2]
    const staffMetricsBuilder = createdBuilders[3]

    expect(positionLookupBuilder.table).toBe('queue_entries')
    expect(positionLookupBuilder.select).toHaveBeenCalledWith('position')
    expect(positionLookupBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)
    expect(positionLookupBuilder.eq).toHaveBeenCalledWith('patient_id', validPatientId)
    expect(positionLookupBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')

    expect(patientsAheadBuilder.table).toBe('queue_entries')
    expect(patientsAheadBuilder.select).toHaveBeenCalledWith('*', {
      count: 'exact',
      head: true,
    })
    expect(patientsAheadBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)
    expect(patientsAheadBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')
    expect(patientsAheadBuilder.lt).toHaveBeenCalledWith('position', 5)

    expect(clinicMetricsBuilder.table).toBe('clinics')
    expect(staffMetricsBuilder.table).toBe('users')
    expect(staffMetricsBuilder.in).toHaveBeenCalledWith('role', ['Staff', 'Admin'])
  })

  /**
   * Estimated wait time:
   * normal case: 3 patients ahead * 15 minute duration / 3 staff = 15 minutes.
   */
  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId calculates the normal case', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 4,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 15,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 3,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 3,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 4,
      patientsAhead: 3,
      appointmentDuration: 15,
      staffCount: 3,
      estimatedWaitTime: 15,
    })
  })

  /**
   * Estimated wait time:
   * no patients ahead always returns zero.
   */
  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId returns zero when no patients are ahead', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 1,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 15,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 0,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 3,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 1,
      patientsAhead: 0,
      appointmentDuration: 15,
      staffCount: 3,
      estimatedWaitTime: 0,
    })
  })

  /**
   * Estimated wait time:
   * zero staff falls back to one staff member.
   */
  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId falls back to one staff member when staff count is zero', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 4,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 15,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 3,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 0,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 4,
      patientsAhead: 3,
      appointmentDuration: 15,
      staffCount: 1,
      estimatedWaitTime: 45,
    })
  })

  /**
   * Estimated wait time:
   * missing appointment duration falls back to fifteen minutes.
   */
  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId falls back to fifteen minutes when duration is missing', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 4,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: null,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 3,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 3,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 4,
      patientsAhead: 3,
      appointmentDuration: 15,
      staffCount: 3,
      estimatedWaitTime: 15,
    })
  })

  /**
   * Estimated wait time:
   * large queues scale correctly and still round up.
   */
  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId scales for a large queue', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 48,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 20,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 47,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 4,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 48,
      patientsAhead: 47,
      appointmentDuration: 20,
      staffCount: 4,
      estimatedWaitTime: 235,
    })
  })

  /**
   * Estimated wait time:
   * missing waiting queue entry should return 404 and skip duration/staff lookups.
   */
  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId returns 404 when patient is not waiting', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({
      error: 'No active queue entry found for this patient',
    })
    expect(createdBuilders).toHaveLength(1)
  })

  /**
   * Queue position:
   * valid request should return the stored position and count only waiting patients ahead.
   */
  test('GET /api/queue/:clinicId/position/:patientId returns position and patientsAhead', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 4,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 20,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 3,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 2,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/position/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 4,
      patientsAhead: 3,
      estimatedWaitTime: 30,
    })

    const positionLookupBuilder = createdBuilders[0]
    const patientsAheadBuilder = createdBuilders[1]
    const clinicMetricsBuilder = createdBuilders[2]
    const staffMetricsBuilder = createdBuilders[3]

    expect(positionLookupBuilder.table).toBe('queue_entries')
    expect(positionLookupBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')
    expect(positionLookupBuilder.select).toHaveBeenCalledWith('position')

    expect(patientsAheadBuilder.table).toBe('queue_entries')
    expect(patientsAheadBuilder.select).toHaveBeenCalledWith('*', {
      count: 'exact',
      head: true,
    })
    expect(patientsAheadBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)
    expect(patientsAheadBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')
    expect(patientsAheadBuilder.lt).toHaveBeenCalledWith('position', 4)

    expect(clinicMetricsBuilder.table).toBe('clinics')
    expect(staffMetricsBuilder.table).toBe('users')
    expect(staffMetricsBuilder.in).toHaveBeenCalledWith('role', ['Staff', 'Admin'])
  })

  /**
   * Queue position:
   * no patients ahead always returns an estimated wait time of zero.
   */
  test('GET /api/queue/:clinicId/position/:patientId returns zero estimatedWaitTime when nobody is ahead', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 1,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: null,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 0,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 0,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/position/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 1,
      patientsAhead: 0,
      estimatedWaitTime: 0,
      message: 'Estimated wait time may be inaccurate',
    })
  })

  /**
   * Queue position:
   * missing duration defaults to 15 and returns a fallback warning message.
   */
  test('GET /api/queue/:clinicId/position/:patientId defaults missing duration to 15 minutes', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 3,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: null,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 2,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 2,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/position/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 3,
      patientsAhead: 2,
      estimatedWaitTime: 15,
      message: 'Estimated wait time may be inaccurate',
    })
  })

  /**
   * Queue position:
   * missing waiting queue entry should return 404 and skip the count query.
   */
  test('GET /api/queue/:clinicId/position/:patientId returns 404 when no waiting entry exists', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/position/${validPatientId}`
    )

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({
      error: 'No active queue entry found for this patient',
    })
    expect(createdBuilders).toHaveLength(1)
  })

  /**
   * Queue notifications:
   * invalid patient id should take the early validation branch.
   */
  test('GET /api/queue-notifications/:patientId returns 400 for invalid patient id', async () => {
    const res = await request(app).get(`/api/queue-notifications/${invalidId}`)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid patient ID format' })
  })

  /**
   * Queue notifications:
   * invalid queue_entry_id should take the second validation branch.
   */
  test('GET /api/queue-notifications/:patientId returns 400 for invalid queue_entry_id', async () => {
    const res = await request(app).get(
      `/api/queue-notifications/${validPatientId}?queue_entry_id=${invalidId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid queue entry ID format' })
  })

  /**
   * Queue notifications:
   * valid request without queue_entry_id should return notifications normally.
   */
  test('GET /api/queue-notifications/:patientId returns notifications without queue_entry_id filter', async () => {
    scenario.thenable.queue_notifications = [
      {
        data: [
          {
            id: 'notification-1',
            queue_entry_id: validQueueEntryId,
            clinic_id: validClinicId,
            type: 'POSITION_1',
            position: 1,
            created_at: '2026-04-20T10:00:00.000Z',
          },
        ],
        error: null,
      },
    ]

    const res = await request(app).get(`/api/queue-notifications/${validPatientId}`)

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('notifications')
    expect(Array.isArray(res.body.notifications)).toBe(true)
    expect(res.body.notifications).toHaveLength(1)
  })

  /**
   * Queue notifications:
   * valid request with queue_entry_id should hit the optional query branch.
   */
  test('GET /api/queue-notifications/:patientId applies queue_entry_id filter when provided', async () => {
    scenario.thenable.queue_notifications = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue-notifications/${validPatientId}?queue_entry_id=${validQueueEntryId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ notifications: [] })

    const queueNotificationBuilder = createdBuilders.find(
      (builder) => builder.table === 'queue_notifications'
    )

    expect(queueNotificationBuilder).toBeDefined()
    expect(queueNotificationBuilder.eq).toHaveBeenCalledWith(
      'queue_entry_id',
      validQueueEntryId
    )
  })

  /**
   * Queue notifications:
   * database error should hit the catch branch and return 500.
   */
  test('GET /api/queue-notifications/:patientId returns 500 when query fails', async () => {
    scenario.thenable.queue_notifications = [
      {
        data: null,
        error: new Error('Notification query failed'),
      },
    ]

    const res = await request(app).get(`/api/queue-notifications/${validPatientId}`)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch queue notifications' })
  })

  /**
   * Completed count:
   * invalid clinic id should fail validation immediately.
   */
  test('GET /api/queue/:clinicId/completed-count returns 400 for invalid clinic id', async () => {
    const res = await request(app).get(`/api/queue/${invalidId}/completed-count`)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid clinic ID format' })
  })

  /**
   * Completed count:
   * valid request should return the count from Supabase.
   */
  test('GET /api/queue/:clinicId/completed-count returns count successfully', async () => {
    scenario.thenable.queue_entries = [
      {
        count: 4,
        error: null,
      },
    ]

    const res = await request(app).get(`/api/queue/${validClinicId}/completed-count`)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ completedCount: 4 })
  })

  /**
   * Completed count:
   * database error should return 500.
   */
  test('GET /api/queue/:clinicId/completed-count returns 500 on database error', async () => {
    scenario.thenable.queue_entries = [
      {
        count: null,
        error: new Error('Count query failed'),
      },
    ]

    const res = await request(app).get(`/api/queue/${validClinicId}/completed-count`)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch completed count' })
  })

  /**
   * Users:
   * success branch should return the users array.
   */
  test('GET /api/users returns users successfully', async () => {
    scenario.thenable.users = [
      {
        data: [
          {
            id: validPatientId,
            full_name: 'Test Patient',
            phone: '0123456789',
            role: 'Patient',
            clinic_id: null,
          },
        ],
        error: null,
      },
    ]

    const res = await request(app).get('/api/users')

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('users')
    expect(Array.isArray(res.body.users)).toBe(true)
    expect(res.body.users).toHaveLength(1)
  })

  /**
   * Users:
   * error branch should return 500.
   */
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

  /**
   * Add patient:
   * invalid ids should fail validation before database work starts.
   */
  test('POST /api/queue/:clinicId/add-patient returns 400 for invalid clinic id', async () => {
    const res = await request(app)
      .post(`/api/queue/${invalidId}/add-patient`)
      .send({ patient_id: validPatientId })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('POST /api/queue/:clinicId/add-patient returns 400 for invalid patient id', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({ patient_id: invalidId })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  /**
   * Add patient:
   * existing active queue should return conflict.
   */
  test('POST /api/queue/:clinicId/add-patient returns 409 when patient already has active queue entry', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [{ patient_id: validPatientId, status: 'Waiting' }],
        error: null,
      },
    ]

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({ patient_id: validPatientId })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      error: 'Patient already has an active queue entry',
    })
  })

  /**
   * Add patient:
   * insertion failure should return 500.
   */
  test('POST /api/queue/:clinicId/add-patient returns 500 when insert fails', async () => {
    scenario.thenable.queue_entries = [
      // activeQueues lookup
      { data: [], error: null },
      // oldQueue snapshot
      { data: [], error: null },
      // next position query
      { data: [], error: null },
    ]

    scenario.single.queue_entries = [
      { data: null, error: new Error('Insert failed') },
    ]

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({ patient_id: validPatientId })

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to add patient to queue' })
  })

  /**
   * Add patient:
   * success branch should return the new entry and queue notifications.
   */
  test('POST /api/queue/:clinicId/add-patient returns 201 when insert succeeds', async () => {
    scenario.thenable.queue_entries = [
      // activeQueues lookup
      { data: [], error: null },
      // oldQueue snapshot
      { data: [], error: null },
      // next position query
      { data: [], error: null },
      // newQueue snapshot after insert
      { data: [], error: null },
    ]

    scenario.single.queue_entries = [
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

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({ patient_id: validPatientId })

    expect(res.statusCode).toBe(201)
    expect(res.body).toHaveProperty('entry')
    expect(res.body).toHaveProperty('queue_notifications')
    expect(Array.isArray(res.body.queue_notifications)).toBe(true)
  })
})
