const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const secondClinicId = '00000000-0000-0000-0000-000000000002'
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

describe('average wait time report', () => {
  test('GET /api/reports/average-wait-time returns all-clinic averages', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: 'queue-entry-1',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T06:00:00.000Z',
            called_at: '2026-05-11T06:30:00.000Z',
          },
          {
            id: 'queue-entry-2',
            clinic_id: secondClinicId,
            joined_at: '2026-05-11T12:00:00.000Z',
            called_at: '2026-05-11T13:00:00.000Z',
          },
          {
            id: 'queue-entry-3',
            clinic_id: secondClinicId,
            joined_at: '2026-05-11T14:00:00.000Z',
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
          {
            id: secondClinicId,
            name: 'Hope Clinic',
          },
        ],
        error: null,
      },
    ]

    const res = await request(app).get('/api/reports/average-wait-time')

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      filters: {
        clinic_id: null,
        clinic_name: 'All clinics',
        start_date: null,
        end_date: null,
        date_range_label: 'All time',
      },
      summary: {
        overall_average_wait_time_minutes: 45,
        queue_records_used: 2,
      },
      by_clinic: [
        {
          clinic_id: secondClinicId,
          clinic_name: 'Hope Clinic',
          average_wait_time_minutes: 60,
          queue_records_used: 1,
        },
        {
          clinic_id: validClinicId,
          clinic_name: 'Ubuntu Clinic',
          average_wait_time_minutes: 30,
          queue_records_used: 1,
        },
      ],
      by_time_of_day: [
        {
          time_of_day: 'Morning',
          average_wait_time_minutes: 30,
          queue_records_used: 1,
        },
        {
          time_of_day: 'Afternoon',
          average_wait_time_minutes: 60,
          queue_records_used: 1,
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
      ],
    })

    const queueBuilder = createdBuilders[0]
    const clinicBuilder = createdBuilders[1]

    expect(queueBuilder.table).toBe('queue_entries')
    expect(queueBuilder.select).toHaveBeenCalledWith(
      'id, clinic_id, joined_at, called_at'
    )
    expect(queueBuilder.order).toHaveBeenCalledWith('joined_at', {
      ascending: true,
    })
    expect(clinicBuilder.table).toBe('clinics')
    expect(clinicBuilder.in).toHaveBeenCalledWith('id', [
      validClinicId,
      secondClinicId,
    ])
  })

  test('filters by clinic and date range', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          name: 'Ubuntu Clinic',
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: 'queue-entry-1',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T07:00:00.000Z',
            called_at: '2026-05-11T07:15:00.000Z',
          },
          {
            id: 'queue-entry-2',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T08:00:00.000Z',
            called_at: '2026-05-11T08:45:00.000Z',
          },
        ],
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/reports/average-wait-time?clinic_id=${validClinicId}&start_date=2026-05-10&end_date=2026-05-11`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters).toEqual({
      clinic_id: validClinicId,
      clinic_name: 'Ubuntu Clinic',
      start_date: '2026-05-10',
      end_date: '2026-05-11',
      date_range_label: '2026-05-10 to 2026-05-11',
    })
    expect(res.body.summary).toEqual({
      overall_average_wait_time_minutes: 30,
      queue_records_used: 2,
    })
    expect(res.body.by_clinic).toEqual([
      {
        clinic_id: validClinicId,
        clinic_name: 'Ubuntu Clinic',
        average_wait_time_minutes: 30,
        queue_records_used: 2,
      },
    ])

    const clinicLookupBuilder = createdBuilders[0]
    const queueBuilder = createdBuilders[1]

    expect(clinicLookupBuilder.table).toBe('clinics')
    expect(clinicLookupBuilder.eq).toHaveBeenCalledWith('id', validClinicId)
    expect(queueBuilder.table).toBe('queue_entries')
    expect(queueBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)
    expect(queueBuilder.gte).toHaveBeenCalledWith(
      'joined_at',
      '2026-05-10T00:00:00.000Z'
    )
    expect(queueBuilder.lte).toHaveBeenCalledWith(
      'joined_at',
      '2026-05-11T23:59:59.999Z'
    )
  })

  test('filters by clinic id only', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          name: 'Ubuntu Clinic',
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: 'queue-entry-1',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T07:00:00.000Z',
            called_at: '2026-05-11T07:20:00.000Z',
          },
        ],
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/reports/average-wait-time?clinic_id=${validClinicId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters).toEqual({
      clinic_id: validClinicId,
      clinic_name: 'Ubuntu Clinic',
      start_date: null,
      end_date: null,
      date_range_label: 'All time',
    })
    expect(res.body.by_clinic).toEqual([
      {
        clinic_id: validClinicId,
        clinic_name: 'Ubuntu Clinic',
        average_wait_time_minutes: 20,
        queue_records_used: 1,
      },
    ])

    const queueBuilder = createdBuilders[1]
    expect(queueBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)
  })

  test('filters by start_date only', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: 'queue-entry-1',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T08:00:00.000Z',
            called_at: '2026-05-11T08:30:00.000Z',
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

    const res = await request(app).get(
      '/api/reports/average-wait-time?start_date=2026-05-11'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters.start_date).toBe('2026-05-11')
    expect(res.body.filters.end_date).toBe(null)
    expect(res.body.filters.date_range_label).toBe('From 2026-05-11')

    const queueBuilder = createdBuilders[0]
    expect(queueBuilder.gte).toHaveBeenCalledWith(
      'joined_at',
      '2026-05-11T00:00:00.000Z'
    )
    expect(queueBuilder.lte).not.toHaveBeenCalled()
  })

  test('filters by end_date only and includes the full day', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: 'queue-entry-1',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T22:30:00.000Z',
            called_at: '2026-05-11T22:45:00.000Z',
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

    const res = await request(app).get(
      '/api/reports/average-wait-time?end_date=2026-05-11'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters.start_date).toBe(null)
    expect(res.body.filters.end_date).toBe('2026-05-11')
    expect(res.body.filters.date_range_label).toBe('Up to 2026-05-11')

    const queueBuilder = createdBuilders[0]
    expect(queueBuilder.gte).not.toHaveBeenCalled()
    expect(queueBuilder.lte).toHaveBeenCalledWith(
      'joined_at',
      '2026-05-11T23:59:59.999Z'
    )
  })

  test('returns an empty selected-clinic report when no records match', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          name: 'Ubuntu Clinic',
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

    const res = await request(app).get(
      `/api/reports/average-wait-time?clinic_id=${validClinicId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.summary).toEqual({
      overall_average_wait_time_minutes: null,
      queue_records_used: 0,
    })
    expect(res.body.by_clinic).toEqual([
      {
        clinic_id: validClinicId,
        clinic_name: 'Ubuntu Clinic',
        average_wait_time_minutes: null,
        queue_records_used: 0,
      },
    ])
  })

  test('accepts clinic_id=all without clinic lookup', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/average-wait-time?clinic_id=all'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters.clinic_id).toBe(null)
    expect(res.body.filters.clinic_name).toBe('All clinics')
    expect(createdBuilders).toHaveLength(1)
    expect(createdBuilders[0].table).toBe('queue_entries')
  })

  test('returns 400 for invalid clinic id', async () => {
    const res = await request(app).get(
      `/api/reports/average-wait-time?clinic_id=${invalidId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid clinic ID format' })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 404 when clinic does not exist', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/reports/average-wait-time?clinic_id=${validClinicId}`
    )

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Clinic not found' })
    expect(createdBuilders).toHaveLength(1)
  })

  test('returns 400 for invalid dates', async () => {
    const res = await request(app).get(
      '/api/reports/average-wait-time?start_date=2026-02-31'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid start_date value. Use YYYY-MM-DD',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 400 for invalid end_date', async () => {
    const res = await request(app).get(
      '/api/reports/average-wait-time?end_date=bad-date'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid end_date format. Use YYYY-MM-DD',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 400 when start_date is after end_date', async () => {
    const res = await request(app).get(
      '/api/reports/average-wait-time?start_date=2026-05-12&end_date=2026-05-11'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'start_date must be before or equal to end_date',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('excludes records missing joined_at or called_at', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: 'queue-entry-complete',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T08:00:00.000Z',
            called_at: '2026-05-11T08:30:00.000Z',
          },
          {
            id: 'queue-entry-missing-called',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T09:00:00.000Z',
            called_at: null,
          },
          {
            id: 'queue-entry-missing-joined',
            clinic_id: validClinicId,
            joined_at: null,
            called_at: '2026-05-11T10:00:00.000Z',
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

    const res = await request(app).get('/api/reports/average-wait-time')

    expect(res.statusCode).toBe(200)
    expect(res.body.summary).toEqual({
      overall_average_wait_time_minutes: 30,
      queue_records_used: 1,
    })
    expect(res.body.by_clinic).toEqual([
      {
        clinic_id: validClinicId,
        clinic_name: 'Ubuntu Clinic',
        average_wait_time_minutes: 30,
        queue_records_used: 1,
      },
    ])
  })

  test('groups wait times by time-of-day boundaries from joined_at', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: 'morning-boundary',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T03:00:00.000Z',
            called_at: '2026-05-11T03:10:00.000Z',
          },
          {
            id: 'afternoon-boundary',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T10:00:00.000Z',
            called_at: '2026-05-11T10:10:00.000Z',
          },
          {
            id: 'evening-boundary',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T15:00:00.000Z',
            called_at: '2026-05-11T15:10:00.000Z',
          },
          {
            id: 'night-boundary',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T19:00:00.000Z',
            called_at: '2026-05-11T19:10:00.000Z',
          },
          {
            id: 'night-before-morning',
            clinic_id: validClinicId,
            joined_at: '2026-05-11T02:59:00.000Z',
            called_at: '2026-05-11T03:09:00.000Z',
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

    const res = await request(app).get('/api/reports/average-wait-time')

    expect(res.statusCode).toBe(200)
    expect(res.body.by_time_of_day).toEqual([
      {
        time_of_day: 'Morning',
        average_wait_time_minutes: 10,
        queue_records_used: 1,
      },
      {
        time_of_day: 'Afternoon',
        average_wait_time_minutes: 10,
        queue_records_used: 1,
      },
      {
        time_of_day: 'Evening',
        average_wait_time_minutes: 10,
        queue_records_used: 1,
      },
      {
        time_of_day: 'Night',
        average_wait_time_minutes: 10,
        queue_records_used: 2,
      },
    ])
  })

  test('returns 500 when queue lookup fails', async () => {
    scenario.thenable.queue_entries = [
      {
        data: null,
        error: new Error('Queue lookup failed'),
      },
    ]

    const res = await request(app).get('/api/reports/average-wait-time')

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      error: 'Failed to fetch average wait time report',
    })
  })
})
