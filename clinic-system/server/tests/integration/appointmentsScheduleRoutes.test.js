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

  describe('GET /api/appointments/slots', () => {
    test('returns correct default slots for an open weekday', async () => {
      const appointmentBuilder = makeQueryBuilder()
      appointmentBuilder.in.mockResolvedValue({ data: [], error: null })

      setupSupabaseHandlers({
        clinics: makeQueryBuilder({
          data: {
            id: clinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
        }),
        appointments: appointmentBuilder,
      })

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({ clinic_id: clinicId, date: FUTURE_MONDAY })

      expect(res.status).toBe(200)
      expect(res.body.slice(0, 4)).toEqual(['07:30', '07:45', '08:00', '08:15'])
      expect(res.body.at(-1)).toBe('16:15')
    })

    test('excludes already booked appointment times', async () => {
      const appointmentBuilder = makeQueryBuilder()
      appointmentBuilder.in.mockResolvedValue({
        data: [{ slot_id: '123e4567-e89b-12d3-a456-426614174010' }],
        error: null,
      })

      const slotBuilder = makeQueryBuilder()
      slotBuilder.lt.mockResolvedValue({
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174010',
            slot_datetime: `${FUTURE_MONDAY}T05:45:00.000Z`,
          },
        ],
        error: null,
      })

      setupSupabaseHandlers({
        clinics: makeQueryBuilder({
          data: {
            id: clinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
        }),
        appointments: appointmentBuilder,
        slots: slotBuilder,
      })

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({ clinic_id: clinicId, date: FUTURE_MONDAY })

      expect(res.status).toBe(200)
      expect(res.body).toContain('07:30')
      expect(res.body).toContain('07:45')
    })

    test('uses clinic-specific operating hours and appointment duration', async () => {
      const appointmentBuilder = makeQueryBuilder()
      appointmentBuilder.in.mockResolvedValue({ data: [], error: null })

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
        appointments: appointmentBuilder,
      })

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({ clinic_id: clinicId, date: FUTURE_MONDAY })

      expect(res.status).toBe(200)
      expect(res.body).toEqual(['09:10', '09:30', '09:50'])
    })

    test('respects defaults and returns empty array for closed days', async () => {
      setupSupabaseHandlers({
        clinics: makeQueryBuilder({
          data: {
            id: clinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
        }),
      })

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({ clinic_id: clinicId, date: FUTURE_SATURDAY })

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    test('returns 400 when required params are missing', async () => {
      const res = await request(app).get('/api/appointments/slots')

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('clinic_id is required')
    })

    test('returns 400 when date is missing', async () => {
      const res = await request(app)
        .get('/api/appointments/slots')
        .query({ clinic_id: clinicId })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('date is required')
    })

    test('returns 400 when date is in the past', async () => {
      const res = await request(app)
        .get('/api/appointments/slots')
        .query({ clinic_id: clinicId, date: '2020-01-01' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Past dates cannot be used for slot retrieval')
    })

    test('returns 404 when clinic is not found', async () => {
      setupSupabaseHandlers({
        clinics: makeQueryBuilder({ data: null }),
      })

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({ clinic_id: clinicId, date: FUTURE_MONDAY })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Clinic not found')
    })
  })

  describe('POST /api/appointments', () => {
    test('rejects time outside valid clinic slots', async () => {
      setupSupabaseHandlers({
        clinics: makeQueryBuilder({
          data: {
            id: clinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
        }),
      })

      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: clinicId,
          patient_id: patientId,
          date: FUTURE_MONDAY,
          time: '17:00',
          booked_by: bookedBy,
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe(
        'Selected time is outside clinic hours or does not match the appointment duration'
      )
    })

    test('rejects times that are not aligned to 15-minute slots', async () => {
      setupSupabaseHandlers({
        clinics: makeQueryBuilder({
          data: {
            id: clinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
        }),
      })

      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: clinicId,
          patient_id: patientId,
          date: FUTURE_MONDAY,
          time: '07:40',
          booked_by: bookedBy,
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe(
        'Selected time is outside clinic hours or does not match the appointment duration'
      )
    })

    test('accepts times aligned to clinic-specific duration', async () => {
      const slotLookupBuilder = makeQueryBuilder({ data: null })
      const slotInsertBuilder = makeQueryBuilder({
        data: {
          id: '123e4567-e89b-12d3-a456-426614174020',
          slot_datetime: `${FUTURE_MONDAY}T09:30:00.000Z`,
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
      expect(res.body.error).not.toBe(
        'Selected time is outside clinic hours or does not match the appointment duration'
      )
    })

    test('rejects an already booked valid time', async () => {
      const slotLookupBuilder = makeQueryBuilder({
        data: {
          id: '123e4567-e89b-12d3-a456-426614174030',
          slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
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
        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Appointment booked successfully')
    })

    test('stores appointments using slot_id without extra appointment columns', async () => {
      const slotLookupBuilder = makeQueryBuilder({ data: null })
      const slotInsertBuilder = makeQueryBuilder({
        data: {
          id: '123e4567-e89b-12d3-a456-426614174040',
          slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
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