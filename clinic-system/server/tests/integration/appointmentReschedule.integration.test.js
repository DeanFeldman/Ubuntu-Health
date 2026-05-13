const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validStaffId = '00000000-0000-0000-0000-000000000003'
const oldSlotId = '00000000-0000-0000-0000-000000000004'
const newSlotId = '00000000-0000-0000-0000-000000000006'
const validAppointmentId = '00000000-0000-0000-0000-000000000005'

const FUTURE_MONDAY = '2099-05-11'

let app
let scenario
let createdBuilders
let sendAppointmentRescheduleEmail

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
  sendAppointmentRescheduleEmail =
    mockContext.sendAppointmentRescheduleEmail
})

describe('appointment reschedule integration flow', () => {
  test('patient appointment can be viewed, rescheduled, email is sent, and updated appointment can be viewed', async () => {
    scenario.thenable.appointments = [
      {
        data: [
          {
            id: validAppointmentId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: oldSlotId,
            status: 'Confirmed',
            service: null,
          },
        ],
        error: null,
      },
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
      {
        data: [
          {
            id: validAppointmentId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: newSlotId,
            status: 'Confirmed',
            service: null,
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.slots = [
      {
        data: [
          {
            id: oldSlotId,
            slot_datetime: `${FUTURE_MONDAY}T06:45:00.000Z`,
          },
        ],
        error: null,
      },
      {
        data: null,
        error: null,
      },
      {
        data: null,
        error: null,
      },
      {
        data: [
          {
            id: newSlotId,
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

    scenario.maybeSingle.appointments = [
      {
        data: {
          id: validAppointmentId,
          clinic_id: validClinicId,
          patient_id: validPatientId,
          slot_id: oldSlotId,
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
          id: oldSlotId,
          slot_datetime: `${FUTURE_MONDAY}T06:45:00.000Z`,
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
          id: validPatientId,
          email: 'patient@example.com',
          full_name: 'Test Patient',
        },
        error: null,
      },
    ]

    const beforeRescheduleResponse = await request(app).get(
      `/api/appointments/patient/${validPatientId}`
    )

    expect(beforeRescheduleResponse.statusCode).toBe(200)
    expect(beforeRescheduleResponse.body).toEqual({
      appointments: [
        {
          id: validAppointmentId,
          patient_id: validPatientId,
          clinic_id: validClinicId,
          slot_id: oldSlotId,
          status: 'Confirmed',
          service: null,
          clinic_name: 'Ubuntu Clinic',
          slot_datetime: `${FUTURE_MONDAY}T06:45:00.000Z`,
        },
      ],
    })

    const rescheduleResponse = await request(app)
      .patch(`/api/appointments/${validAppointmentId}/reschedule`)
      .send({
        date: FUTURE_MONDAY,
        time: '07:45',
      })

    expect(rescheduleResponse.statusCode).toBe(200)
    expect(rescheduleResponse.body).toEqual({
      success: true,
      message: 'Appointment rescheduled successfully',
      appointment: {
        id: validAppointmentId,
        clinic_id: validClinicId,
        patient_id: validPatientId,
        slot_id: newSlotId,
        status: 'Confirmed',
        slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
      },
      old_slot_id: oldSlotId,
      new_slot_id: newSlotId,
    })

    expect(sendAppointmentRescheduleEmail).toHaveBeenCalledTimes(1)
    expect(sendAppointmentRescheduleEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'patient@example.com',
        patientName: 'Test Patient',
        clinicName: 'Ubuntu Clinic',
        oldDate: FUTURE_MONDAY,
        oldTime: expect.any(String),
        newDate: FUTURE_MONDAY,
        newTime: '07:45',
      })
    )

    const appointmentUpdateBuilder = createdBuilders.find(
      (builder) =>
        builder.table === 'appointments' && builder.update.mock.calls.length
    )

    expect(appointmentUpdateBuilder.update).toHaveBeenCalledWith({
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
      is_available: false,
    })

    const afterRescheduleResponse = await request(app).get(
      `/api/appointments/patient/${validPatientId}`
    )

    expect(afterRescheduleResponse.statusCode).toBe(200)
    expect(afterRescheduleResponse.body).toEqual({
      appointments: [
        {
          id: validAppointmentId,
          patient_id: validPatientId,
          clinic_id: validClinicId,
          slot_id: newSlotId,
          status: 'Confirmed',
          service: null,
          clinic_name: 'Ubuntu Clinic',
          slot_datetime: `${FUTURE_MONDAY}T07:45:00.000Z`,
        },
      ],
    })
  })

  test('reschedule still succeeds when reschedule email fails', async () => {
    sendAppointmentRescheduleEmail.mockRejectedValueOnce(
      new Error('SMTP reschedule failed')
    )

    scenario.maybeSingle.appointments = [
      {
        data: {
          id: validAppointmentId,
          clinic_id: validClinicId,
          patient_id: validPatientId,
          slot_id: oldSlotId,
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
          id: oldSlotId,
          slot_datetime: `${FUTURE_MONDAY}T06:45:00.000Z`,
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
          id: validPatientId,
          email: 'patient@example.com',
          full_name: 'Test Patient',
        },
        error: null,
      },
    ]

    const rescheduleResponse = await request(app)
      .patch(`/api/appointments/${validAppointmentId}/reschedule`)
      .send({
        date: FUTURE_MONDAY,
        time: '07:45',
      })

    expect(rescheduleResponse.statusCode).toBe(200)
    expect(rescheduleResponse.body.message).toBe(
      'Appointment rescheduled successfully'
    )
    expect(rescheduleResponse.body.appointment.status).toBe('Confirmed')
    expect(rescheduleResponse.body.appointment.slot_id).toBe(newSlotId)
    expect(sendAppointmentRescheduleEmail).toHaveBeenCalledTimes(1)
  })
})