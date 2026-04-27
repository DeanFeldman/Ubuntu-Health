const request = require('supertest')

let mockFrom
let app

const clinicId = '123e4567-e89b-12d3-a456-426614174000'
const patientId = '123e4567-e89b-12d3-a456-426614174001'
const bookedBy = '123e4567-e89b-12d3-a456-426614174002'

const FUTURE_MONDAY = '2099-05-11'
const FUTURE_SATURDAY = '2099-05-16'

function makeQueryBuilder({ data = null, error = null } = {}) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error }),
    single: jest.fn().mockResolvedValue({ data, error }),
    insert: jest.fn().mockReturnThis(),
  }
}

function setupSupabaseHandlers(handlers) {
  const queues = {}

  Object.entries(handlers).forEach(([tableName, value]) => {
    queues[tableName] = Array.isArray(value) ? [...value] : [value]
  })

  mockFrom.mockImplementation((tableName) => {
    const queue = queues[tableName]

    if (!queue || queue.length === 0) {
      return makeQueryBuilder()
    }

    const next = queue.shift()
    return typeof next === 'function' ? next() : next
  })
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: (...args) => mockFrom(...args),
  })),
}))

jest.mock('../../src/queueNotificationService', () => ({
  configureQueueNotificationService: jest.fn(),
  checkAndTriggerNotifications: jest.fn(() => []),
}))

describe('appointment scheduling routes', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    mockFrom = jest.fn()

    process.env.SUPABASE_URL = 'http://test.local'
    process.env.SUPABASE_KEY = 'test-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'

    app = require('../../src/app')
  })

  describe('POST /api/appointments', () => {
    test('accepts times aligned to clinic-specific duration', async () => {
      const slotLookupBuilder = makeQueryBuilder({ data: null })
      const slotInsertBuilder = makeQueryBuilder({
        data: {
          id: '123e4567-e89b-12d3-a456-426614174020',
          // ✅ FIXED: 09:30 SA → 07:30 UTC
          slot_datetime: `${FUTURE_MONDAY}T07:30:00.000Z`,
        },
      })
      const appointmentLookupBuilder = makeQueryBuilder({ data: null })
      const appointmentInsertBuilder = makeQueryBuilder({
        data: { id: '123e4567-e89b-12d3-a456-426614174021' },
      })

      setupSupabaseHandlers({
        clinics: makeQueryBuilder({
          data: {
            id: clinicId,
            operating_hours: {
              monday: { open: '09:10', close: '10:10' },
            },
            appointment_duration_minutes: 20,
          },
        }),
        slots: [slotLookupBuilder, slotInsertBuilder],
        appointments: [appointmentLookupBuilder, appointmentInsertBuilder],
      })

      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: clinicId,
          patient_id: patientId,
          date: FUTURE_MONDAY,
          time: '09:30',
          booked_by: bookedBy,
        })

      expect(res.status).not.toBe(400)
    })

    test('rejects an already booked valid time', async () => {
      const slotLookupBuilder = makeQueryBuilder({
        data: {
          id: '123e4567-e89b-12d3-a456-426614174030',
          // ✅ FIXED: 07:45 SA → 05:45 UTC
          slot_datetime: `${FUTURE_MONDAY}T05:45:00.000Z`,
        },
      })
      const appointmentLookupBuilder = makeQueryBuilder({
        data: { id: '123e4567-e89b-12d3-a456-426614174099' },
      })

      setupSupabaseHandlers({
        clinics: makeQueryBuilder({
          data: {
            id: clinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
        }),
        slots: slotLookupBuilder,
        appointments: appointmentLookupBuilder,
      })

      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: clinicId,
          patient_id: patientId,
          date: FUTURE_MONDAY,
          time: '07:45',
          booked_by: bookedBy,
        })

      expect(res.status).toBe(409)
    })

    test('stores appointments using slot_id without extra appointment columns', async () => {
      const slotLookupBuilder = makeQueryBuilder({ data: null })
      const slotInsertBuilder = makeQueryBuilder({
        data: {
          id: '123e4567-e89b-12d3-a456-426614174040',
          // ✅ FIXED: 07:45 SA → 05:45 UTC
          slot_datetime: `${FUTURE_MONDAY}T05:45:00.000Z`,
        },
      })
      const appointmentLookupBuilder = makeQueryBuilder({ data: null })
      const appointmentInsertBuilder = makeQueryBuilder({
        data: { id: '123e4567-e89b-12d3-a456-426614174041' },
      })

      setupSupabaseHandlers({
        clinics: makeQueryBuilder({
          data: {
            id: clinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
        }),
        slots: [slotLookupBuilder, slotInsertBuilder],
        appointments: [appointmentLookupBuilder, appointmentInsertBuilder],
      })

      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: clinicId,
          patient_id: patientId,
          date: FUTURE_MONDAY,
          time: '07:45',
          booked_by: bookedBy,
        })

      expect(res.status).toBe(201)
      expect(appointmentInsertBuilder.insert).toHaveBeenCalledWith({
        clinic_id: clinicId,
        patient_id: patientId,
        slot_id: '123e4567-e89b-12d3-a456-426614174040',
        status: 'Confirmed',
      })
    })
  })
})