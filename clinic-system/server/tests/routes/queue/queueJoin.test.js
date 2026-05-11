const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validQueueEntryId = '00000000-0000-0000-0000-000000000003'
const validAppointmentId = '00000000-0000-0000-0000-000000000004'
const validSlotId = '00000000-0000-0000-0000-000000000005'
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

describe('patient joins queue', () => {
  test('POST /api/queue/:clinicId/join returns 400 for invalid clinic id', async () => {
    const res = await request(app)
      .post(`/api/queue/${invalidId}/join`)
      .send({
        patient_id: validPatientId,
        confirmed: true,
      })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid ID format',
    })
  })

  test('POST /api/queue/:clinicId/join returns 400 for invalid patient id', async () => {
    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({
        patient_id: invalidId,
        confirmed: true,
      })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid ID format',
    })
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
      .send({
        patient_id: validPatientId,
        confirmed: true,
      })

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({
      error: 'Clinic not found',
    })
  })

  test('POST /api/queue/:clinicId/join returns 400 when patient has not confirmed', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
        },
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
      .send({
        patient_id: validPatientId,
        confirmed: false,
      })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Queue join must be confirmed by the patient',
    })
  })

  test('POST /api/queue/:clinicId/join returns 409 when patient already has an active queue entry', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
        },
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
      .send({
        patient_id: validPatientId,
        confirmed: true,
      })

    expect(res.statusCode).toBe(409)
    expect(res.body).toMatchObject({
      error: 'Patient already has an active queue entry',
      existingEntry: {
        clinic_id: validClinicId,
        patient_id: validPatientId,
        status: 'Waiting',
      },
    })
    
  })

  test('POST /api/queue/:clinicId/join returns 409 when insert hits duplicate active queue constraint', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
        },
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
    ]

    scenario.single.queue_entries = [
      {
        data: null,
        error: {
          code: '23505',
        },
      },
    ]

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({
        patient_id: validPatientId,
        confirmed: true,
      })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      error: 'Patient already has an active queue entry',
    })
  })

  test('POST /api/queue/:clinicId/join returns 201 when queue join succeeds', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
        },
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

    const res = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({
        patient_id: validPatientId,
        confirmed: true,
      })

    expect(res.statusCode).toBe(201)
    expect(res.body).toHaveProperty('entry')
    expect(res.body).toHaveProperty('queue_notifications')
    expect(Array.isArray(res.body.queue_notifications)).toBe(true)
  })

  test('POST /api/queue/:clinicId/join updates same-day clinic appointment to Waiting and returns appointment time', async () => {
    const today = new Date().toISOString().slice(0, 10)

    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
        },
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
      .send({
        patient_id: validPatientId,
        confirmed: true,
      })

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
        data: {
          id: validClinicId,
        },
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
      .send({
        patient_id: validPatientId,
        confirmed: true,
      })

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
        data: {
          id: validClinicId,
        },
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
      .send({
        patient_id: validPatientId,
        confirmed: true,
      })

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
        data: {
          id: validClinicId,
        },
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
      .send({
        patient_id: validPatientId,
        confirmed: true,
      })

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
        data: {
          id: validClinicId,
        },
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
      .send({
        patient_id: validPatientId,
        confirmed: true,
      })

    expect(res.statusCode).toBe(201)
    expect(res.body.linked_appointment).toBeNull()
  })
})