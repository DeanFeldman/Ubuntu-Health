const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validPatientId = '00000000-0000-0000-0000-000000000002'
const validQueueEntryId = '00000000-0000-0000-0000-000000000003'
const validClinicId = '00000000-0000-0000-0000-000000000001'
const invalidId = 'invalid-id'

let app
let scenario
let createdBuilders

beforeEach(() => {
  const mockContext = setupMockApp({
    mockQueueNotificationService: false,
  })

  app = mockContext.app
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
})

describe('queue notifications', () => {
  test('GET /api/queue-notifications/:patientId returns 400 for invalid patient id', async () => {
    const res = await request(app).get(`/api/queue-notifications/${invalidId}`)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid patient ID format',
    })
  })

  test('GET /api/queue-notifications/:patientId returns 400 for invalid queue_entry_id', async () => {
    const res = await request(app).get(
      `/api/queue-notifications/${validPatientId}?queue_entry_id=${invalidId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid queue entry ID format',
    })
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
    expect(res.body.notifications[0]).toEqual({
      id: 'notification-1',
      queue_entry_id: validQueueEntryId,
      clinic_id: validClinicId,
      type: 'POSITION_1',
      position: 1,
      created_at: '2026-04-20T10:00:00.000Z',
    })
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
    expect(res.body).toEqual({
      notifications: [],
    })

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