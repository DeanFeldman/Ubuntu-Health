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