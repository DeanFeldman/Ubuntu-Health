const request = require('supertest')

let app
let mockSupabase
let scenario
let createdBuilders = []

/**
 * Returns the next mocked response for a given table/method.
 * If nothing is queued, it returns a safe default response.
 */
function getNextResponse(bucket, table, fallback = { data: null, error: null }) {
  if (!bucket[table] || bucket[table].length === 0) {
    return fallback
  }

  return bucket[table].shift()
}

/**
 * Creates a chainable mock builder similar to the Supabase query API.
 * This lets route tests force exact branches in app.js without relying on live DB state.
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

    delete: jest.fn(function () {
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
const validAppointmentId = '00000000-0000-0000-0000-000000000004'
const validSlotId = '00000000-0000-0000-0000-000000000005'

beforeEach(() => {
  jest.resetModules()
  createdBuilders = []

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

  app = require('../../src/app')
})

describe('Queue route tests', () => {
  describe('clinic queue metrics', () => {
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

      const res = await request(app).get(
        `/api/clinics/${validClinicId}/queue-metrics`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        appointmentDuration: 20,
        staffCount: 2,
      })

      const clinicBuilder = createdBuilders[0]
      const staffBuilder = createdBuilders[1]

      expect(clinicBuilder.table).toBe('clinics')
      expect(clinicBuilder.select).toHaveBeenCalledWith(
        'appointment_duration_minutes'
      )
      expect(clinicBuilder.eq).toHaveBeenCalledWith('id', validClinicId)

      expect(staffBuilder.table).toBe('users')
      expect(staffBuilder.select).toHaveBeenCalledWith('id', {
        count: 'exact',
        head: true,
      })
      expect(staffBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)
      expect(staffBuilder.in).toHaveBeenCalledWith('role', ['Staff', 'Admin'])
    })

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

      const res = await request(app).get(
        `/api/clinics/${validClinicId}/queue-metrics`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        appointmentDuration: 15,
        staffCount: 0,
      })
    })

    test('GET /api/clinics/:id/queue-metrics returns 404 when clinic is missing', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/clinics/${validClinicId}/queue-metrics`
      )

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({ error: 'Clinic not found' })
      expect(createdBuilders).toHaveLength(1)
    })
  })

  describe('estimated wait time', () => {
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
      expect(positionLookupBuilder.eq).toHaveBeenCalledWith(
        'clinic_id',
        validClinicId
      )
      expect(positionLookupBuilder.eq).toHaveBeenCalledWith(
        'patient_id',
        validPatientId
      )
      expect(positionLookupBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')

      expect(patientsAheadBuilder.table).toBe('queue_entries')
      expect(patientsAheadBuilder.select).toHaveBeenCalledWith('*', {
        count: 'exact',
        head: true,
      })
      expect(patientsAheadBuilder.eq).toHaveBeenCalledWith(
        'clinic_id',
        validClinicId
      )
      expect(patientsAheadBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')
      expect(patientsAheadBuilder.lt).toHaveBeenCalledWith('position', 5)

      expect(clinicMetricsBuilder.table).toBe('clinics')
      expect(staffMetricsBuilder.table).toBe('users')
      expect(staffMetricsBuilder.in).toHaveBeenCalledWith('role', [
        'Staff',
        'Admin',
      ])
    })

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

    test('GET /api/queue/:clinicId/estimated-wait-time/:patientId returns unavailable when staff count is zero', async () => {
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
        staffCount: 0,
        estimatedWaitTime: null,
        message: 'Estimate not available',
      })
    })

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
  })

  describe('queue position', () => {
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
      expect(positionLookupBuilder.select).toHaveBeenCalledWith('position')
      expect(positionLookupBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')

      expect(patientsAheadBuilder.table).toBe('queue_entries')
      expect(patientsAheadBuilder.select).toHaveBeenCalledWith('*', {
        count: 'exact',
        head: true,
      })
      expect(patientsAheadBuilder.eq).toHaveBeenCalledWith(
        'clinic_id',
        validClinicId
      )
      expect(patientsAheadBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')
      expect(patientsAheadBuilder.lt).toHaveBeenCalledWith('position', 4)

      expect(clinicMetricsBuilder.table).toBe('clinics')
      expect(staffMetricsBuilder.table).toBe('users')
      expect(staffMetricsBuilder.in).toHaveBeenCalledWith('role', [
        'Staff',
        'Admin',
      ])
    })

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
        estimatedWaitTime: null,
        message: 'Estimated wait time may be inaccurate',
      })
    })

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

      const queueEntryBuilder = createdBuilders[0]

      expect(queueEntryBuilder.table).toBe('queue_entries')
      expect(queueEntryBuilder.select).toHaveBeenCalledWith(
        'status, position, joined_at'
      )
      expect(queueEntryBuilder.eq).toHaveBeenCalledWith(
        'clinic_id',
        validClinicId
      )
      expect(queueEntryBuilder.eq).toHaveBeenCalledWith(
        'patient_id',
        validPatientId
      )
      expect(queueEntryBuilder.in).toHaveBeenCalledWith('status', [
        'Waiting',
        'Called',
        'In Consultation',
      ])
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

  describe('queue notifications', () => {
    test('GET /api/queue-notifications/:patientId returns 400 for invalid patient id', async () => {
      const res = await request(app).get(`/api/queue-notifications/${invalidId}`)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid patient ID format' })
    })

    test('GET /api/queue-notifications/:patientId returns 400 for invalid queue_entry_id', async () => {
      const res = await request(app).get(
        `/api/queue-notifications/${validPatientId}?queue_entry_id=${invalidId}`
      )

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid queue entry ID format' })
    })

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

      const res = await request(app).get(
        `/api/queue-notifications/${validPatientId}`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toHaveProperty('notifications')
      expect(Array.isArray(res.body.notifications)).toBe(true)
      expect(res.body.notifications).toHaveLength(1)
    })

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

    test('GET /api/queue-notifications/:patientId returns 500 when query fails', async () => {
      scenario.thenable.queue_notifications = [
        {
          data: null,
          error: new Error('Notification query failed'),
        },
      ]

      const res = await request(app).get(
        `/api/queue-notifications/${validPatientId}`
      )

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to fetch queue notifications',
      })
    })
  })

  describe('queue staff status updates', () => {
    test('PATCH /api/queue/:clinicId/entry/:entryId/status returns 400 for invalid clinic id', async () => {
      const res = await request(app)
        .patch(`/api/queue/${invalidId}/entry/${validQueueEntryId}/status`)
        .send({ status: 'In Consultation' })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid ID format' })
    })

    test('PATCH /api/queue/:clinicId/entry/:entryId/status returns 400 for invalid entry id', async () => {
      const res = await request(app)
        .patch(`/api/queue/${validClinicId}/entry/${invalidId}/status`)
        .send({ status: 'In Consultation' })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid ID format' })
    })

    test('PATCH /api/queue/:clinicId/entry/:entryId/status returns 400 for invalid status value', async () => {
      const res = await request(app)
        .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
        .send({ status: 'InvalidStatus' })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid status value' })
    })

    test('PATCH /api/queue/:clinicId/entry/:entryId/status returns 400 for missing status', async () => {
      const res = await request(app)
        .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
        .send({})

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid status value' })
    })

    test('PATCH /api/queue/:clinicId/entry/:entryId/status returns 404 when entry is missing', async () => {
      scenario.maybeSingle.queue_entries = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
        .send({ status: 'In Consultation' })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({ error: 'Queue entry not found' })
    })

    test('PATCH /api/queue/:clinicId/entry/:entryId/status sends call notification on Waiting to In Consultation', async () => {
      scenario.maybeSingle.queue_entries = [
        {
          data: { status: 'Waiting' },
          error: null,
        },
      ]

      scenario.thenable.queue_entries = [
        {
          data: [
            {
              id: validQueueEntryId,
              clinic_id: validClinicId,
              patient_id: validPatientId,
              position: 1,
              status: 'Waiting',
            },
          ],
          error: null,
        },
        {
          data: [],
          error: null,
        },
        {
          data: [],
          error: null,
        },
        {
          data: [
            {
              id: validQueueEntryId,
              clinic_id: validClinicId,
              patient_id: validPatientId,
              position: 0,
              status: 'In Consultation',
            },
          ],
          error: null,
        },
      ]

      scenario.single.queue_entries = [
        {
          data: {
            id: validQueueEntryId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            position: 0,
            status: 'In Consultation',
          },
          error: null,
        },
      ]

      scenario.single.queue_notifications = [
        {
          data: {
            id: 'queue-notification-1',
            type: 'IN_CONSULTATION',
          },
          error: null,
        },
      ]

      scenario.thenable.notifications = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
        .send({ status: 'In Consultation' })

      expect(res.statusCode).toBe(200)
      expect(res.body.queue_notifications).toEqual([
        {
          id: 'queue-notification-1',
          type: 'IN_CONSULTATION',
        },
      ])

      const queueNotificationBuilder = createdBuilders.find(
        (builder) => builder.table === 'queue_notifications'
      )

      expect(queueNotificationBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          queue_entry_id: validQueueEntryId,
          patient_id: validPatientId,
          clinic_id: validClinicId,
          type: 'IN_CONSULTATION',
          position: null,
        })
      )

      const notificationBuilder = createdBuilders.find(
        (builder) => builder.table === 'notifications'
      )

      expect(notificationBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: validPatientId,
          type: 'queue_alert',
          channel: 'push',
          message:
            'You are being called — please make your way to the consultation room.',
          delivered: false,
        })
      )
    })

    test('PATCH /api/queue/:clinicId/entry/:entryId/status does not notify on In Consultation to Complete', async () => {
      scenario.maybeSingle.queue_entries = [
        {
          data: { status: 'In Consultation' },
          error: null,
        },
      ]

      scenario.thenable.queue_entries = [
        {
          data: [
            {
              id: validQueueEntryId,
              clinic_id: validClinicId,
              patient_id: validPatientId,
              position: 0,
              status: 'In Consultation',
            },
          ],
          error: null,
        },
        {
          data: [],
          error: null,
        },
        {
          data: [],
          error: null,
        },
        {
          data: [],
          error: null,
        },
      ]

      scenario.single.queue_entries = [
        {
          data: {
            id: validQueueEntryId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            position: 0,
            status: 'Complete',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
        .send({ status: 'Complete' })

      expect(res.statusCode).toBe(200)
      expect(res.body.queue_notifications).toEqual([])

      expect(
        createdBuilders.some((builder) => builder.table === 'queue_notifications')
      ).toBe(false)

      expect(
        createdBuilders.some((builder) => builder.table === 'notifications')
      ).toBe(false)
    })
  })

  describe('queue entry deletion', () => {
    test('DELETE /api/queue/:clinicId/entry/:entryId returns 400 for invalid clinic id', async () => {
      const res = await request(app).delete(
        `/api/queue/${invalidId}/entry/${validQueueEntryId}`
      )

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid ID format' })
    })

    test('DELETE /api/queue/:clinicId/entry/:entryId returns 400 for invalid entry id', async () => {
      const res = await request(app).delete(
        `/api/queue/${validClinicId}/entry/${invalidId}`
      )

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid ID format' })
    })

    test('DELETE /api/queue/:clinicId/entry/:entryId returns 404 when entry is missing', async () => {
      scenario.thenable.queue_entries = [
        {
          data: [],
          error: null,
        },
      ]

      scenario.maybeSingle.queue_entries = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app).delete(
        `/api/queue/${validClinicId}/entry/${validQueueEntryId}`
      )

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({ error: 'Queue entry not found' })
    })

    test('DELETE /api/queue/:clinicId/entry/:entryId removes an entry successfully', async () => {
      scenario.thenable.queue_entries = [
        {
          data: [],
          error: null,
        },
        {
          data: null,
          error: null,
        },
        {
          data: [],
          error: null,
        },
      ]

      scenario.maybeSingle.queue_entries = [
        {
          data: {
            id: validQueueEntryId,
          },
          error: null,
        },
      ]

      const res = await request(app).delete(
        `/api/queue/${validClinicId}/entry/${validQueueEntryId}`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        message: 'Patient removed from queue successfully',
        queue_notifications: [],
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('resequence_queue', {
        clinic: validClinicId,
      })
    })
  })

  describe('completed queue count', () => {
    test('GET /api/queue/:clinicId/completed-count returns 400 for invalid clinic id', async () => {
      const res = await request(app).get(
        `/api/queue/${invalidId}/completed-count`
      )

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid clinic ID format' })
    })

    test('GET /api/queue/:clinicId/completed-count returns count successfully', async () => {
      scenario.thenable.queue_entries = [
        {
          count: 4,
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/queue/${validClinicId}/completed-count`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({ completedCount: 4 })
    })

    test('GET /api/queue/:clinicId/completed-count returns 500 on database error', async () => {
      scenario.thenable.queue_entries = [
        {
          count: null,
          error: new Error('Count query failed'),
        },
      ]

      const res = await request(app).get(
        `/api/queue/${validClinicId}/completed-count`
      )

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: 'Failed to fetch completed count' })
    })
  })

  describe('staff add patient to queue', () => {
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

    test('POST /api/queue/:clinicId/add-patient returns 400 when patient_id is missing', async () => {
      const res = await request(app)
        .post(`/api/queue/${validClinicId}/add-patient`)
        .send({})

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid ID format' })
    })

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

    test('POST /api/queue/:clinicId/add-patient returns 500 when insert fails', async () => {
      scenario.thenable.queue_entries = [
        {
          data: [],
          error: null,
        },
        {
          data: [],
          error: null,
        },
        {
          data: [],
          error: null,
        },
      ]

      scenario.single.queue_entries = [
        {
          data: null,
          error: new Error('Insert failed'),
        },
      ]

      const res = await request(app)
        .post(`/api/queue/${validClinicId}/add-patient`)
        .send({ patient_id: validPatientId })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: 'Failed to add patient to queue' })
    })

    test('POST /api/queue/:clinicId/add-patient returns 201 when insert succeeds', async () => {
      scenario.thenable.queue_entries = [
        {
          data: [],
          error: null,
        },
        {
          data: [],
          error: null,
        },
        {
          data: [],
          error: null,
        },
        {
          data: [],
          error: null,
        },
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
  describe('patient joins queue', () => {
  test('POST /api/queue/:clinicId/join returns 400 for invalid clinic id', async () => {
    const res = await request(app)
      .post(`/api/queue/${invalidId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('POST /api/queue/:clinicId/join returns 400 for invalid patient id', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: invalidId, confirmed: true })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('POST /api/queue/:clinicId/join returns 404 when clinic does not exist', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Clinic not found' })
  })

  test('POST /api/queue/:clinicId/join returns 400 when patient has not confirmed', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: { id: validClinicId },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: false })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Queue join must be confirmed by the patient',
    })
  })

  test('POST /api/queue/:clinicId/join returns 409 when patient already has an active queue entry', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: { id: validClinicId },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        data: [
          {
            patient_id: validPatientId,
            clinic_id: validClinicId,
            status: 'Waiting',
          },
        ],
        error: null,
      },
    ]

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      error: 'Patient already has an active queue entry',
    })
  })

  test('POST /api/queue/:clinicId/join returns 201 when queue join succeeds', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: { id: validClinicId },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      // active queue lookup
      {
        data: [],
        error: null,
      },
      // old queue snapshot
      {
        data: [],
        error: null,
      },
      // next position lookup
      {
        data: [],
        error: null,
      },
      // new queue snapshot after insert
      {
        data: [],
        error: null,
      },
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
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })

    expect(res.statusCode).toBe(201)
    expect(res.body).toHaveProperty('entry')
    expect(res.body).toHaveProperty('queue_notifications')
    expect(Array.isArray(res.body.queue_notifications)).toBe(true)
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
test('PATCH /api/queue/:clinicId/entry/:entryId/status returns 409 for invalid status transition', async () => {
  scenario.maybeSingle.queue_entries = [
    {
      data: { status: 'Complete' },
      error: null,
    },
  ]

  const res = await request(app)
    .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
    .send({ status: 'Waiting' })

  expect(res.statusCode).toBe(409)
  expect(res.body).toEqual({
    error: 'Invalid status transition from Complete to Waiting',
  })
})
test('POST /api/queue/:clinicId/join returns 409 when insert hits duplicate active queue constraint', async () => {
  scenario.maybeSingle.clinics = [
    {
      data: { id: validClinicId },
      error: null,
    },
  ]

  scenario.thenable.queue_entries = [
    // active queue lookup
    {
      data: [],
      error: null,
    },
    // old queue snapshot
    {
      data: [],
      error: null,
    },
    // next position lookup
    {
      data: [],
      error: null,
    },
  ]

  scenario.single.queue_entries = [
    {
      data: null,
      error: { code: '23505' },
    },
  ]

  const res = await request(app)
    .post(`/api/queue/${validClinicId}/join`)
    .send({ patient_id: validPatientId, confirmed: true })

  expect(res.statusCode).toBe(409)
  expect(res.body).toEqual({
    error: 'Patient already has an active queue entry',
  })
})
test('DELETE /api/queue/:clinicId/entry/:entryId returns 500 when delete fails', async () => {
  scenario.thenable.queue_entries = [
    // oldQueue snapshot
    {
      data: [],
      error: null,
    },
    // delete call
    {
      data: null,
      error: new Error('Delete failed'),
    },
  ]

  scenario.maybeSingle.queue_entries = [
    {
      data: { id: validQueueEntryId },
      error: null,
    },
  ]

  const res = await request(app).delete(
    `/api/queue/${validClinicId}/entry/${validQueueEntryId}`
  )

  expect(res.statusCode).toBe(500)
  expect(res.body).toEqual({ error: 'Failed to remove patient from queue' })
})

test('DELETE /api/queue/:clinicId/entry/:entryId returns 500 when resequence rpc fails', async () => {
  scenario.thenable.queue_entries = [
    // oldQueue snapshot
    {
      data: [],
      error: null,
    },
    // delete call
    {
      data: null,
      error: null,
    },
  ]

  scenario.maybeSingle.queue_entries = [
    {
      data: { id: validQueueEntryId },
      error: null,
    },
  ]

  mockSupabase.rpc = jest.fn(() =>
    Promise.resolve({
      data: null,
      error: new Error('RPC failed'),
    })
  )

  const res = await request(app).delete(
    `/api/queue/${validClinicId}/entry/${validQueueEntryId}`
  )

  expect(res.statusCode).toBe(500)
  expect(res.body).toEqual({ error: 'Failed to remove patient from queue' })
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
test('POST /api/queue/:clinicId/join updates same-day clinic appointment to Waiting and returns appointment time', async () => {
  const today = new Date().toISOString().slice(0, 10)

  scenario.maybeSingle.clinics = [
    {
      data: { id: validClinicId },
      error: null,
    },
  ]

  scenario.thenable.queue_entries = [
    // active queue lookup
    {
      data: [],
      error: null,
    },
    // old queue snapshot
    {
      data: [],
      error: null,
    },
    // next position lookup
    {
      data: [],
      error: null,
    },
    // queue notification snapshot after insert
    {
      data: [],
      error: null,
    },
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

  scenario.thenable.appointments = [
    {
      data: [
        {
          id: validAppointmentId,
          clinic_id: validClinicId,
          slot_id: validSlotId,
          status: 'Confirmed',
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

  scenario.single.appointments = [
    {
      data: {
        id: validAppointmentId,
        clinic_id: validClinicId,
        slot_id: validSlotId,
        status: 'Waiting',
      },
      error: null,
    },
  ]

  const res = await request(app)
    .post(`/api/queue/${validClinicId}/join`)
    .send({ patient_id: validPatientId, confirmed: true })

  expect(res.statusCode).toBe(201)

  expect(res.body.linked_appointment).toEqual({
    id: validAppointmentId,
    status: 'Waiting',
    slot_datetime: `${today}T07:45:00.000Z`,
    appointment_time: '09:45',
  })

  const appointmentUpdateBuilder = createdBuilders.find(
    (builder) =>
      builder.table === 'appointments' && builder.update.mock.calls.length
  )

  expect(appointmentUpdateBuilder.update).toHaveBeenCalledWith({
    status: 'Waiting',
  })

  expect(appointmentUpdateBuilder.eq).toHaveBeenCalledWith(
    'id',
    validAppointmentId
  )
})

test('POST /api/queue/:clinicId/join leaves patients without appointments unaffected', async () => {
  scenario.maybeSingle.clinics = [
    {
      data: { id: validClinicId },
      error: null,
    },
  ]

  scenario.thenable.queue_entries = [
    {
      data: [],
      error: null,
    },
    {
      data: [],
      error: null,
    },
    {
      data: [],
      error: null,
    },
    {
      data: [],
      error: null,
    },
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

  scenario.thenable.appointments = [
    {
      data: [],
      error: null,
    },
  ]

  const res = await request(app)
    .post(`/api/queue/${validClinicId}/join`)
    .send({ patient_id: validPatientId, confirmed: true })

  expect(res.statusCode).toBe(201)
  expect(res.body.linked_appointment).toBeNull()

  const appointmentUpdateBuilder = createdBuilders.find(
    (builder) =>
      builder.table === 'appointments' && builder.update.mock.calls.length
  )

  expect(appointmentUpdateBuilder).toBeUndefined()
})

test('POST /api/queue/:clinicId/join does not modify appointments from a different clinic', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const otherClinicId = '00000000-0000-0000-0000-000000000099'

  scenario.maybeSingle.clinics = [
    {
      data: { id: validClinicId },
      error: null,
    },
  ]

  scenario.thenable.queue_entries = [
    {
      data: [],
      error: null,
    },
    {
      data: [],
      error: null,
    },
    {
      data: [],
      error: null,
    },
    {
      data: [],
      error: null,
    },
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

  scenario.thenable.appointments = [
    {
      data: [
        {
          id: validAppointmentId,
          clinic_id: otherClinicId,
          slot_id: validSlotId,
          status: 'Confirmed',
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

  const res = await request(app)
    .post(`/api/queue/${validClinicId}/join`)
    .send({ patient_id: validPatientId, confirmed: true })

  expect(res.statusCode).toBe(201)
  expect(res.body.linked_appointment).toBeNull()

  const appointmentUpdateBuilder = createdBuilders.find(
    (builder) =>
      builder.table === 'appointments' && builder.update.mock.calls.length
  )

  expect(appointmentUpdateBuilder).toBeUndefined()
})

test('POST /api/queue/:clinicId/join does not modify appointments from a different day', async () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDate = tomorrow.toISOString().slice(0, 10)

  scenario.maybeSingle.clinics = [
    {
      data: { id: validClinicId },
      error: null,
    },
  ]

  scenario.thenable.queue_entries = [
    {
      data: [],
      error: null,
    },
    {
      data: [],
      error: null,
    },
    {
      data: [],
      error: null,
    },
    {
      data: [],
      error: null,
    },
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

  scenario.thenable.appointments = [
    {
      data: [
        {
          id: validAppointmentId,
          clinic_id: validClinicId,
          slot_id: validSlotId,
          status: 'Confirmed',
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
          slot_datetime: `${tomorrowDate}T07:45:00.000Z`,
        },
      ],
      error: null,
    },
  ]

  const res = await request(app)
    .post(`/api/queue/${validClinicId}/join`)
    .send({ patient_id: validPatientId, confirmed: true })

  expect(res.statusCode).toBe(201)
  expect(res.body.linked_appointment).toBeNull()

  const appointmentUpdateBuilder = createdBuilders.find(
    (builder) =>
      builder.table === 'appointments' && builder.update.mock.calls.length
  )

  expect(appointmentUpdateBuilder).toBeUndefined()
})

test('POST /api/queue/:clinicId/join still succeeds if linked appointment status update fails', async () => {
  const today = new Date().toISOString().slice(0, 10)

  scenario.maybeSingle.clinics = [
    {
      data: { id: validClinicId },
      error: null,
    },
  ]

  scenario.thenable.queue_entries = [
    {
      data: [],
      error: null,
    },
    {
      data: [],
      error: null,
    },
    {
      data: [],
      error: null,
    },
    {
      data: [],
      error: null,
    },
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

  scenario.thenable.appointments = [
    {
      data: [
        {
          id: validAppointmentId,
          clinic_id: validClinicId,
          slot_id: validSlotId,
          status: 'Confirmed',
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

  scenario.single.appointments = [
    {
      data: null,
      error: new Error('Appointment update failed'),
    },
  ]

  const res = await request(app)
    .post(`/api/queue/${validClinicId}/join`)
    .send({ patient_id: validPatientId, confirmed: true })

  expect(res.statusCode).toBe(201)
  expect(res.body.linked_appointment).toBeNull()
})
})