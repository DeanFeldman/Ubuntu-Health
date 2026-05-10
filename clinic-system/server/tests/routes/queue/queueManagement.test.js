const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validQueueEntryId = '00000000-0000-0000-0000-000000000003'
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

describe('queue staff status updates', () => {
  test('PATCH /api/queue/:clinicId/entry/:entryId/status returns 400 for invalid clinic id', async () => {
    const res = await request(app)
      .patch(`/api/queue/${invalidId}/entry/${validQueueEntryId}/status`)
      .send({ status: 'In Consultation' })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('PATCH /api/queue/:clinicId/entry/:entryId/status returns 400 for invalid entry id', async () => {
    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${invalidId}/status`)
      .send({ status: 'In Consultation' })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('PATCH /api/queue/:clinicId/entry/:entryId/status returns 400 for invalid status value', async () => {
    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
      .send({ status: 'InvalidStatus' })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid status value' })
  })

  test('PATCH /api/queue/:clinicId/entry/:entryId/status returns 400 for missing status', async () => {
    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
      .send({})

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid status value' })
  })

  test('PATCH /api/queue/:clinicId/entry/:entryId/status returns 404 when entry is missing', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
      .send({ status: 'In Consultation' })

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Queue entry not found' })
  })

  test('PATCH /api/queue/:clinicId/entry/:entryId/status returns 409 for invalid status transition', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: { status: 'Complete' },
        error: null,
      },
    ]

    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
      .send({ status: 'Waiting' })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      error: 'Invalid status transition from Complete to Waiting',
    })
  })

  test('PATCH /api/queue/:clinicId/entry/:entryId/status sends call notification on Waiting to In Consultation', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: { status: 'Waiting' },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: validQueueEntryId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            position: 1,
            status: 'Waiting',
          },
        ],
        error: null,
      },
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
            id: validQueueEntryId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            position: 0,
            status: 'In Consultation',
          },
        ],
        error: null,
      },
    ]

    scenario.single.queue_entries = [
      {
        data: {
          id: validQueueEntryId,
          clinic_id: validClinicId,
          patient_id: validPatientId,
          position: 0,
          status: 'In Consultation',
        },
        error: null,
      },
    ]

    scenario.single.queue_notifications = [
      {
        data: {
          id: 'queue-notification-1',
          type: 'IN_CONSULTATION',
        },
        error: null,
      },
    ]

    scenario.thenable.notifications = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
      .send({ status: 'In Consultation' })

    expect(res.statusCode).toBe(200)
    expect(res.body.queue_notifications).toEqual([
      {
        id: 'queue-notification-1',
        type: 'IN_CONSULTATION',
      },
    ])

    const queueNotificationBuilder = createdBuilders.find(
      (builder) => builder.table === 'queue_notifications'
    )

    expect(queueNotificationBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        queue_entry_id: validQueueEntryId,
        patient_id: validPatientId,
        clinic_id: validClinicId,
        type: 'IN_CONSULTATION',
        position: null,
      })
    )

    const notificationBuilder = createdBuilders.find(
      (builder) => builder.table === 'notifications'
    )

    expect(notificationBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: validPatientId,
        type: 'queue_alert',
        channel: 'push',
        message:
          'You are being called — please make your way to the consultation room.',
        delivered: false,
      })
    )
  })

  test('PATCH /api/queue/:clinicId/entry/:entryId/status does not notify on In Consultation to Complete', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: { status: 'In Consultation' },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: validQueueEntryId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            position: 0,
            status: 'In Consultation',
          },
        ],
        error: null,
      },
      {
        data: [],
        error: null,
      },
      {
        data: [],
        error: null,
      },
      {
        data: [],
        error: null,
      },
    ]

    scenario.single.queue_entries = [
      {
        data: {
          id: validQueueEntryId,
          clinic_id: validClinicId,
          patient_id: validPatientId,
          position: 0,
          status: 'Complete',
        },
        error: null,
      },
    ]

    const res = await request(app)
      .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
      .send({ status: 'Complete' })

    expect(res.statusCode).toBe(200)
    expect(res.body.queue_notifications).toEqual([])

    expect(
      createdBuilders.some((builder) => builder.table === 'queue_notifications')
    ).toBe(false)

    expect(
      createdBuilders.some((builder) => builder.table === 'notifications')
    ).toBe(false)
  })
})

describe('queue entry deletion', () => {
  test('DELETE /api/queue/:clinicId/entry/:entryId returns 400 for invalid clinic id', async () => {
    const res = await request(app).delete(
      `/api/queue/${invalidId}/entry/${validQueueEntryId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('DELETE /api/queue/:clinicId/entry/:entryId returns 400 for invalid entry id', async () => {
    const res = await request(app).delete(
      `/api/queue/${validClinicId}/entry/${invalidId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('DELETE /api/queue/:clinicId/entry/:entryId returns 404 when entry is missing', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
    ]

    scenario.maybeSingle.queue_entries = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app).delete(
      `/api/queue/${validClinicId}/entry/${validQueueEntryId}`
    )

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Queue entry not found' })
  })

  test('DELETE /api/queue/:clinicId/entry/:entryId removes an entry successfully', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
      {
        data: null,
        error: null,
      },
      {
        data: [],
        error: null,
      },
    ]

    scenario.maybeSingle.queue_entries = [
      {
        data: {
          id: validQueueEntryId,
        },
        error: null,
      },
    ]

    const res = await request(app).delete(
      `/api/queue/${validClinicId}/entry/${validQueueEntryId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      message: 'Patient removed from queue successfully',
      queue_notifications: [],
    })

    expect(mockSupabase.rpc).toHaveBeenCalledWith('resequence_queue', {
      clinic: validClinicId,
    })
  })

  test('DELETE /api/queue/:clinicId/entry/:entryId returns 500 when delete fails', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
      {
        data: null,
        error: new Error('Delete failed'),
      },
    ]

    scenario.maybeSingle.queue_entries = [
      {
        data: { id: validQueueEntryId },
        error: null,
      },
    ]

    const res = await request(app).delete(
      `/api/queue/${validClinicId}/entry/${validQueueEntryId}`
    )

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to remove patient from queue' })
  })

  test('DELETE /api/queue/:clinicId/entry/:entryId returns 500 when resequence rpc fails', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
      {
        data: null,
        error: null,
      },
    ]

    scenario.maybeSingle.queue_entries = [
      {
        data: { id: validQueueEntryId },
        error: null,
      },
    ]

    mockSupabase.rpc = jest.fn(() =>
      Promise.resolve({
        data: null,
        error: new Error('RPC failed'),
      })
    )

    const res = await request(app).delete(
      `/api/queue/${validClinicId}/entry/${validQueueEntryId}`
    )

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to remove patient from queue' })
  })
})

describe('staff add patient to queue', () => {
  test('POST /api/queue/:clinicId/add-patient returns 400 for invalid clinic id', async () => {
    const res = await request(app)
      .post(`/api/queue/${invalidId}/add-patient`)
      .send({ patient_id: validPatientId })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('POST /api/queue/:clinicId/add-patient returns 400 for invalid patient id', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({ patient_id: invalidId })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('POST /api/queue/:clinicId/add-patient returns 400 when patient_id is missing', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({})

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('POST /api/queue/:clinicId/add-patient returns 409 when patient already has active queue entry', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [
          {
            patient_id: validPatientId,
            status: 'Waiting',
          },
        ],
        error: null,
      },
    ]

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({ patient_id: validPatientId })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      error: 'Patient already has an active queue entry',
    })
  })

  test('POST /api/queue/:clinicId/add-patient returns 500 when insert fails', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
      {
        data: [],
        error: null,
      },
      {
        data: [],
        error: null,
      },
    ]

    scenario.single.queue_entries = [
      {
        data: null,
        error: new Error('Insert failed'),
      },
    ]

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({ patient_id: validPatientId })

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to add patient to queue' })
  })

  test('POST /api/queue/:clinicId/add-patient returns 201 when insert succeeds', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
      {
        data: [],
        error: null,
      },
      {
        data: [],
        error: null,
      },
      {
        data: [],
        error: null,
      },
    ]

    scenario.single.queue_entries = [
      {
        data: {
          id: validQueueEntryId,
          clinic_id: validClinicId,
          patient_id: validPatientId,
          position: 1,
          status: 'Waiting',
        },
        error: null,
      },
    ]

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/add-patient`)
      .send({ patient_id: validPatientId })

    expect(res.statusCode).toBe(201)
    expect(res.body).toHaveProperty('entry')
    expect(res.body).toHaveProperty('queue_notifications')
    expect(Array.isArray(res.body.queue_notifications)).toBe(true)
  })
})