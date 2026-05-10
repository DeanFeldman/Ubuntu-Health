const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validStaffId = '00000000-0000-0000-0000-000000000003'
const validSlotId = '00000000-0000-0000-0000-000000000004'
const validAppointmentId = '00000000-0000-0000-0000-000000000005'

const FUTURE_MONDAY = '2099-05-11'

const clinicOperatingHours = {
  monday: { open: '08:00', close: '09:00' },
  tuesday: { open: '', close: '' },
  wednesday: { open: '', close: '' },
  thursday: { open: '', close: '' },
  friday: { open: '', close: '' },
  saturday: { open: '', close: '' },
  sunday: { open: '', close: '' },
}

let app
let scenario
let createdBuilders
let sendAppointmentConfirmationEmail

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
  sendAppointmentConfirmationEmail = mockContext.sendAppointmentConfirmationEmail
})

describe('appointment booking integration flow', () => {
  test('staff can view slots, book an appointment, and the patient can see it', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          name: 'Ubuntu Clinic',
          operating_hours: clinicOperatingHours,
          appointment_duration_minutes: 30,
        },
        error: null,
      },
      {
        data: {
          id: validClinicId,
          name: 'Ubuntu Clinic',
          operating_hours: clinicOperatingHours,
          appointment_duration_minutes: 30,
        },
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 1,
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

    scenario.thenable.appointments = [
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
            id: validAppointmentId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: validSlotId,
            status: 'Confirmed',
            service: null,
          },
        ],
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
          email: 'patient@example.com',
          full_name: 'Test Patient',
        },
        error: null,
      },
    ]

    scenario.thenable.slots = [
      {
        data: [
          {
            id: validSlotId,
            slot_datetime: `${FUTURE_MONDAY}T08:00:00.000Z`,
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

    const slotsResponse = await request(app).get(
      `/api/appointments/slots?clinic_id=${validClinicId}&date=${FUTURE_MONDAY}`
    )

    expect(slotsResponse.statusCode).toBe(200)
    expect(slotsResponse.body).toEqual(['08:00', '08:30'])

    const bookingResponse = await request(app).post('/api/appointments').send({
      clinic_id: validClinicId,
      patient_id: validPatientId,
      date: FUTURE_MONDAY,
      time: '08:00',
      booked_by: validStaffId,
    })

    expect(bookingResponse.statusCode).toBe(201)
    expect(bookingResponse.body).toEqual({
      message: 'Appointment booked successfully',
      appointment: {
        id: validAppointmentId,
        clinic_id: validClinicId,
        patient_id: validPatientId,
        slot_id: validSlotId,
        status: 'Confirmed',
      },
    })

    expect(sendAppointmentConfirmationEmail).toHaveBeenCalledWith({
      to: 'patient@example.com',
      patientName: 'Test Patient',
      clinicName: 'Ubuntu Clinic',
      date: FUTURE_MONDAY,
      time: '08:00',
    })

    const appointmentInsertBuilder = createdBuilders.find(
      (builder) =>
        builder.table === 'appointments' && builder.insert.mock.calls.length
    )

    expect(appointmentInsertBuilder.insert).toHaveBeenCalledWith({
      clinic_id: validClinicId,
      patient_id: validPatientId,
      slot_id: validSlotId,
      status: 'Confirmed',
    })

    const patientAppointmentsResponse = await request(app).get(
      `/api/appointments/patient/${validPatientId}`
    )

    expect(patientAppointmentsResponse.statusCode).toBe(200)
    expect(patientAppointmentsResponse.body).toEqual({
      appointments: [
        {
          id: validAppointmentId,
          patient_id: validPatientId,
          clinic_id: validClinicId,
          slot_id: validSlotId,
          status: 'Confirmed',
          service: null,
          clinic_name: 'Ubuntu Clinic',
          slot_datetime: `${FUTURE_MONDAY}T08:00:00.000Z`,
        },
      ],
    })
  })
})