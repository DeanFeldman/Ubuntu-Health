const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validStaffId = '00000000-0000-0000-0000-000000000002'
const otherStaffId = '00000000-0000-0000-0000-000000000006'
const validAvailabilityId = '00000000-0000-0000-0000-000000000003'
const validSlotId = '00000000-0000-0000-0000-000000000004'
const validAppointmentId = '00000000-0000-0000-0000-000000000005'

const FUTURE_MONDAY = '2099-05-11'

const clinicOperatingHours = {
  monday: { open: '08:00', close: '17:00' },
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

describe('staff availability and booking integration flow', () => {
  test('staff can create availability and then self-book when another staff member is available', async () => {
    scenario.maybeSingle.users = [
      {
        data: {
          id: validStaffId,
          role: 'Staff',
          clinic_id: validClinicId,
        },
        error: null,
      },
      {
        data: {
          id: validStaffId,
          role: 'Staff',
          clinic_id: validClinicId,
        },
        error: null,
      },
      {
        data: {
          id: validStaffId,
          email: 'staff@example.com',
          full_name: 'Staff User',
        },
        error: null,
      },
    ]

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

    scenario.maybeSingle.staff_availability = [
      {
        data: null,
        error: null,
      },
    ]

    scenario.single.staff_availability = [
      {
        data: {
          id: validAvailabilityId,
          staff_id: validStaffId,
          day_of_week: 0,
          start_time: '08:00',
          end_time: '12:00',
          is_available: true,
        },
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        data: [
          {
            id: validStaffId,
            role: 'Staff',
            clinic_id: validClinicId,
          },
          {
            id: otherStaffId,
            role: 'Staff',
            clinic_id: validClinicId,
          },
        ],
        error: null,
      },
      {
        count: 2,
        error: null,
      },
      {
        count: 2,
        error: null,
      },
    ]

    scenario.thenable.staff_availability = [
      {
        data: [
          {
            staff_id: validStaffId,
            day_of_week: 1,
            start_time: '08:00',
            end_time: '12:00',
            is_available: true,
          },
          {
            staff_id: otherStaffId,
            day_of_week: 1,
            start_time: '08:00',
            end_time: '12:00',
            is_available: true,
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
          patient_id: validStaffId,
          slot_id: validSlotId,
          status: 'Confirmed',
        },
        error: null,
      },
    ]

    const availabilityResponse = await request(app)
      .post(`/api/staff/${validStaffId}/availability`)
      .send({
        day_of_week: 0,
        start_time: '08:00',
        end_time: '12:00',
        is_available: true,
      })

    expect(availabilityResponse.statusCode).toBe(201)
    expect(availabilityResponse.body).toEqual({
      availability: {
        id: validAvailabilityId,
        staff_id: validStaffId,
        day_of_week: 0,
        start_time: '08:00',
        end_time: '12:00',
        is_available: true,
      },
    })

    const bookingResponse = await request(app).post('/api/appointments').send({
      clinic_id: validClinicId,
      patient_id: validStaffId,
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
        patient_id: validStaffId,
        slot_id: validSlotId,
        status: 'Confirmed',
      },
    })

    const availabilityInsertBuilder = createdBuilders.find(
      (builder) =>
        builder.table === 'staff_availability' &&
        builder.insert.mock.calls.length
    )

    expect(availabilityInsertBuilder.insert).toHaveBeenCalledWith({
      staff_id: validStaffId,
      day_of_week: 0,
      start_time: '08:00',
      end_time: '12:00',
      is_available: true,
    })

    const appointmentInsertBuilder = createdBuilders.find(
      (builder) =>
        builder.table === 'appointments' && builder.insert.mock.calls.length
    )

    expect(appointmentInsertBuilder.insert).toHaveBeenCalledWith({
      clinic_id: validClinicId,
      patient_id: validStaffId,
      slot_id: validSlotId,
      status: 'Confirmed',
    })

    expect(sendAppointmentConfirmationEmail).toHaveBeenCalledWith({
      to: 'staff@example.com',
      patientName: 'Staff User',
      clinicName: 'Ubuntu Clinic',
      date: FUTURE_MONDAY,
      time: '08:00',
    })
  })
})