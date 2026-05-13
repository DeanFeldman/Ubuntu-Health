const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validSlotId = '00000000-0000-0000-0000-000000000004'
const validAppointmentId = '00000000-0000-0000-0000-000000000005'

const FUTURE_MONDAY = '2099-05-11'

let app
let scenario
let createdBuilders
let sendAppointmentCancellationEmail

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
  sendAppointmentCancellationEmail =
    mockContext.sendAppointmentCancellationEmail
})

describe('appointment cancellation integration flow', () => {
  test('patient appointment can be cancelled, cancellation email is sent, and slot is released', async () => {
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
          id: validPatientId,
          email: 'patient@example.com',
          full_name: 'Test Patient',
        },
        error: null,
      },
    ]

    scenario.maybeSingle.slots = [
      {
        data: {
          id: validSlotId,
          slot_datetime: `${FUTURE_MONDAY}T08:00:00.000Z`,
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

    const cancellationResponse = await request(app).patch(
      `/api/appointments/${validAppointmentId}/cancel`
    )

    expect(cancellationResponse.statusCode).toBe(200)
    expect(cancellationResponse.body).toEqual({
      message: 'Appointment cancelled successfully',
      appointment: {
        id: validAppointmentId,
        clinic_id: validClinicId,
        patient_id: validPatientId,
        slot_id: validSlotId,
        status: 'Cancelled',
      },
    })

    expect(sendAppointmentCancellationEmail).toHaveBeenCalledTimes(1)
    expect(sendAppointmentCancellationEmail).toHaveBeenCalledWith({
      to: 'patient@example.com',
      patientName: 'Test Patient',
      clinicName: 'Ubuntu Clinic',
      date: FUTURE_MONDAY,
      time: '10:00',
    })

    const appointmentUpdateBuilder = createdBuilders.find(
      (builder) =>
        builder.table === 'appointments' && builder.update.mock.calls.length
    )

    expect(appointmentUpdateBuilder.update).toHaveBeenCalledWith({
      status: 'Cancelled',
    })

    const slotUpdateBuilder = createdBuilders.find(
      (builder) => builder.table === 'slots' && builder.update.mock.calls.length
    )

    expect(slotUpdateBuilder.update).toHaveBeenCalledWith({
      is_available: true,
    })
  })

  test('cancellation still succeeds when cancellation email fails', async () => {
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
          id: validPatientId,
          email: 'patient@example.com',
          full_name: 'Test Patient',
        },
        error: null,
      },
    ]

    scenario.maybeSingle.slots = [
      {
        data: {
          id: validSlotId,
          slot_datetime: `${FUTURE_MONDAY}T08:00:00.000Z`,
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

    const cancellationResponse = await request(app).patch(
      `/api/appointments/${validAppointmentId}/cancel`
    )

    expect(cancellationResponse.statusCode).toBe(200)
    expect(cancellationResponse.body.appointment.status).toBe('Cancelled')
    expect(sendAppointmentCancellationEmail).toHaveBeenCalledTimes(1)
  })
})