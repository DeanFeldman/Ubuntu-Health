const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validQueueEntryId = '00000000-0000-0000-0000-000000000003'
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

describe('queue and appointment integration flow', () => {
  test('joining the queue links a same-day appointment and shows it in the clinic queue', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const slotDatetime = `${today}T07:45:00.000Z`

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
        data: [
          {
            id: validQueueEntryId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            position: 1,
            status: 'Waiting',
            joined_at: `${today}T08:00:00.000Z`,
            called_at: null,
            completed_at: null,
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
            patient_id: validPatientId,
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
            patient_id: validPatientId,
            slot_id: validSlotId,
            status: 'Waiting',
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
            slot_datetime: slotDatetime,
          },
        ],
        error: null,
      },
      {
        data: [
          {
            id: validSlotId,
            slot_datetime: slotDatetime,
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
          patient_id: validPatientId,
          slot_id: validSlotId,
          status: 'Waiting',
        },
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        data: [
          {
            id: validPatientId,
            full_name: 'Test Patient',
            email: 'patient@example.com',
          },
        ],
        error: null,
      },
    ]

    const joinResponse = await request(app)
      .post(`/api/queue/${validClinicId}/join`)
      .send({
        patient_id: validPatientId,
        confirmed: true,
      })

    expect(joinResponse.statusCode).toBe(201)
    expect(joinResponse.body.entry).toEqual({
      id: validQueueEntryId,
      clinic_id: validClinicId,
      patient_id: validPatientId,
      position: 1,
      status: 'Waiting',
    })
    expect(joinResponse.body.linked_appointment).toEqual({
      id: validAppointmentId,
      status: 'Waiting',
      slot_datetime: slotDatetime,
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

    const queueResponse = await request(app).get(`/api/queue/${validClinicId}`)

    expect(queueResponse.statusCode).toBe(200)
    expect(queueResponse.body.queue).toHaveLength(1)
    expect(queueResponse.body.queue[0]).toEqual(
      expect.objectContaining({
        id: validQueueEntryId,
        clinic_id: validClinicId,
        patient_id: validPatientId,
        position: 1,
        status: 'Waiting',
        appointment_time: '09:45',
        patient: {
          full_name: 'Test Patient',
          email: 'patient@example.com',
        },
      })
    )
  })
})