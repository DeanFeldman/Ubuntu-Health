const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validQueueEntryId = '00000000-0000-0000-0000-000000000003'
const validAppointmentId = '00000000-0000-0000-0000-000000000004'
const validSlotId = '00000000-0000-0000-0000-000000000005'
const invalidId = 'invalid-id'

let app
let mockSupabase
let scenario
let createdBuilders

beforeEach(() => {
  const mockContext = setupMockApp({
    mockQueueNotificationService: false,
  })
  app = mockContext.app
  mockSupabase = mockContext.mockSupabase
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
})

describe('Queue route tests', () => {


  describe('queue notifications', () => {
    test('GET /api/queue-notifications/:patientId returns 400 for invalid patient id', async () => {
      const res = await request(app).get(`/api/queue-notifications/${invalidId}`)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid patient ID format' })
    })

    test('GET /api/queue-notifications/:patientId returns 400 for invalid queue_entry_id', async () => {
      const res = await request(app).get(
        `/api/queue-notifications/${validPatientId}?queue_entry_id=${invalidId}`
      )

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid queue entry ID format' })
    })

    test('GET /api/queue-notifications/:patientId returns notifications without queue_entry_id filter', async () => {
      scenario.thenable.queue_notifications = [
        {
          data: [
            {
              id: 'notification-1',
              queue_entry_id: validQueueEntryId,
              clinic_id: validClinicId,
              type: 'POSITION_1',
              position: 1,
              created_at: '2026-04-20T10:00:00.000Z',
            },
          ],
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/queue-notifications/${validPatientId}`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toHaveProperty('notifications')
      expect(Array.isArray(res.body.notifications)).toBe(true)
      expect(res.body.notifications).toHaveLength(1)
    })

    test('GET /api/queue-notifications/:patientId applies queue_entry_id filter when provided', async () => {
      scenario.thenable.queue_notifications = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/queue-notifications/${validPatientId}?queue_entry_id=${validQueueEntryId}`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({ notifications: [] })

      const queueNotificationBuilder = createdBuilders.find(
        (builder) => builder.table === 'queue_notifications'
      )

      expect(queueNotificationBuilder).toBeDefined()
      expect(queueNotificationBuilder.eq).toHaveBeenCalledWith(
        'queue_entry_id',
        validQueueEntryId
      )
    })

    test('GET /api/queue-notifications/:patientId returns 500 when query fails', async () => {
      scenario.thenable.queue_notifications = [
        {
          data: null,
          error: new Error('Notification query failed'),
        },
      ]

      const res = await request(app).get(
        `/api/queue-notifications/${validPatientId}`
      )

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to fetch queue notifications',
      })
    })
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

    const response = await request(app)
      .patch(`/api/appointments/auto-no-shows/${clinicId}`)

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
      builder =>
        builder.table === 'appointments' &&
        builder.update.mock.calls.some(call =>
          call[0] && call[0].status === 'No-show'
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

    const response = await request(app)
      .patch(`/api/appointments/auto-no-shows/user/${patientId}`)

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
      builder =>
        builder.table === 'appointments' &&
        builder.update.mock.calls.some(call =>
          call[0] && call[0].status === 'No-show'
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

    const response = await request(app)
      .patch(`/api/appointments/auto-no-shows/user/${patientId}`)

    expect(response.statusCode).toBe(200)

    expect(response.body).toEqual({
      message: 'No missed appointments found',
      updatedCount: 0,
      appointments: [],
    })

    const appointmentUpdateBuilder = createdBuilders.find(
      builder =>
        builder.table === 'appointments' &&
        builder.update.mock.calls.some(call =>
          call[0] && call[0].status === 'No-show'
        )
    )

    expect(appointmentUpdateBuilder).toBeUndefined()
  })
})
})
})