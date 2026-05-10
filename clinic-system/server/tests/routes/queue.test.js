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
          data: [{ patient_id: validPatientId, status: 'Waiting' }],
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

  describe('patient joins queue', () => {
  test('POST /api/queue/:clinicId/join returns 400 for invalid clinic id', async () => {
    const res = await request(app)
      .post(`/api/queue/${invalidId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('POST /api/queue/:clinicId/join returns 400 for invalid patient id', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: invalidId, confirmed: true })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('POST /api/queue/:clinicId/join returns 404 when clinic does not exist', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Clinic not found' })
  })

  test('POST /api/queue/:clinicId/join returns 400 when patient has not confirmed', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: { id: validClinicId },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: false })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Queue join must be confirmed by the patient',
    })
  })

  test('POST /api/queue/:clinicId/join returns 409 when patient already has an active queue entry', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: { id: validClinicId },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        data: [
          {
            patient_id: validPatientId,
            clinic_id: validClinicId,
            status: 'Waiting',
          },
        ],
        error: null,
      },
    ]

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      error: 'Patient already has an active queue entry',
    })
  })

  test('POST /api/queue/:clinicId/join returns 201 when queue join succeeds', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: { id: validClinicId },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      // active queue lookup
      {
        data: [],
        error: null,
      },
      // old queue snapshot
      {
        data: [],
        error: null,
      },
      // next position lookup
      {
        data: [],
        error: null,
      },
      // new queue snapshot after insert
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
      .post(`/api/queue/${validClinicId}/join`)
      .send({ patient_id: validPatientId, confirmed: true })

    expect(res.statusCode).toBe(201)
    expect(res.body).toHaveProperty('entry')
    expect(res.body).toHaveProperty('queue_notifications')
    expect(Array.isArray(res.body.queue_notifications)).toBe(true)
  })
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
test('POST /api/queue/:clinicId/join returns 409 when insert hits duplicate active queue constraint', async () => {
  scenario.maybeSingle.clinics = [
    {
      data: { id: validClinicId },
      error: null,
    },
  ]

  scenario.thenable.queue_entries = [
    // active queue lookup
    {
      data: [],
      error: null,
    },
    // old queue snapshot
    {
      data: [],
      error: null,
    },
    // next position lookup
    {
      data: [],
      error: null,
    },
  ]

  scenario.single.queue_entries = [
    {
      data: null,
      error: { code: '23505' },
    },
  ]

  const res = await request(app)
    .post(`/api/queue/${validClinicId}/join`)
    .send({ patient_id: validPatientId, confirmed: true })

  expect(res.statusCode).toBe(409)
  expect(res.body).toEqual({
    error: 'Patient already has an active queue entry',
  })
})
test('DELETE /api/queue/:clinicId/entry/:entryId returns 500 when delete fails', async () => {
  scenario.thenable.queue_entries = [
    // oldQueue snapshot
    {
      data: [],
      error: null,
    },
    // delete call
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
    // oldQueue snapshot
    {
      data: [],
      error: null,
    },
    // delete call
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
test('POST /api/queue/:clinicId/join updates same-day clinic appointment to Waiting and returns appointment time', async () => {
  const today = new Date().toISOString().slice(0, 10)

  scenario.maybeSingle.clinics = [
    {
      data: { id: validClinicId },
      error: null,
    },
  ]

  scenario.thenable.queue_entries = [
    // active queue lookup
    {
      data: [],
      error: null,
    },
    // old queue snapshot
    {
      data: [],
      error: null,
    },
    // next position lookup
    {
      data: [],
      error: null,
    },
    // queue notification snapshot after insert
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
  ]

  scenario.thenable.slots = [
    {
      data: [
        {
          id: validSlotId,
          slot_datetime: `${today}T07:45:00.000Z`,
        },
      ],
      error: null,
    },
  ]

  scenario.single.appointments = [
    {
      data: {
        id: validAppointmentId,
        clinic_id: validClinicId,
        slot_id: validSlotId,
        status: 'Waiting',
      },
      error: null,
    },
  ]

  const res = await request(app)
    .post(`/api/queue/${validClinicId}/join`)
    .send({ patient_id: validPatientId, confirmed: true })

  expect(res.statusCode).toBe(201)

  expect(res.body.linked_appointment).toEqual({
    id: validAppointmentId,
    status: 'Waiting',
    slot_datetime: `${today}T07:45:00.000Z`,
    appointment_time: '09:45',
  })

  const appointmentUpdateBuilder = createdBuilders.find(
    (builder) =>
      builder.table === 'appointments' && builder.update.mock.calls.length
  )

  expect(appointmentUpdateBuilder.update).toHaveBeenCalledWith({
    status: 'Waiting',
  })

  expect(appointmentUpdateBuilder.eq).toHaveBeenCalledWith(
    'id',
    validAppointmentId
  )
})

test('POST /api/queue/:clinicId/join leaves patients without appointments unaffected', async () => {
  scenario.maybeSingle.clinics = [
    {
      data: { id: validClinicId },
      error: null,
    },
  ]

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

  scenario.thenable.appointments = [
    {
      data: [],
      error: null,
    },
  ]

  const res = await request(app)
    .post(`/api/queue/${validClinicId}/join`)
    .send({ patient_id: validPatientId, confirmed: true })

  expect(res.statusCode).toBe(201)
  expect(res.body.linked_appointment).toBeNull()

  const appointmentUpdateBuilder = createdBuilders.find(
    (builder) =>
      builder.table === 'appointments' && builder.update.mock.calls.length
  )

  expect(appointmentUpdateBuilder).toBeUndefined()
})

test('POST /api/queue/:clinicId/join does not modify appointments from a different clinic', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const otherClinicId = '00000000-0000-0000-0000-000000000099'

  scenario.maybeSingle.clinics = [
    {
      data: { id: validClinicId },
      error: null,
    },
  ]

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

  scenario.thenable.appointments = [
    {
      data: [
        {
          id: validAppointmentId,
          clinic_id: otherClinicId,
          slot_id: validSlotId,
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
          id: validSlotId,
          slot_datetime: `${today}T07:45:00.000Z`,
        },
      ],
      error: null,
    },
  ]

  const res = await request(app)
    .post(`/api/queue/${validClinicId}/join`)
    .send({ patient_id: validPatientId, confirmed: true })

  expect(res.statusCode).toBe(201)
  expect(res.body.linked_appointment).toBeNull()

  const appointmentUpdateBuilder = createdBuilders.find(
    (builder) =>
      builder.table === 'appointments' && builder.update.mock.calls.length
  )

  expect(appointmentUpdateBuilder).toBeUndefined()
})

test('POST /api/queue/:clinicId/join does not modify appointments from a different day', async () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDate = tomorrow.toISOString().slice(0, 10)

  scenario.maybeSingle.clinics = [
    {
      data: { id: validClinicId },
      error: null,
    },
  ]

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
  ]

  scenario.thenable.slots = [
    {
      data: [
        {
          id: validSlotId,
          slot_datetime: `${tomorrowDate}T07:45:00.000Z`,
        },
      ],
      error: null,
    },
  ]

  const res = await request(app)
    .post(`/api/queue/${validClinicId}/join`)
    .send({ patient_id: validPatientId, confirmed: true })

  expect(res.statusCode).toBe(201)
  expect(res.body.linked_appointment).toBeNull()

  const appointmentUpdateBuilder = createdBuilders.find(
    (builder) =>
      builder.table === 'appointments' && builder.update.mock.calls.length
  )

  expect(appointmentUpdateBuilder).toBeUndefined()
})

test('POST /api/queue/:clinicId/join still succeeds if linked appointment status update fails', async () => {
  const today = new Date().toISOString().slice(0, 10)

  scenario.maybeSingle.clinics = [
    {
      data: { id: validClinicId },
      error: null,
    },
  ]

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
  ]

  scenario.thenable.slots = [
    {
      data: [
        {
          id: validSlotId,
          slot_datetime: `${today}T07:45:00.000Z`,
        },
      ],
      error: null,
    },
  ]

  scenario.single.appointments = [
    {
      data: null,
      error: new Error('Appointment update failed'),
    },
  ]

  const res = await request(app)
    .post(`/api/queue/${validClinicId}/join`)
    .send({ patient_id: validPatientId, confirmed: true })

  expect(res.statusCode).toBe(201)
  expect(res.body.linked_appointment).toBeNull()
})
})
})