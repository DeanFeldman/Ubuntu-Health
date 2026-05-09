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

    or: jest.fn(function () {
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

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validAppointmentId = '00000000-0000-0000-0000-000000000010'
const validSlotId = '00000000-0000-0000-0000-000000000020'
const newSlotId = '00000000-0000-0000-0000-000000000021'
const invalidId = 'invalid-id'

const FUTURE_MONDAY = '2099-05-11'
const FUTURE_SATURDAY = '2099-05-16'

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
  describe('GET /api/appointments/slots', () => {
    test('returns 400 when clinic_id is missing', async () => {
      const res = await request(app)
        .get('/api/appointments/slots')
        .query({ date: FUTURE_MONDAY })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'clinic_id is required' })
    })


    test('returns 400 for invalid clinic id', async () => {
      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: invalidId,
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid clinic ID format' })
    })

    test('returns 400 when appointment slot date is in the past', async () => {
      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: '2020-01-01',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Past dates cannot be used for slot retrieval',
      })
    })

    test('returns 404 when clinic is not found', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({ error: 'Clinic not found' })
    })

    test('returns available appointment slots for clinic day', async () => {
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

      scenario.thenable.appointments = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toContain('07:30')
      expect(res.body).toContain('07:45')
    })

    test('returns default weekday slots from opening time up to before closing time', async () => {
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

      scenario.thenable.appointments = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body.slice(0, 4)).toEqual(['07:30', '07:45', '08:00', '08:15'])
      expect(res.body.at(-1)).toBe('16:15')
      expect(res.body).not.toContain('16:30')
    })

    test('uses clinic-specific operating hours and appointment duration for slots', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: {
            id: validClinicId,
            operating_hours: {
              monday: { open: '09:10', close: '10:10' },
            },
            appointment_duration_minutes: 20,
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
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual(['09:10', '09:30', '09:50'])
    })

    test('returns empty slots array for closed clinic day', async () => {
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
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: FUTURE_SATURDAY,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual([])
    })

    test('returns 500 when clinic lookup fails', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: null,
          error: new Error('Clinic lookup failed'),
        },
      ]

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: 'Failed to fetch appointment slots' })
    })
    test('removes fully booked appointment slots from available slots', async () => {
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
          slot_id: validSlotId,
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
          //5:30 since DB is 2 hrs behind
          slot_datetime: `${FUTURE_MONDAY}T05:30:00.000Z`,
        },
      ],
      error: null,
    },
  ]

  const res = await request(app)
    .get('/api/appointments/slots')
    .query({
      clinic_id: validClinicId,
      date: FUTURE_MONDAY,
    })

  expect(res.statusCode).toBe(200)
  expect(res.body).not.toContain('07:30')
  expect(res.body).toContain('07:45')
})
test('stores appointment using slot_id without extra appointment columns', async () => {
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
        clinic_id: validClinicId,
        patient_id: validPatientId,
        slot_id: validSlotId,
        status: 'Confirmed',
      },
      error: null,
    },
  ]

  const res = await request(app)
    .post('/api/appointments')
    .send({
      clinic_id: validClinicId,
      patient_id: validPatientId,
      date: FUTURE_MONDAY,
      time: '07:45',
      booked_by: validPatientId,
    })

  expect(res.statusCode).toBe(201)

  const appointmentBuilder = createdBuilders.find(
    (builder) =>
      builder.table === 'appointments' && builder.insert.mock.calls.length
  )

  expect(appointmentBuilder.insert).toHaveBeenCalledTimes(1)
  expect(appointmentBuilder.insert).toHaveBeenCalledWith({
    clinic_id: validClinicId,
    patient_id: validPatientId,
    slot_id: validSlotId,
    status: 'Confirmed',
  })
})
  }
)

  describe('POST /api/appointments', () => {
    test('returns 400 when required booking fields are missing', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: validClinicId,
          patient_id: validPatientId,
          date: FUTURE_MONDAY,
          time: '07:45',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'clinic_id, patient_id, date, time and booked_by are required',
      })
    })

    test('returns 400 for invalid booking IDs', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: invalidId,
          patient_id: validPatientId,
          date: FUTURE_MONDAY,
          time: '07:45',
          booked_by: validPatientId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid ID format' })
    })

    test('returns 400 for invalid booking time format', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: validClinicId,
          patient_id: validPatientId,
          date: FUTURE_MONDAY,
          time: 'bad-time',
          booked_by: validPatientId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid time format' })
    })

    test('returns 404 when booking clinic is not found', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: validClinicId,
          patient_id: validPatientId,
          date: FUTURE_MONDAY,
          time: '07:45',
          booked_by: validPatientId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({ error: 'Clinic not found' })
    })

    test('returns 400 when selected time is outside clinic slots', async () => {
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
        .post('/api/appointments')
        .send({
          clinic_id: validClinicId,
          patient_id: validPatientId,
          date: FUTURE_MONDAY,
          time: '17:00',
          booked_by: validPatientId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error:
          'Selected time is outside clinic hours or does not match the appointment duration',
      })
    })

    test('returns 400 when selected time is not aligned to generated appointment slots', async () => {
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
        .post('/api/appointments')
        .send({
          clinic_id: validClinicId,
          patient_id: validPatientId,
          date: FUTURE_MONDAY,
          time: '07:40',
          booked_by: validPatientId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error:
          'Selected time is outside clinic hours or does not match the appointment duration',
      })
    })

    test('returns 409 when selected appointment slot is fully booked', async () => {
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
              id: 'already-booked-appointment',
            },
          ],
          error: null,
        },
      ]

      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: validClinicId,
          patient_id: validPatientId,
          date: FUTURE_MONDAY,
          time: '07:45',
          booked_by: validPatientId,
        })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({ error: 'This slot is already booked' })
    })

    test('creates appointment successfully using existing slot', async () => {
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
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: validSlotId,
            status: 'Confirmed',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: validClinicId,
          patient_id: validPatientId,
          date: FUTURE_MONDAY,
          time: '07:45',
          booked_by: validPatientId,
        })

      expect(res.statusCode).toBe(201)
      expect(res.body).toEqual({
        message: 'Appointment booked successfully',
        appointment: {
          id: validAppointmentId,
          clinic_id: validClinicId,
          patient_id: validPatientId,
          slot_id: validSlotId,
          status: 'Confirmed',
        },
      })

      const appointmentBuilder = createdBuilders.find(
        (builder) =>
          builder.table === 'appointments' && builder.insert.mock.calls.length
      )

      expect(appointmentBuilder.insert).toHaveBeenCalledWith({
        clinic_id: validClinicId,
        patient_id: validPatientId,
        slot_id: validSlotId,
        status: 'Confirmed',
      })
    })

    test('creates appointment when selected time matches clinic-specific duration', async () => {
      const clinicSpecificSlotId = '00000000-0000-0000-0000-000000000021'

      scenario.maybeSingle.clinics = [
        {
          data: {
            id: validClinicId,
            operating_hours: {
              monday: { open: '09:10', close: '10:10' },
            },
            appointment_duration_minutes: 20,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.slots = [
        {
          data: {
            id: clinicSpecificSlotId,
            slot_datetime: `${FUTURE_MONDAY}T09:30:00.000Z`,
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
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: clinicSpecificSlotId,
            status: 'Confirmed',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: validClinicId,
          patient_id: validPatientId,
          date: FUTURE_MONDAY,
          time: '09:30',
          booked_by: validPatientId,
        })

      expect(res.statusCode).toBe(201)
      expect(res.body.appointment).toEqual({
        id: validAppointmentId,
        clinic_id: validClinicId,
        patient_id: validPatientId,
        slot_id: clinicSpecificSlotId,
        status: 'Confirmed',
      })
    })

    test('returns 500 when appointment insert fails', async () => {
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
          data: null,
          error: new Error('Appointment insert failed'),
        },
      ]

      const res = await request(app)
        .post('/api/appointments')
        .send({
          clinic_id: validClinicId,
          patient_id: validPatientId,
          date: FUTURE_MONDAY,
          time: '07:45',
          booked_by: validPatientId,
        })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: 'Failed to create appointment' })
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

  test('returns all clinic appointments when date query is missing', async () => {
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
      `/api/appointments/clinic/${validClinicId}`
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

    test('marks appointment as No-show successfully', async () => {
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
            status: 'No-show',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/status`)
        .send({ status: 'No-show' })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        message: 'Appointment marked as No-show',
        appointment: {
          id: validAppointmentId,
          status: 'No-show',
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
        (builder) =>
          builder.table === 'appointments' && builder.update.mock.calls.length
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

    test('returns 400 when date is missing', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          time: '07:45',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'date is required' })
    })

    test('returns 400 when time is missing', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'time is required' })
    })

    test('returns 400 for invalid date format', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          date: 'not-a-date',
          time: '07:45',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid date format' })
    })

    test('returns 400 for invalid time format', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          date: FUTURE_MONDAY,
          time: 'bad-time',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid time format' })
    })

    test('returns 400 when reschedule date is in the past', async () => {
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
          date: '2020-01-01',
          time: '07:45',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Cannot book a past time slot' })
    })

    test('returns 400 when reschedule time is earlier today', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const weekday = new Date(`${today}T00:00:00`).toLocaleDateString(
        'en-US',
        { weekday: 'long' }
      ).toLowerCase()

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
            operating_hours: {
              [weekday]: { open: '00:00', close: '23:59' },
            },
            appointment_duration_minutes: 15,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/appointments/${validAppointmentId}/reschedule`)
        .send({
          date: today,
          time: '00:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Cannot book a past time slot' })
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

    test('returns 409 when appointment is completed', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: validSlotId,
            status: 'Completed',
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
        error: 'Cannot reschedule an appointment that is Completed',
      })
    })

    test('returns 409 when appointment is a no-show', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: validSlotId,
            status: 'No-show',
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
        error: 'Cannot reschedule an appointment that is No-show',
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
            id: newSlotId,
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
        {
          count: 0,
          error: null,
        },
        {
          count: 1,
          error: null,
        },
      ]

      scenario.thenable.slots = [
        {
          data: null,
          error: null,
        },
        {
          data: null,
          error: null,
        },
      ]

      scenario.single.appointments = [
        {
          data: {
            id: validAppointmentId,
            slot_id: newSlotId,
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
        success: true,
        message: 'Appointment rescheduled successfully',
        appointment: {
          id: validAppointmentId,
          slot_id: newSlotId,
          status: 'Confirmed',
          slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
        },
        old_slot_id: validSlotId,
        new_slot_id: newSlotId,
      })

      const updateBuilder = createdBuilders.find(
        (builder) =>
          builder.table === 'appointments' && builder.update.mock.calls.length
      )

      expect(updateBuilder.update).toHaveBeenCalledWith({
        slot_id: newSlotId,
        status: 'Confirmed',
      })

      const slotUpdateBuilders = createdBuilders.filter(
        builder => builder.table === 'slots' && builder.update.mock.calls.length
      )

      expect(slotUpdateBuilders[0].update).toHaveBeenCalledWith({
        is_available: true,
      })
      expect(slotUpdateBuilders[1].update).toHaveBeenCalledWith({
        is_available: true,
      })
    })

    test('does not release old slot when another active appointment still uses it and marks full new slot unavailable', async () => {
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
            id: newSlotId,
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
          data: [],
          error: null,
        },
        {
          count: 1,
          error: null,
        },
        {
          count: 1,
          error: null,
        },
      ]

      scenario.thenable.slots = [
        {
          data: null,
          error: null,
        },
        {
          data: null,
          error: null,
        },
      ]

      scenario.single.appointments = [
        {
          data: {
            id: validAppointmentId,
            slot_id: newSlotId,
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

      const slotUpdateBuilders = createdBuilders.filter(
        builder => builder.table === 'slots' && builder.update.mock.calls.length
      )

      expect(slotUpdateBuilders[0].update).toHaveBeenCalledWith({
        is_available: false,
      })
      expect(slotUpdateBuilders[1].update).toHaveBeenCalledWith({
        is_available: false,
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

    test('returns 409 when appointment is no-show', async () => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            status: 'No-show',
          },
          error: null,
        },
      ]

      const res = await request(app).patch(
        `/api/appointments/${validAppointmentId}/cancel`
      )

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({
        error: 'Cannot cancel an appointment that is No-show',
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
        (builder) =>
          builder.table === 'appointments' && builder.update.mock.calls.length
      )

      expect(updateBuilder.update).toHaveBeenCalledWith({
        status: 'Cancelled',
      })
    })
          test('releases appointment slot when cancellation succeeds', async () => {
  scenario.maybeSingle.appointments = [
    {
      data: {
        id: validAppointmentId,
        clinic_id: validClinicId,
        slot_id: validSlotId,
        status: 'Confirmed',
      },
      error: null,
    },
  ]

  scenario.single.appointments = [
    {
      data: {
        id: validAppointmentId,
        clinic_id: validClinicId,
        slot_id: validSlotId,
        status: 'Cancelled',
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
      count: 0,
      error: null,
    },
  ]

  scenario.thenable.slots = [
    {
      data: null,
      error: null,
    },
  ]

  const res = await request(app).patch(
    `/api/appointments/${validAppointmentId}/cancel`
  )

  expect(res.statusCode).toBe(200)

  const slotUpdateBuilder = createdBuilders.find(
    builder => builder.table === 'slots' && builder.update.mock.calls.length
  )

  expect(slotUpdateBuilder.update).toHaveBeenCalledWith({
    is_available: true,
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
})
