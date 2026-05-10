const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validAppointmentId = '00000000-0000-0000-0000-000000000010'
const validSlotId = '00000000-0000-0000-0000-000000000020'
const invalidId = 'invalid-id'

const FUTURE_MONDAY = '2099-05-11'

let app
let scenario
let createdBuilders
let sendAppointmentConfirmationEmail

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
  sendAppointmentConfirmationEmail =
    mockContext.sendAppointmentConfirmationEmail
})

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

  test('returns 409 when booking clinic has no assigned staff', async () => {
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
        count: 0,
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
    expect(res.body).toEqual({
      error: 'Appointments are not currently available for this clinic',
    })
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

  test('triggers confirmation email after successful booking', async () => {
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

    scenario.maybeSingle.users = [
      {
        data: {
          id: validPatientId,
          role: 'Patient',
          clinic_id: null,
        },
        error: null,
      },
      {
        data: {
          email: 'patient@example.com',
          full_name: 'Jane Patient',
        },
        error: null,
      },
    ]

    const response = await request(app)
      .post('/api/appointments')
      .send({
        clinic_id: validClinicId,
        patient_id: validPatientId,
        date: FUTURE_MONDAY,
        time: '07:45',
        booked_by: validPatientId,
      })

    expect(response.statusCode).toBe(201)

    expect(sendAppointmentConfirmationEmail).toHaveBeenCalledTimes(1)
    expect(sendAppointmentConfirmationEmail).toHaveBeenCalledWith({
      to: 'patient@example.com',
      patientName: 'Jane Patient',
      clinicName: 'Ubuntu Clinic',
      date: FUTURE_MONDAY,
      time: '07:45',
    })
  })

  test('triggers confirmation email when staff book an appointment for a patient', async () => {
    const validStaffId = '00000000-0000-0000-0000-000000000030'

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

    scenario.maybeSingle.users = [
      {
        data: {
          email: 'patient@example.com',
          full_name: 'Jane Patient',
        },
        error: null,
      },
    ]

    const response = await request(app)
      .post('/api/appointments')
      .send({
        clinic_id: validClinicId,
        patient_id: validPatientId,
        date: FUTURE_MONDAY,
        time: '07:45',
        booked_by: validStaffId,
      })

    expect(response.statusCode).toBe(201)

    expect(sendAppointmentConfirmationEmail).toHaveBeenCalledTimes(1)
    expect(sendAppointmentConfirmationEmail).toHaveBeenCalledWith({
      to: 'patient@example.com',
      patientName: 'Jane Patient',
      clinicName: 'Ubuntu Clinic',
      date: FUTURE_MONDAY,
      time: '07:45',
    })
  })

  test('still creates appointment when confirmation email fails', async () => {
    sendAppointmentConfirmationEmail.mockRejectedValueOnce(
      new Error('SMTP failed')
    )

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

    scenario.maybeSingle.users = [
      {
        data: {
          id: validPatientId,
          role: 'Patient',
          clinic_id: null,
        },
        error: null,
      },
      {
        data: {
          email: 'patient@example.com',
          full_name: 'Jane Patient',
        },
        error: null,
      },
    ]

    const response = await request(app)
      .post('/api/appointments')
      .send({
        clinic_id: validClinicId,
        patient_id: validPatientId,
        date: FUTURE_MONDAY,
        time: '07:45',
        booked_by: validPatientId,
      })

    expect(response.statusCode).toBe(201)

    expect(response.body).toEqual({
      message: 'Appointment booked successfully',
      appointment: {
        id: validAppointmentId,
        clinic_id: validClinicId,
        patient_id: validPatientId,
        slot_id: validSlotId,
        status: 'Confirmed',
      },
    })

    expect(sendAppointmentConfirmationEmail).toHaveBeenCalledTimes(1)
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