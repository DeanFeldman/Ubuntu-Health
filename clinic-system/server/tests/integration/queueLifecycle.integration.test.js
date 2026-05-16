const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validQueueEntryId = '00000000-0000-0000-0000-000000000003'

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

describe('queue lifecycle integration flow', () => {
  test('staff can remove a patient from the queue and the queue is empty afterwards', async () => {
    scenario.thenable.queue_entries = [
      // oldQueue snapshot before remove
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

      // delete response
      {
        data: null,
        error: null,
      },

      // newQueue snapshot after remove / notification check
      {
        data: [],
        error: null,
      },

      // GET /api/queue/:clinicId after removal
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

    scenario.thenable.notifications = [
      {
        data: null,
        error: null,
      },
    ]

    const removeResponse = await request(app).delete(
      `/api/queue/${validClinicId}/entry/${validQueueEntryId}`
    )

    expect(removeResponse.statusCode).toBe(200)
    expect(removeResponse.body).toEqual({
      message: 'Patient removed from queue successfully',
      queue_notifications: expect.any(Array),
    })

    const deleteBuilder = createdBuilders.find(
      (builder) =>
        builder.table === 'queue_entries' && builder.delete.mock.calls.length
    )

    expect(deleteBuilder).toBeDefined()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', validQueueEntryId)
    expect(deleteBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)

    const queueResponse = await request(app).get(`/api/queue/${validClinicId}`)

    expect(queueResponse.statusCode).toBe(200)
expect(queueResponse.body.queue).toEqual([])
  })

  test('duplicate queue join returns the existing active queue entry instead of creating another one', async () => {
    const existingEntry = {
      id: validQueueEntryId,
      clinic_id: validClinicId,
      patient_id: validPatientId,
      position: 1,
      status: 'Waiting',
      joined_at: '2026-05-11T08:00:00.000Z',
    }

    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      // active queue check for patient
      {
        data: [existingEntry],
        error: null,
      },
    ]

    const duplicateJoinResponse = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({
        patient_id: validPatientId,
        confirmed: true,
      })

    expect(duplicateJoinResponse.statusCode).toBe(409)
    expect(duplicateJoinResponse.body).toEqual({
      error: 'Patient already has an active queue entry',
      existingEntry,
    })

    const insertBuilder = createdBuilders.find(
      (builder) =>
        builder.table === 'queue_entries' && builder.insert.mock.calls.length
    )

    expect(insertBuilder).toBeUndefined()
  })
})