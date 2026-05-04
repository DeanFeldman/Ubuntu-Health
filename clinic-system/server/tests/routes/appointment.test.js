const request = require('supertest')

let app
let mockSupabase
let scenario
let createdBuilders = []

/**
 * Returns the next mocked response for a given table/method.
 * If no response is queued, it returns a safe default.
 */
function getNextResponse(bucket, table, fallback = { data: null, error: null }) {
  if (!bucket[table] || bucket[table].length === 0) {
    return fallback
  }

  return bucket[table].shift()
}

/**
 * Creates a chainable mock builder similar to Supabase's query API.
 * This lets route tests force exact API branches without relying on a real DB.
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

jest.mock('../../src/queueNotificationService', () => ({
  configureQueueNotificationService: jest.fn(),
  checkAndTriggerNotifications: jest.fn(() => []),
}))

const validAppointmentId = '00000000-0000-0000-0000-000000000010'
const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validSlotId = '00000000-0000-0000-0000-000000000020'
const invalidId = 'invalid-id'

const FUTURE_MONDAY = '2099-05-11'

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
  }

  app = require('../../src/app')
})

describe('Appointment route tests', () => {
  describe('PATCH /api/appointments/:id/status', () => {
    test('returns 400 for invalid appointment id', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${invalidId}/status`)
        .send({ status: 'Completed' })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid appointment ID format' })
    })

    test('returns 400 for invalid appointment status', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/status`)
        .send({ status: 'Confirmed' })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid appointment status' })
    })

    test('returns 404 when appointment is not found', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/status`)
        .send({ status: 'Completed' })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({ error: 'Appointment not found' })
    })

    test('returns 409 when appointment is already completed', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            status: 'Completed',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/status`)
        .send({ status: 'Completed' })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({
        error: 'Appointment is already Completed',
      })
    })

    test('marks appointment as Completed successfully', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            status: 'Confirmed',
          },
          error: null,
        },
      ]

      scenario.single.appointments = [
        {
          data: {
            id: validAppointmentId,
            status: 'Completed',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/status`)
        .send({ status: 'Completed' })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        message: 'Appointment marked as Completed',
        appointment: {
          id: validAppointmentId,
          status: 'Completed',
        },
      })
    })

    test('normalizes legacy Complete status to Completed', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            status: 'Confirmed',
          },
          error: null,
        },
      ]

      scenario.single.appointments = [
        {
          data: {
            id: validAppointmentId,
            status: 'Completed',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/status`)
        .send({ status: 'Complete' })

      expect(res.statusCode).toBe(200)
      expect(res.body.message).toBe('Appointment marked as Completed')

      const updateBuilder = createdBuilders.find(
        (builder) => builder.table === 'appointments' && builder.update.mock.calls.length
      )

      expect(updateBuilder.update).toHaveBeenCalledWith({ status: 'Completed' })
    })

    test('returns 500 when appointment lookup fails', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: null,
          error: new Error('Appointment lookup failed'),
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/status`)
        .send({ status: 'Completed' })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: 'Failed to update appointment status' })
    })
  })

  describe('PATCH /api/appointments/:id/reschedule', () => {
    test('returns 400 for invalid appointment id', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${invalidId}/reschedule`)
        .send({
          date: FUTURE_MONDAY,
          time: '07:45',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid appointment ID format' })
    })

    test('returns 400 when date or time is missing', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'date and time are required' })
    })

    test('returns 400 for invalid date or time format', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          date: FUTURE_MONDAY,
          time: 'bad-time',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid date or time format' })
    })

    test('returns 404 when appointment is not found', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          date: FUTURE_MONDAY,
          time: '07:45',
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({ error: 'Appointment not found' })
    })

    test('returns 409 when appointment is already cancelled', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: validSlotId,
            status: 'Cancelled',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          date: FUTURE_MONDAY,
          time: '07:45',
        })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({
        error: 'Cannot reschedule an appointment that is Cancelled',
      })
    })

    test('returns 404 when appointment clinic is not found', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: validSlotId,
            status: 'Confirmed',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          date: FUTURE_MONDAY,
          time: '07:45',
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({ error: 'Clinic not found' })
    })

    test('returns 400 when selected time is outside generated slots', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: validSlotId,
            status: 'Confirmed',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: {
            id: validClinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          date: FUTURE_MONDAY,
          time: '17:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error:
          'Selected time is outside clinic hours or does not match the appointment duration',
      })
    })

    test('returns 409 when selected slot is already fully booked', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: validSlotId,
            status: 'Confirmed',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: {
            id: validClinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.slots = [
        {
          data: {
            id: validSlotId,
            slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
          },
          error: null,
        },
      ]

      scenario.thenable.users = [
        {
          count: 1,
          error: null,
        },
      ]

      scenario.thenable.appointments = [
        {
          data: [
            {
              id: 'another-appointment',
            },
          ],
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          date: FUTURE_MONDAY,
          time: '07:45',
        })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({ error: 'This slot is already booked' })
    })

    test('reschedules appointment successfully', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: validSlotId,
            status: 'Confirmed',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: {
            id: validClinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.slots = [
        {
          data: {
            id: validSlotId,
            slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
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

      scenario.thenable.appointments = [
        {
          data: [],
          error: null,
        },
      ]

      scenario.single.appointments = [
        {
          data: {
            id: validAppointmentId,
            slot_id: validSlotId,
            status: 'Confirmed',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          date: FUTURE_MONDAY,
          time: '07:45',
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        message: 'Appointment rescheduled successfully',
        appointment: {
          id: validAppointmentId,
          slot_id: validSlotId,
          status: 'Confirmed',
        },
      })

      const updateBuilder = createdBuilders.find(
        (builder) => builder.table === 'appointments' && builder.update.mock.calls.length
      )

      expect(updateBuilder.update).toHaveBeenCalledWith({
        slot_id: validSlotId,
        status: 'Confirmed',
      })
    })
  })

  describe('PATCH /api/appointments/:id/cancel', () => {
    test('returns 400 for invalid appointment id', async () => {
      const res = await request(app).patch(
        `/api/appointments/${invalidId}/cancel`
      )

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid appointment ID format' })
    })

    test('returns 404 when appointment is not found', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app).patch(
        `/api/appointments/${validAppointmentId}/cancel`
      )

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({ error: 'Appointment not found' })
    })

    test('returns 409 when appointment is already cancelled', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            status: 'Cancelled',
          },
          error: null,
        },
      ]

      const res = await request(app).patch(
        `/api/appointments/${validAppointmentId}/cancel`
      )

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({ error: 'Appointment is already cancelled' })
    })

    test('returns 409 when appointment is already completed', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            status: 'Completed',
          },
          error: null,
        },
      ]

      const res = await request(app).patch(
        `/api/appointments/${validAppointmentId}/cancel`
      )

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({
        error: 'Cannot cancel an appointment that is Completed',
      })
    })

    test('cancels appointment successfully', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            status: 'Confirmed',
          },
          error: null,
        },
      ]

      scenario.single.appointments = [
        {
          data: {
            id: validAppointmentId,
            status: 'Cancelled',
          },
          error: null,
        },
      ]

      const res = await request(app).patch(
        `/api/appointments/${validAppointmentId}/cancel`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        message: 'Appointment cancelled successfully',
        appointment: {
          id: validAppointmentId,
          status: 'Cancelled',
        },
      })

      const updateBuilder = createdBuilders.find(
        (builder) => builder.table === 'appointments' && builder.update.mock.calls.length
      )

      expect(updateBuilder.update).toHaveBeenCalledWith({
        status: 'Cancelled',
      })
    })

    test('returns 500 when appointment lookup fails', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: null,
          error: new Error('Appointment lookup failed'),
        },
      ]

      const res = await request(app).patch(
        `/api/appointments/${validAppointmentId}/cancel`
      )

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: 'Failed to cancel appointment' })
    })
  })
    describe('GET /api/appointments/patient/:patientId', () => {
    test('returns 400 for invalid patient id', async () => {
      const res = await request(app).get('/api/appointments/patient/invalid-id')

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid patient ID format' })
    })

    test('returns empty appointments array when patient has no appointments', async () => {
      scenario.thenable.appointments = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/appointments/patient/${validPatientId}`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({ appointments: [] })
    })

    test('returns upcoming patient appointments with clinic and slot details', async () => {
      scenario.thenable.appointments = [
        {
          data: [
            {
              id: validAppointmentId,
              patient_id: validPatientId,
              clinic_id: validClinicId,
              slot_id: validSlotId,
              status: 'Confirmed',
              service: 'General Consultation',
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
              slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
            },
          ],
          error: null,
        },
      ]

      scenario.thenable.clinics = [
        {
          data: [
            {
              id: validClinicId,
              name: 'Ubuntu Clinic',
            },
          ],
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/appointments/patient/${validPatientId}`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body.appointments).toEqual([
        {
          id: validAppointmentId,
          patient_id: validPatientId,
          clinic_id: validClinicId,
          slot_id: validSlotId,
          status: 'Confirmed',
          service: 'General Consultation',
          clinic_name: 'Ubuntu Clinic',
          slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
        },
      ])
    })

    test('returns 500 when patient appointments lookup fails', async () => {
      scenario.thenable.appointments = [
        {
          data: null,
          error: new Error('Appointments lookup failed'),
        },
      ]

      const res = await request(app).get(
        `/api/appointments/patient/${validPatientId}`
      )

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to fetch patient appointments',
      })
    })
  })
    describe('GET /api/appointments/clinic/:clinicId', () => {
    test('returns 400 for invalid clinic id', async () => {
      const res = await request(app).get(
        `/api/appointments/clinic/${invalidId}?date=${FUTURE_MONDAY}`
      )

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid clinic ID format' })
    })

    test('returns 400 when date query is missing', async () => {
      const res = await request(app).get(
        `/api/appointments/clinic/${validClinicId}`
      )

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Date is required' })
    })

    test('returns empty appointments array when clinic has no appointments', async () => {
      scenario.thenable.appointments = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/appointments/clinic/${validClinicId}?date=${FUTURE_MONDAY}`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({ appointments: [] })
    })

    test('returns clinic appointments for the requested date with patient details', async () => {
      scenario.thenable.appointments = [
        {
          data: [
            {
              id: validAppointmentId,
              patient_id: validPatientId,
              clinic_id: validClinicId,
              slot_id: validSlotId,
              status: 'Confirmed',
              service: 'General Consultation',
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
              slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
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

      scenario.thenable.patients = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/appointments/clinic/${validClinicId}?date=${FUTURE_MONDAY}`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body.appointments).toEqual([
        {
          id: validAppointmentId,
          patient_id: validPatientId,
          clinic_id: validClinicId,
          slot_id: validSlotId,
          status: 'Confirmed',
          service: 'General Consultation',
          slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
          patient: {
            id: validPatientId,
            full_name: 'Test Patient',
            email: 'patient@example.com',
          },
        },
      ])
    })

    test('returns 500 when clinic appointments lookup fails', async () => {
      scenario.thenable.appointments = [
        {
          data: null,
          error: new Error('Appointments lookup failed'),
        },
      ]

      const res = await request(app).get(
        `/api/appointments/clinic/${validClinicId}?date=${FUTURE_MONDAY}`
      )

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to fetch clinic appointments',
      })
    })
  })
  
})