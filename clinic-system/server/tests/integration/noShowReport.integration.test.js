const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validSlotId = '00000000-0000-0000-0000-000000000004'
const validAppointmentId = '00000000-0000-0000-0000-000000000005'

const REPORT_DATE = '2099-05-11'

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

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2099-05-12T12:00:00.000Z').getTime())

  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
})

afterEach(() => {
  jest.useRealTimers()
})

describe('no-show report integration flow', () => {
  test('auto-marked no-show appointments are reflected in the no-show report', async () => {
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
        },
        error: null,
      },
    ]

    scenario.thenable.appointments = [
      {
        data: [
          {
            id: validAppointmentId,
            clinic_id: validClinicId,
            slot_id: validSlotId,
            status: 'Confirmed',
          },
        ],
        error: null,
      },
      {
        data: [
          {
            id: validAppointmentId,
            clinic_id: validClinicId,
            slot_id: validSlotId,
            status: 'No-show',
          },
        ],
        error: null,
      },
      {
        data: [
          {
            id: validAppointmentId,
            clinic_id: validClinicId,
            slot_id: validSlotId,
            status: 'No-show',
            slots: {
              id: validSlotId,
              slot_datetime: `${REPORT_DATE}T08:00:00.000Z`,
            },
            clinics: {
              id: validClinicId,
              name: 'Ubuntu Clinic',
            },
          },
          {
            id: 'completed-appointment',
            clinic_id: validClinicId,
            slot_id: 'completed-slot',
            status: 'Completed',
            slots: {
              id: 'completed-slot',
              slot_datetime: `${REPORT_DATE}T08:30:00.000Z`,
            },
            clinics: {
              id: validClinicId,
              name: 'Ubuntu Clinic',
            },
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
            slot_datetime: `${REPORT_DATE}T08:00:00.000Z`,
          },
        ],
        error: null,
      },
    ]

    const autoNoShowResponse = await request(app).patch(
      `/api/appointments/auto-no-shows/${validClinicId}`
    )

    expect(autoNoShowResponse.statusCode).toBe(200)
    expect(autoNoShowResponse.body.updatedCount).toBe(1)
    expect(autoNoShowResponse.body.appointments).toEqual([
      expect.objectContaining({
        id: validAppointmentId,
        status: 'No-show',
      }),
    ])

    const appointmentUpdateBuilder = createdBuilders.find(
      (builder) =>
        builder.table === 'appointments' && builder.update.mock.calls.length
    )

    expect(appointmentUpdateBuilder.update).toHaveBeenCalledWith({
      status: 'No-show',
    })

    const reportResponse = await request(app).get(
      `/api/reports/no-shows?clinic_id=${validClinicId}&start_date=${REPORT_DATE}&end_date=${REPORT_DATE}`
    )

    expect(reportResponse.statusCode).toBe(200)

    expect(reportResponse.body.filters).toEqual({
      clinic_id: validClinicId,
      clinic_name: 'Ubuntu Clinic',
      start_date: REPORT_DATE,
      end_date: REPORT_DATE,
      date_range_label: `${REPORT_DATE} to ${REPORT_DATE}`,
    })

    expect(reportResponse.body.summary).toEqual({
      scheduled_appointments: 2,
      completed_appointments: 1,
      cancelled_appointments: 0,
      no_show_appointments: 1,
      no_show_rate_percent: 50,
    })

    expect(reportResponse.body.by_clinic).toEqual([
      {
        clinic_id: validClinicId,
        clinic_name: 'Ubuntu Clinic',
        scheduled_appointments: 2,
        completed_appointments: 1,
        cancelled_appointments: 0,
        no_show_appointments: 1,
        no_show_rate_percent: 50,
      },
    ])
  })
})