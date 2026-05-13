const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validAppointmentId = '00000000-0000-0000-0000-000000000010'
const validSlotId = '00000000-0000-0000-0000-000000000020'
const newSlotId = '00000000-0000-0000-0000-000000000021'
const invalidId = 'invalid-id'

const FUTURE_MONDAY = '2099-05-11'

let app
let scenario
let createdBuilders
let sendAppointmentCancellationEmail
let sendAppointmentRescheduleEmail

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
  sendAppointmentCancellationEmail =
    mockContext.sendAppointmentCancellationEmail
  sendAppointmentRescheduleEmail =
    mockContext.sendAppointmentRescheduleEmail
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
    const weekday = new Date(`${today}T00:00:00`)
      .toLocaleDateString('en-US', {
        weekday: 'long',
      })
      .toLowerCase()

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

  test.each([
    ['Cancelled', 'Cannot reschedule an appointment that is Cancelled'],
    ['Completed', 'Cannot reschedule an appointment that is Completed'],
    ['No-show', 'Cannot reschedule an appointment that is No-show'],
  ])(
    'returns 409 when appointment is %s',
    async (status, expectedError) => {
      scenario.maybeSingle.appointments = [
        {
          data: {
            id: validAppointmentId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: validSlotId,
            status,
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
        error: expectedError,
      })
    }
  )

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
      (builder) => builder.table === 'slots' && builder.update.mock.calls.length
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
      (builder) => builder.table === 'slots' && builder.update.mock.calls.length
    )

    expect(slotUpdateBuilders[0].update).toHaveBeenCalledWith({
      is_available: false,
    })
    expect(slotUpdateBuilders[1].update).toHaveBeenCalledWith({
      is_available: false,
    })
  })
  test('triggers reschedule email after successful appointment reschedule', async () => {
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
        name: 'Ubuntu Clinic',
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
    {
      data: {
        id: validSlotId,
        slot_datetime: `${FUTURE_MONDAY}T06:45:00.000Z`,
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
        clinic_id: validClinicId,
        patient_id: validPatientId,
        slot_id: newSlotId,
        status: 'Confirmed',
        slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
      },
      error: null,
    },
  ]

  scenario.maybeSingle.users = [
    {
      data: {
        email: 'patient@example.com',
        full_name: 'Jane Patient',
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
  expect(sendAppointmentRescheduleEmail).toHaveBeenCalledTimes(1)
  expect(sendAppointmentRescheduleEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      to: 'patient@example.com',
      patientName: 'Jane Patient',
      clinicName: 'Ubuntu Clinic',
      newDate: FUTURE_MONDAY,
      newTime: '07:45',
    })
  )
})

test('does not trigger reschedule email when appointment reschedule fails', async () => {
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
  expect(sendAppointmentRescheduleEmail).not.toHaveBeenCalled()
})

test('still reschedules appointment when reschedule email fails', async () => {
  sendAppointmentRescheduleEmail.mockRejectedValueOnce(
    new Error('SMTP reschedule failed')
  )

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
        name: 'Ubuntu Clinic',
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
    {
      data: {
        id: validSlotId,
        slot_datetime: `${FUTURE_MONDAY}T06:45:00.000Z`,
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
        clinic_id: validClinicId,
        patient_id: validPatientId,
        slot_id: newSlotId,
        status: 'Confirmed',
        slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
      },
      error: null,
    },
  ]

  scenario.maybeSingle.users = [
    {
      data: {
        email: 'patient@example.com',
        full_name: 'Jane Patient',
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
  expect(res.body.message).toBe('Appointment rescheduled successfully')
  expect(sendAppointmentRescheduleEmail).toHaveBeenCalledTimes(1)
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

  test.each([
    ['Completed', 'Cannot cancel an appointment that is Completed'],
    ['No-show', 'Cannot cancel an appointment that is No-show'],
  ])('returns 409 when appointment is %s', async (status, expectedError) => {
    scenario.maybeSingle.appointments = [
      {
        data: {
          id: validAppointmentId,
          status,
        },
        error: null,
      },
    ]

    const res = await request(app).patch(
      `/api/appointments/${validAppointmentId}/cancel`
    )

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      error: expectedError,
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
  test('triggers cancellation email after successful appointment cancellation', async () => {
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

  scenario.single.appointments = [
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

  scenario.maybeSingle.users = [
    {
      data: {
        email: 'patient@example.com',
        full_name: 'Jane Patient',
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

  scenario.maybeSingle.clinics = [
    {
      data: {
        id: validClinicId,
        name: 'Ubuntu Clinic',
      },
      error: null,
    },
  ]

  const res = await request(app).patch(
    `/api/appointments/${validAppointmentId}/cancel`
  )

  expect(res.statusCode).toBe(200)

  expect(sendAppointmentCancellationEmail).toHaveBeenCalledTimes(1)
  expect(sendAppointmentCancellationEmail).toHaveBeenCalledWith({
    to: 'patient@example.com',
    patientName: 'Jane Patient',
    clinicName: 'Ubuntu Clinic',
    date: FUTURE_MONDAY,
    time: '09:45',
  })
})

test('does not trigger cancellation email when appointment cancellation fails', async () => {
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
  expect(sendAppointmentCancellationEmail).not.toHaveBeenCalled()
})

test('still cancels appointment when cancellation email fails', async () => {
  sendAppointmentCancellationEmail.mockRejectedValueOnce(
    new Error('SMTP cancellation failed')
  )

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

  scenario.single.appointments = [
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

  scenario.maybeSingle.users = [
    {
      data: {
        email: 'patient@example.com',
        full_name: 'Jane Patient',
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

  scenario.maybeSingle.clinics = [
    {
      data: {
        id: validClinicId,
        name: 'Ubuntu Clinic',
      },
      error: null,
    },
  ]

  const res = await request(app).patch(
    `/api/appointments/${validAppointmentId}/cancel`
  )

  expect(res.statusCode).toBe(200)
  expect(res.body.message).toBe('Appointment cancelled successfully')
  expect(sendAppointmentCancellationEmail).toHaveBeenCalledTimes(1)
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
      (builder) => builder.table === 'slots' && builder.update.mock.calls.length
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