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

describe('average wait time report integration flow', () => {
test('completed queue entry is reflected in the average wait time report', async () => {
  scenario.maybeSingle.queue_entries = [
    {
      data: {
        status: 'Waiting',
      },
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
        joined_at: '2026-05-11T08:00:00.000Z',
        called_at: '2026-05-11T08:30:00.000Z',
        completed_at: null,
      },
      error: null,
    },
  ]

  scenario.thenable.queue_entries = [
    // oldQueue snapshot before status update
    {
      data: [
        {
          id: validQueueEntryId,
          clinic_id: validClinicId,
          patient_id: validPatientId,
          position: 1,
          status: 'Waiting',
          joined_at: '2026-05-11T08:00:00.000Z',
          called_at: null,
          completed_at: null,
        },
      ],
      error: null,
    },

    // resequenceQueue active entries
    {
      data: [],
      error: null,
    },

    // resequenceQueue check rows
    {
      data: [],
      error: null,
    },

    // newQueue snapshot after status update
    {
      data: [],
      error: null,
    },

    // average wait time report query
    {
      data: [
        {
          id: validQueueEntryId,
          clinic_id: validClinicId,
          joined_at: '2026-05-11T08:00:00.000Z',
          called_at: '2026-05-11T08:30:00.000Z',
        },
      ],
      error: null,
    },
  ]

  scenario.thenable.notifications = [
    {
      data: null,
      error: null,
    },
  ]

  scenario.thenable.clinics = [
    {
      data: [
        {
          id: validClinicId,
          name: 'Ubuntu Clinic',
        },
      ],
      error: null,
    },
  ]

  const statusResponse = await request(app)
    .patch(`/api/queue/${validClinicId}/entry/${validQueueEntryId}/status`)
    .send({
      status: 'In Consultation',
    })

  expect(statusResponse.statusCode).toBe(200)
  expect(statusResponse.body.entry).toEqual(
    expect.objectContaining({
      id: validQueueEntryId,
      status: 'In Consultation',
      called_at: '2026-05-11T08:30:00.000Z',
    })
  )

  const statusUpdateBuilder = createdBuilders.find(
    (builder) =>
      builder.table === 'queue_entries' &&
      builder.update.mock.calls.some(([payload]) => {
        return payload.status === 'In Consultation'
      })
  )

  expect(statusUpdateBuilder).toBeDefined()
  expect(statusUpdateBuilder.update).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'In Consultation',
      position: 0,
    })
  )

  const reportResponse = await request(app).get(
    `/api/reports/average-wait-time?clinic_id=all&start_date=2026-05-11&end_date=2026-05-11`
  )

  expect(reportResponse.statusCode).toBe(200)

  expect(reportResponse.body.filters).toEqual({
    clinic_id: null,
    clinic_name: 'All clinics',
    start_date: '2026-05-11',
    end_date: '2026-05-11',
    date_range_label: '2026-05-11 to 2026-05-11',
  })

  expect(reportResponse.body.summary).toEqual({
    overall_average_wait_time_minutes: 30,
    queue_records_used: 1,
  })

  expect(reportResponse.body.by_clinic).toEqual([
    {
      clinic_id: validClinicId,
      clinic_name: 'Ubuntu Clinic',
      average_wait_time_minutes: 30,
      queue_records_used: 1,
    },
  ])

  expect(reportResponse.body.by_time_of_day).toEqual([
    {
      time_of_day: 'Morning',
      average_wait_time_minutes: 30,
      queue_records_used: 1,
    },
    {
      time_of_day: 'Afternoon',
      average_wait_time_minutes: null,
      queue_records_used: 0,
    },
    {
      time_of_day: 'Evening',
      average_wait_time_minutes: null,
      queue_records_used: 0,
    },
    {
      time_of_day: 'Night',
      average_wait_time_minutes: null,
      queue_records_used: 0,
    },
  ])
})

  test('average wait time report remains empty when queue entry has not been called', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: validQueueEntryId,
            clinic_id: validClinicId,
            joined_at: '2026-05-11T08:00:00.000Z',
            called_at: null,
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.clinics = [
      {
        data: [
          {
            id: validClinicId,
            name: 'Ubuntu Clinic',
          },
        ],
        error: null,
      },
    ]

    const reportResponse = await request(app).get(
      `/api/reports/average-wait-time?start_date=2026-05-11&end_date=2026-05-11`
    )

    expect(reportResponse.statusCode).toBe(200)
    expect(reportResponse.body.summary).toEqual({
      overall_average_wait_time_minutes: null,
      queue_records_used: 0,
    })

    expect(reportResponse.body.by_clinic).toEqual([])
    expect(reportResponse.body.by_time_of_day).toEqual([
      {
        time_of_day: 'Morning',
        average_wait_time_minutes: null,
        queue_records_used: 0,
      },
      {
        time_of_day: 'Afternoon',
        average_wait_time_minutes: null,
        queue_records_used: 0,
      },
      {
        time_of_day: 'Evening',
        average_wait_time_minutes: null,
        queue_records_used: 0,
      },
      {
        time_of_day: 'Night',
        average_wait_time_minutes: null,
        queue_records_used: 0,
      },
    ])
  })
})