const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const secondClinicId = '00000000-0000-0000-0000-000000000002'
const invalidId = 'invalid-id'

let app
let scenario
let createdBuilders

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
})

function appointment(overrides = {}) {
  return {
    id: 'appointment-1',
    clinic_id: validClinicId,
    slot_id: 'slot-1',
    status: 'Confirmed',
    slots: {
      id: 'slot-1',
      slot_datetime: '2026-05-11T08:00:00.000Z',
    },
    clinics: {
      id: validClinicId,
      name: 'Ubuntu Clinic',
    },
    ...overrides,
  }
}

describe('no-show report', () => {
  test('GET /api/reports/no-shows returns all-clinic all-time counts by default', async () => {
    scenario.thenable.appointments = [
      {
        data: [
          appointment({ id: 'confirmed', status: 'Confirmed' }),
          appointment({ id: 'waiting', status: 'Waiting' }),
          appointment({ id: 'completed', status: 'Completed' }),
          appointment({ id: 'cancelled', status: 'Cancelled' }),
          appointment({ id: 'no-show', status: 'No-show' }),
          appointment({
            id: 'second-clinic-no-show',
            clinic_id: secondClinicId,
            status: 'No-show',
            clinics: {
              id: secondClinicId,
              name: 'Hope Clinic',
            },
          }),
        ],
        error: null,
      },
    ]

    const res = await request(app).get('/api/reports/no-shows')

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
        scheduled_appointments: 6,
        completed_appointments: 1,
        cancelled_appointments: 1,
        no_show_appointments: 2,
        no_show_rate_percent: 33.33,
      },
      by_clinic: [
        {
          clinic_id: secondClinicId,
          clinic_name: 'Hope Clinic',
          scheduled_appointments: 1,
          completed_appointments: 0,
          cancelled_appointments: 0,
          no_show_appointments: 1,
          no_show_rate_percent: 100,
        },
        {
          clinic_id: validClinicId,
          clinic_name: 'Ubuntu Clinic',
          scheduled_appointments: 5,
          completed_appointments: 1,
          cancelled_appointments: 1,
          no_show_appointments: 1,
          no_show_rate_percent: 20,
        },
      ],
    })

    const appointmentBuilder = createdBuilders[0]
    expect(appointmentBuilder.table).toBe('appointments')
    expect(appointmentBuilder.select).toHaveBeenCalledWith(
      'id, clinic_id, slot_id, status, slots(id, slot_datetime), clinics(id, name)'
    )
    expect(appointmentBuilder.eq).not.toHaveBeenCalled()
    expect(appointmentBuilder.gte).not.toHaveBeenCalled()
    expect(appointmentBuilder.lte).not.toHaveBeenCalled()
  })

  test('accepts clinic_id=all as all clinics without clinic lookup', async () => {
    scenario.thenable.appointments = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get('/api/reports/no-shows?clinic_id=all')

    expect(res.statusCode).toBe(200)
    expect(res.body.filters.clinic_id).toBe(null)
    expect(res.body.filters.clinic_name).toBe('All clinics')
    expect(createdBuilders).toHaveLength(1)
    expect(createdBuilders[0].table).toBe('appointments')
  })

  test('filters by valid selected clinic and returns selected clinic context', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          name: 'Ubuntu Clinic',
        },
        error: null,
      },
    ]

    scenario.thenable.appointments = [
      {
        data: [
          appointment({ id: 'completed', status: 'Completed' }),
          appointment({ id: 'cancelled', status: 'Cancelled' }),
          appointment({ id: 'no-show', status: 'No-show' }),
        ],
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/reports/no-shows?clinic_id=${validClinicId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters).toEqual({
      clinic_id: validClinicId,
      clinic_name: 'Ubuntu Clinic',
      start_date: null,
      end_date: null,
      date_range_label: 'All time',
    })
    expect(res.body.summary).toEqual({
      scheduled_appointments: 3,
      completed_appointments: 1,
      cancelled_appointments: 1,
      no_show_appointments: 1,
      no_show_rate_percent: 33.33,
    })
    expect(res.body.by_clinic).toEqual([
      {
        clinic_id: validClinicId,
        clinic_name: 'Ubuntu Clinic',
        scheduled_appointments: 3,
        completed_appointments: 1,
        cancelled_appointments: 1,
        no_show_appointments: 1,
        no_show_rate_percent: 33.33,
      },
    ])

    const clinicLookupBuilder = createdBuilders[0]
    const appointmentBuilder = createdBuilders[1]

    expect(clinicLookupBuilder.table).toBe('clinics')
    expect(clinicLookupBuilder.eq).toHaveBeenCalledWith('id', validClinicId)
    expect(appointmentBuilder.table).toBe('appointments')
    expect(appointmentBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)
  })

  test('applies selected date range filters using slot datetime', async () => {
    scenario.thenable.appointments = [
      {
        data: [
          appointment({ id: 'completed', status: 'Completed' }),
          appointment({ id: 'no-show', status: 'No-show' }),
        ],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/no-shows?start_date=2026-05-01&end_date=2026-05-11'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters).toEqual({
      clinic_id: null,
      clinic_name: 'All clinics',
      start_date: '2026-05-01',
      end_date: '2026-05-11',
      date_range_label: '2026-05-01 to 2026-05-11',
    })
    expect(res.body.summary).toEqual({
      scheduled_appointments: 2,
      completed_appointments: 1,
      cancelled_appointments: 0,
      no_show_appointments: 1,
      no_show_rate_percent: 50,
    })

    const appointmentBuilder = createdBuilders[0]
    expect(appointmentBuilder.select).toHaveBeenCalledWith(
      'id, clinic_id, slot_id, status, slots!inner(id, slot_datetime), clinics(id, name)'
    )
    expect(appointmentBuilder.gte).toHaveBeenCalledWith(
      'slots.slot_datetime',
      '2026-05-01T00:00:00.000Z'
    )
    expect(appointmentBuilder.lte).toHaveBeenCalledWith(
      'slots.slot_datetime',
      '2026-05-11T23:59:59.999Z'
    )
  })

  test('applies start_date only and labels the open-ended range', async () => {
    scenario.thenable.appointments = [
      {
        data: [
          appointment({ id: 'no-show', status: 'No-show' }),
        ],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/no-shows?start_date=2026-05-01'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters).toEqual({
      clinic_id: null,
      clinic_name: 'All clinics',
      start_date: '2026-05-01',
      end_date: null,
      date_range_label: 'From 2026-05-01',
    })

    const appointmentBuilder = createdBuilders[0]
    expect(appointmentBuilder.gte).toHaveBeenCalledWith(
      'slots.slot_datetime',
      '2026-05-01T00:00:00.000Z'
    )
    expect(appointmentBuilder.lte).not.toHaveBeenCalled()
  })

  test('applies end_date only and labels the open-ended range', async () => {
    scenario.thenable.appointments = [
      {
        data: [
          appointment({ id: 'completed', status: 'Completed' }),
        ],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/no-shows?end_date=2026-05-11'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters).toEqual({
      clinic_id: null,
      clinic_name: 'All clinics',
      start_date: null,
      end_date: '2026-05-11',
      date_range_label: 'Up to 2026-05-11',
    })

    const appointmentBuilder = createdBuilders[0]
    expect(appointmentBuilder.gte).not.toHaveBeenCalled()
    expect(appointmentBuilder.lte).toHaveBeenCalledWith(
      'slots.slot_datetime',
      '2026-05-11T23:59:59.999Z'
    )
  })

  test('returns selected clinic row with zero counts when no appointments match', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          name: 'Ubuntu Clinic',
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

    const res = await request(app).get(
      `/api/reports/no-shows?clinic_id=${validClinicId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.summary).toEqual({
      scheduled_appointments: 0,
      completed_appointments: 0,
      cancelled_appointments: 0,
      no_show_appointments: 0,
      no_show_rate_percent: 0,
    })
    expect(res.body.by_clinic).toEqual([
      {
        clinic_id: validClinicId,
        clinic_name: 'Ubuntu Clinic',
        scheduled_appointments: 0,
        completed_appointments: 0,
        cancelled_appointments: 0,
        no_show_appointments: 0,
        no_show_rate_percent: 0,
      },
    ])
  })

  test('returns 400 for invalid clinic id format', async () => {
    const res = await request(app).get(
      `/api/reports/no-shows?clinic_id=${invalidId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid clinic ID format' })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 404 when selected clinic does not exist', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/reports/no-shows?clinic_id=${validClinicId}`
    )

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Clinic not found' })
    expect(createdBuilders).toHaveLength(1)
  })

  test('returns 400 for invalid start_date', async () => {
    const res = await request(app).get(
      '/api/reports/no-shows?start_date=2026-02-31'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid start_date value. Use YYYY-MM-DD',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 400 for invalid end_date', async () => {
    const res = await request(app).get(
      '/api/reports/no-shows?end_date=bad-date'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid end_date format. Use YYYY-MM-DD',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 400 when start_date is after end_date', async () => {
    const res = await request(app).get(
      '/api/reports/no-shows?start_date=2026-05-12&end_date=2026-05-11'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'start_date must be before or equal to end_date',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 500 when appointment lookup fails', async () => {
    scenario.thenable.appointments = [
      {
        data: null,
        error: new Error('Appointment lookup failed'),
      },
    ]

    const res = await request(app).get('/api/reports/no-shows')

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      error: 'Failed to fetch no-show report',
    })
  })

  test('returns zero counts and zero no-show rate when no appointments match', async () => {
    scenario.thenable.appointments = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get('/api/reports/no-shows')

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
        scheduled_appointments: 0,
        completed_appointments: 0,
        cancelled_appointments: 0,
        no_show_appointments: 0,
        no_show_rate_percent: 0,
      },
      by_clinic: [],
    })
  })
  test('returns 500 when selected clinic lookup fails', async () => {
  scenario.maybeSingle.clinics = [
    {
      data: null,
      error: new Error('Clinic lookup failed'),
    },
  ]

  const res = await request(app).get(
    `/api/reports/no-shows?clinic_id=${validClinicId}`
  )

  expect(res.statusCode).toBe(500)
  expect(res.body).toEqual({
    error: 'Failed to fetch no-show report',
  })
})
test('trims clinic and date query values before applying filters', async () => {
  scenario.maybeSingle.clinics = [
    {
      data: {
        id: validClinicId,
        name: 'Ubuntu Clinic',
      },
      error: null,
    },
  ]

  scenario.thenable.appointments = [
    {
      data: [
        appointment({
          id: 'trimmed-filter-no-show',
          status: 'No-show',
        }),
      ],
      error: null,
    },
  ]

  const res = await request(app).get(
    `/api/reports/no-shows?clinic_id=%20${validClinicId}%20&start_date=%202026-05-01%20&end_date=%202026-05-11%20`
  )

  expect(res.statusCode).toBe(200)

  expect(res.body.filters).toEqual({
    clinic_id: validClinicId,
    clinic_name: 'Ubuntu Clinic',
    start_date: '2026-05-01',
    end_date: '2026-05-11',
    date_range_label: '2026-05-01 to 2026-05-11',
  })

  const clinicLookupBuilder = createdBuilders[0]
  const appointmentBuilder = createdBuilders[1]

  expect(clinicLookupBuilder.eq).toHaveBeenCalledWith('id', validClinicId)
  expect(appointmentBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)
  expect(appointmentBuilder.gte).toHaveBeenCalledWith(
    'slots.slot_datetime',
    '2026-05-01T00:00:00.000Z'
  )
  expect(appointmentBuilder.lte).toHaveBeenCalledWith(
    'slots.slot_datetime',
    '2026-05-11T23:59:59.999Z'
  )
})
})
