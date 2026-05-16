const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validAppointmentId = '00000000-0000-0000-0000-000000000003'
const validQueueEntryId = '00000000-0000-0000-0000-000000000004'
const validSlotId = '00000000-0000-0000-0000-000000000005'
const invalidId = 'invalid-id'

let app
let scenario
let createdBuilders

let consoleErrorSpy

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
    const text = String(message)

    const expectedRouteErrors = [
      'Failed to fetch custom report:',
    ]

    if (expectedRouteErrors.some((expected) => text.includes(expected))) {
      return
    }

    process.stderr.write(`${text} ${args.map(String).join(' ')}\n`)
  })

  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('custom report', () => {
  test('appointment report derives date and time from joined slot data', async () => {
    scenario.thenable.appointments = [
      {
        data: [
          {
            id: validAppointmentId,
            patient_id: validPatientId,
            clinic_id: validClinicId,
            slot_id: validSlotId,
            status: 'Confirmed',
            service: 'General Consultation',
            slots: {
              id: validSlotId,
              slot_datetime: '2026-05-11T08:00:00',
            },
            clinics: {
              id: validClinicId,
              name: 'Ubuntu Clinic',
            },
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        data: [
          {
            id: validPatientId,
            full_name: 'Test Patient',
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.patients = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=appointments'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      report_type: 'appointments',
      filters: {
        clinic_id: null,
        clinic_name: 'All clinics',
        start_date: null,
        end_date: null,
        date_range_label: 'All time',
        status: null,
        status_label: 'All statuses',
      },
      total_records: 1,
      records: [
        {
          id: validAppointmentId,
          patient_name: 'Test Patient',
          clinic_id: validClinicId,
          clinic_name: 'Ubuntu Clinic',
          appointment_date: '2026-05-11',
          appointment_time: '08:00',
          appointment_status: 'Confirmed',
          service: 'General Consultation',
        },
      ],
    })

    const appointmentBuilder = createdBuilders[0]
    expect(appointmentBuilder.table).toBe('appointments')
    expect(appointmentBuilder.select).toHaveBeenCalledWith(
      'id, patient_id, clinic_id, slot_id, status, service, slots(id, slot_datetime), clinics(id, name)'
    )
  })

  test('queue report response includes report type, filters, total, and records', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: validQueueEntryId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            position: 1,
            status: 'Complete',
            joined_at: '2026-05-11T08:00:00.000Z',
            called_at: '2026-05-11T08:20:00.000Z',
            completed_at: '2026-05-11T08:45:00.000Z',
            clinics: {
              id: validClinicId,
              name: 'Ubuntu Clinic',
            },
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        data: [
          {
            id: validPatientId,
            full_name: 'Queue Patient',
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.patients = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get('/api/reports/custom?report_type=queue')

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      report_type: 'queue',
      filters: {
        clinic_id: null,
        clinic_name: 'All clinics',
        start_date: null,
        end_date: null,
        date_range_label: 'All time',
        status: null,
        status_label: 'All statuses',
      },
      total_records: 1,
      records: [
        {
          id: validQueueEntryId,
          patient_name: 'Queue Patient',
          clinic_id: validClinicId,
          clinic_name: 'Ubuntu Clinic',
          queue_position: 1,
          queue_status: 'Complete',
          joined_at: '2026-05-11T08:00:00.000Z',
          completed_at: '2026-05-11T08:45:00.000Z',
          updated_at: '2026-05-11T08:45:00.000Z',
        },
      ],
    })

    const queueBuilder = createdBuilders[0]
    expect(queueBuilder.table).toBe('queue_entries')
    expect(queueBuilder.select).toHaveBeenCalledWith(
      'id, clinic_id, patient_id, position, status, joined_at, called_at, completed_at, clinics(id, name)'
    )
    expect(queueBuilder.order).toHaveBeenCalledWith('joined_at', {
      ascending: true,
    })
  })

  test('default filter labels are returned correctly for empty results', async () => {
    scenario.thenable.appointments = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=appointments'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      report_type: 'appointments',
      filters: {
        clinic_id: null,
        clinic_name: 'All clinics',
        start_date: null,
        end_date: null,
        date_range_label: 'All time',
        status: null,
        status_label: 'All statuses',
      },
      total_records: 0,
      records: [],
    })
    expect(createdBuilders).toHaveLength(1)
  })

  test('selected clinic filter context is returned correctly', async () => {
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
      `/api/reports/custom?report_type=appointments&clinic_id=${validClinicId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters).toEqual({
      clinic_id: validClinicId,
      clinic_name: 'Ubuntu Clinic',
      start_date: null,
      end_date: null,
      date_range_label: 'All time',
      status: null,
      status_label: 'All statuses',
    })

    const clinicBuilder = createdBuilders[0]
    const appointmentBuilder = createdBuilders[1]

    expect(clinicBuilder.table).toBe('clinics')
    expect(clinicBuilder.eq).toHaveBeenCalledWith('id', validClinicId)
    expect(appointmentBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)
  })

  test('selected status filter context is returned correctly', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=queue&status=Called'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters.status).toBe('Called')
    expect(res.body.filters.status_label).toBe('Called')
    expect(createdBuilders[0].eq).toHaveBeenCalledWith('status', 'Called')
  })

  test('applies appointment start_date and end_date filters using slot datetime', async () => {
    scenario.thenable.appointments = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=appointments&start_date=2026-05-01&end_date=2026-05-11'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters.date_range_label).toBe('2026-05-01 to 2026-05-11')

    const appointmentBuilder = createdBuilders[0]
    expect(appointmentBuilder.select).toHaveBeenCalledWith(
      'id, patient_id, clinic_id, slot_id, status, service, slots!inner(id, slot_datetime), clinics(id, name)'
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

  test('applies queue start_date and end_date filters using joined_at', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=queue&start_date=2026-05-01&end_date=2026-05-11'
    )

    expect(res.statusCode).toBe(200)

    const queueBuilder = createdBuilders[0]
    expect(queueBuilder.gte).toHaveBeenCalledWith(
      'joined_at',
      '2026-05-01T00:00:00.000Z'
    )
    expect(queueBuilder.lte).toHaveBeenCalledWith(
      'joined_at',
      '2026-05-11T23:59:59.999Z'
    )
  })

  test('missing patient name does not crash the endpoint', async () => {
    scenario.thenable.appointments = [
      {
        data: [
          {
            id: validAppointmentId,
            patient_id: validPatientId,
            clinic_id: validClinicId,
            slot_id: validSlotId,
            status: 'Confirmed',
            service: null,
            slots: {
              id: validSlotId,
              slot_datetime: '2026-05-11T09:30:00',
            },
            clinics: {
              id: validClinicId,
              name: 'Ubuntu Clinic',
            },
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        data: [],
        error: null,
      },
    ]

    scenario.thenable.patients = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=appointments'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.total_records).toBe(1)
    expect(res.body.records[0]).toEqual({
      id: validAppointmentId,
      patient_name: 'Unknown patient',
      clinic_id: validClinicId,
      clinic_name: 'Ubuntu Clinic',
      appointment_date: '2026-05-11',
      appointment_time: '09:30',
      appointment_status: 'Confirmed',
      service: null,
    })
  })

  test('returns 400 for invalid report_type', async () => {
    const res = await request(app).get(
      '/api/reports/custom?report_type=unknown'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid report_type. Use appointments or queue',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 400 for invalid clinic id format', async () => {
    const res = await request(app).get(
      `/api/reports/custom?report_type=appointments&clinic_id=${invalidId}`
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
      `/api/reports/custom?report_type=appointments&clinic_id=${validClinicId}`
    )

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Clinic not found' })
    expect(createdBuilders).toHaveLength(1)
    expect(createdBuilders[0].table).toBe('clinics')
  })

  test('returns 400 for invalid date', async () => {
    const res = await request(app).get(
      '/api/reports/custom?report_type=queue&start_date=2026-02-31'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid start_date value. Use YYYY-MM-DD',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 400 when start_date is after end_date', async () => {
    const res = await request(app).get(
      '/api/reports/custom?report_type=queue&start_date=2026-05-12&end_date=2026-05-11'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'start_date must be before or equal to end_date',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 400 for invalid status for selected report type', async () => {
    const res = await request(app).get(
      '/api/reports/custom?report_type=queue&status=Completed'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid status for queue report',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns a safe 500 response when the report query fails', async () => {
    scenario.thenable.appointments = [
      {
        data: null,
        error: new Error('Appointment report failed'),
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=appointments'
    )

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      error: 'Failed to fetch custom report',
    })
  })
  test('normalizes report_type, status, and date query values before filtering', async () => {
  scenario.thenable.queue_entries = [
    {
      data: [],
      error: null,
    },
  ]

  const res = await request(app).get(
    '/api/reports/custom?report_type=%20QUEUE%20&status=%20Waiting%20&start_date=%202026-05-01%20&end_date=%202026-05-11%20'
  )

  expect(res.statusCode).toBe(200)

  expect(res.body.report_type).toBe('queue')
  expect(res.body.filters).toEqual({
    clinic_id: null,
    clinic_name: 'All clinics',
    start_date: '2026-05-01',
    end_date: '2026-05-11',
    date_range_label: '2026-05-01 to 2026-05-11',
    status: 'Waiting',
    status_label: 'Waiting',
  })

  const queueBuilder = createdBuilders[0]

  expect(queueBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')
  expect(queueBuilder.gte).toHaveBeenCalledWith(
    'joined_at',
    '2026-05-01T00:00:00.000Z'
  )
  expect(queueBuilder.lte).toHaveBeenCalledWith(
    'joined_at',
    '2026-05-11T23:59:59.999Z'
  )
})

test('treats status=all as no status filter', async () => {
  scenario.thenable.appointments = [
    {
      data: [],
      error: null,
    },
  ]

  const res = await request(app).get(
    '/api/reports/custom?report_type=appointments&status=all'
  )

  expect(res.statusCode).toBe(200)
  expect(res.body.filters.status).toBeNull()
  expect(res.body.filters.status_label).toBe('All statuses')

  const appointmentBuilder = createdBuilders[0]
  expect(appointmentBuilder.eq).not.toHaveBeenCalledWith('status', 'all')
})

test('uses patient table fallback when user name is missing', async () => {
  scenario.thenable.appointments = [
    {
      data: [
        {
          id: validAppointmentId,
          patient_id: validPatientId,
          clinic_id: validClinicId,
          slot_id: validSlotId,
          status: 'Confirmed',
          service: 'General Consultation',
          slots: {
            id: validSlotId,
            slot_datetime: '2026-05-11T09:30:00',
          },
          clinics: {
            id: validClinicId,
            name: 'Ubuntu Clinic',
          },
        },
      ],
      error: null,
    },
  ]

  scenario.thenable.users = [
    {
      data: [],
      error: null,
    },
  ]

  scenario.thenable.patients = [
    {
      data: [
        {
          id: validPatientId,
          full_name: 'Fallback Patient',
        },
      ],
      error: null,
    },
  ]

  const res = await request(app).get(
    '/api/reports/custom?report_type=appointments'
  )

  expect(res.statusCode).toBe(200)
  expect(res.body.records[0].patient_name).toBe('Fallback Patient')
})

test('queue report uses called_at as updated_at when completed_at is missing', async () => {
  scenario.thenable.queue_entries = [
    {
      data: [
        {
          id: validQueueEntryId,
          clinic_id: validClinicId,
          patient_id: validPatientId,
          position: 2,
          status: 'Called',
          joined_at: '2026-05-11T08:00:00.000Z',
          called_at: '2026-05-11T08:20:00.000Z',
          completed_at: null,
          clinics: {
            id: validClinicId,
            name: 'Ubuntu Clinic',
          },
        },
      ],
      error: null,
    },
  ]

  scenario.thenable.users = [
    {
      data: [
        {
          id: validPatientId,
          full_name: 'Queue Patient',
        },
      ],
      error: null,
    },
  ]

  scenario.thenable.patients = [
    {
      data: [],
      error: null,
    },
  ]

  const res = await request(app).get('/api/reports/custom?report_type=queue')

  expect(res.statusCode).toBe(200)
  expect(res.body.records[0]).toEqual({
    id: validQueueEntryId,
    patient_name: 'Queue Patient',
    clinic_id: validClinicId,
    clinic_name: 'Ubuntu Clinic',
    queue_position: 2,
    queue_status: 'Called',
    joined_at: '2026-05-11T08:00:00.000Z',
    completed_at: null,
    updated_at: '2026-05-11T08:20:00.000Z',
  })
})

test('returns a safe 500 response when patient lookup fails', async () => {
  scenario.thenable.appointments = [
    {
      data: [
        {
          id: validAppointmentId,
          patient_id: validPatientId,
          clinic_id: validClinicId,
          slot_id: validSlotId,
          status: 'Confirmed',
          service: 'General Consultation',
          slots: {
            id: validSlotId,
            slot_datetime: '2026-05-11T09:30:00',
          },
          clinics: {
            id: validClinicId,
            name: 'Ubuntu Clinic',
          },
        },
      ],
      error: null,
    },
  ]

  scenario.thenable.users = [
    {
      data: null,
      error: new Error('User lookup failed'),
    },
  ]

  const res = await request(app).get(
    '/api/reports/custom?report_type=appointments'
  )

  expect(res.statusCode).toBe(500)
  expect(res.body).toEqual({
    error: 'Failed to fetch custom report',
  })
})
})
