const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validAppointmentId = '00000000-0000-0000-0000-000000000004'
const validSlotId = '00000000-0000-0000-0000-000000000005'

let app
let scenario
let createdBuilders

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
})

describe('PATCH /api/appointments/auto-no-shows/:clinicId', () => {
  test('marks missed clinic appointments as No-show after clinic close plus two hours', async () => {
    const clinicId = validClinicId
    const appointmentId = validAppointmentId
    const slotId = validSlotId

    scenario.maybeSingle.clinics = [
      {
        data: {
          id: clinicId,
          operating_hours: {
            monday: {
              open: '08:00',
              close: '00:01',
            },
          },
          appointment_duration_minutes: 15,
        },
        error: null,
      },
    ]

    scenario.thenable.appointments = [
      {
        data: [
          {
            id: appointmentId,
            clinic_id: clinicId,
            slot_id: slotId,
            status: 'Confirmed',
          },
        ],
        error: null,
      },
      {
        data: [
          {
            id: appointmentId,
            clinic_id: clinicId,
            slot_id: slotId,
            status: 'No-show',
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.slots = [
      {
        data: [
          {
            id: slotId,
            slot_datetime: '2000-01-03T09:00:00.000Z',
          },
        ],
        error: null,
      },
    ]

    const response = await request(app).patch(
      `/api/appointments/auto-no-shows/${clinicId}`
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      message: '1 appointment(s) marked as No-show',
      updatedCount: 1,
      appointments: [
        {
          id: appointmentId,
          clinic_id: clinicId,
          slot_id: slotId,
          status: 'No-show',
        },
      ],
    })

    const appointmentUpdateBuilder = createdBuilders.find(
      (builder) =>
        builder.table === 'appointments' &&
        builder.update.mock.calls.some(
          (call) => call[0] && call[0].status === 'No-show'
        )
    )

    expect(appointmentUpdateBuilder).toBeDefined()
    expect(appointmentUpdateBuilder.update).toHaveBeenCalledWith({
      status: 'No-show',
    })
    expect(appointmentUpdateBuilder.in).toHaveBeenCalledWith('id', [
      appointmentId,
    ])
  })
})

describe('PATCH /api/appointments/auto-no-shows/user/:patientId', () => {
  test('marks missed patient appointments as No-show after clinic close plus two hours', async () => {
    const clinicId = validClinicId
    const patientId = validPatientId
    const appointmentId = validAppointmentId
    const slotId = validSlotId

    scenario.thenable.appointments = [
      {
        data: [
          {
            id: appointmentId,
            clinic_id: clinicId,
            slot_id: slotId,
            status: 'Confirmed',
          },
        ],
        error: null,
      },
      {
        data: [
          {
            id: appointmentId,
            clinic_id: clinicId,
            slot_id: slotId,
            status: 'No-show',
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.slots = [
      {
        data: [
          {
            id: slotId,
            slot_datetime: '2000-01-03T09:00:00.000Z',
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.clinics = [
      {
        data: [
          {
            id: clinicId,
            operating_hours: {
              monday: {
                open: '08:00',
                close: '00:01',
              },
            },
            appointment_duration_minutes: 15,
          },
        ],
        error: null,
      },
    ]

    const response = await request(app).patch(
      `/api/appointments/auto-no-shows/user/${patientId}`
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      message: '1 appointment(s) marked as No-show',
      updatedCount: 1,
      appointments: [
        {
          id: appointmentId,
          clinic_id: clinicId,
          slot_id: slotId,
          status: 'No-show',
        },
      ],
    })

    const appointmentUpdateBuilder = createdBuilders.find(
      (builder) =>
        builder.table === 'appointments' &&
        builder.update.mock.calls.some(
          (call) => call[0] && call[0].status === 'No-show'
        )
    )

    expect(appointmentUpdateBuilder).toBeDefined()
    expect(appointmentUpdateBuilder.update).toHaveBeenCalledWith({
      status: 'No-show',
    })
    expect(appointmentUpdateBuilder.in).toHaveBeenCalledWith('id', [
      appointmentId,
    ])
  })

  test('returns no missed appointments when patient appointments are not past clinic close grace period', async () => {
    const clinicId = validClinicId
    const patientId = validPatientId
    const appointmentId = validAppointmentId
    const slotId = validSlotId

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDate = tomorrow.toISOString().slice(0, 10)

    scenario.thenable.appointments = [
      {
        data: [
          {
            id: appointmentId,
            clinic_id: clinicId,
            slot_id: slotId,
            status: 'Confirmed',
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.slots = [
      {
        data: [
          {
            id: slotId,
            slot_datetime: `${tomorrowDate}T09:00:00.000Z`,
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.clinics = [
      {
        data: [
          {
            id: clinicId,
            operating_hours: {
              monday: {
                open: '08:00',
                close: '17:00',
              },
              tuesday: {
                open: '08:00',
                close: '17:00',
              },
              wednesday: {
                open: '08:00',
                close: '17:00',
              },
              thursday: {
                open: '08:00',
                close: '17:00',
              },
              friday: {
                open: '08:00',
                close: '17:00',
              },
              saturday: {
                open: '08:00',
                close: '12:00',
              },
              sunday: {
                open: '08:00',
                close: '12:00',
              },
            },
            appointment_duration_minutes: 15,
          },
        ],
        error: null,
      },
    ]

    const response = await request(app).patch(
      `/api/appointments/auto-no-shows/user/${patientId}`
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      message: 'No missed appointments found',
      updatedCount: 0,
      appointments: [],
    })

    const appointmentUpdateBuilder = createdBuilders.find(
      (builder) =>
        builder.table === 'appointments' &&
        builder.update.mock.calls.some(
          (call) => call[0] && call[0].status === 'No-show'
        )
    )

    expect(appointmentUpdateBuilder).toBeUndefined()
  })
})