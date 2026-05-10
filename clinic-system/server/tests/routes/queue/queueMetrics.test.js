const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
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

describe('clinic queue metrics', () => {
  test('GET /api/clinics/:id/queue-metrics returns appointmentDuration and staffCount', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 20,
        },
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 2,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/clinics/${validClinicId}/queue-metrics`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      appointmentDuration: 20,
      staffCount: 2,
    })

    const clinicBuilder = createdBuilders[0]
    const staffBuilder = createdBuilders[1]

    expect(clinicBuilder.table).toBe('clinics')
    expect(clinicBuilder.select).toHaveBeenCalledWith(
      'appointment_duration_minutes'
    )
    expect(clinicBuilder.eq).toHaveBeenCalledWith('id', validClinicId)

    expect(staffBuilder.table).toBe('users')
    expect(staffBuilder.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    })
    expect(staffBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)
    expect(staffBuilder.in).toHaveBeenCalledWith('role', ['Staff', 'Admin'])
  })

  test('GET /api/clinics/:id/queue-metrics applies duration and staff fallbacks', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: null,
        },
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 0,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/clinics/${validClinicId}/queue-metrics`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      appointmentDuration: 15,
      staffCount: 0,
    })
  })

  test('GET /api/clinics/:id/queue-metrics returns 404 when clinic is missing', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/clinics/${validClinicId}/queue-metrics`
    )

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Clinic not found' })
    expect(createdBuilders).toHaveLength(1)
  })
})

describe('estimated wait time', () => {
  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId returns the full wait estimate', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 5,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 10,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 4,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 3,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 5,
      patientsAhead: 4,
      appointmentDuration: 10,
      staffCount: 3,
      estimatedWaitTime: 14,
    })

    const positionLookupBuilder = createdBuilders[0]
    const patientsAheadBuilder = createdBuilders[1]
    const clinicMetricsBuilder = createdBuilders[2]
    const staffMetricsBuilder = createdBuilders[3]

    expect(positionLookupBuilder.table).toBe('queue_entries')
    expect(positionLookupBuilder.select).toHaveBeenCalledWith('position')
    expect(positionLookupBuilder.eq).toHaveBeenCalledWith(
      'clinic_id',
      validClinicId
    )
    expect(positionLookupBuilder.eq).toHaveBeenCalledWith(
      'patient_id',
      validPatientId
    )
    expect(positionLookupBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')

    expect(patientsAheadBuilder.table).toBe('queue_entries')
    expect(patientsAheadBuilder.select).toHaveBeenCalledWith('*', {
      count: 'exact',
      head: true,
    })
    expect(patientsAheadBuilder.eq).toHaveBeenCalledWith(
      'clinic_id',
      validClinicId
    )
    expect(patientsAheadBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')
    expect(patientsAheadBuilder.lt).toHaveBeenCalledWith('position', 5)

    expect(clinicMetricsBuilder.table).toBe('clinics')
    expect(staffMetricsBuilder.table).toBe('users')
    expect(staffMetricsBuilder.in).toHaveBeenCalledWith('role', [
      'Staff',
      'Admin',
    ])
  })

  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId calculates the normal case', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 4,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 15,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 3,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 3,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 4,
      patientsAhead: 3,
      appointmentDuration: 15,
      staffCount: 3,
      estimatedWaitTime: 15,
    })
  })

  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId returns zero when no patients are ahead', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 1,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 15,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 0,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 3,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 1,
      patientsAhead: 0,
      appointmentDuration: 15,
      staffCount: 3,
      estimatedWaitTime: 0,
    })
  })

  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId returns unavailable when staff count is zero', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 4,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 15,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 3,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 0,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 4,
      patientsAhead: 3,
      appointmentDuration: 15,
      staffCount: 0,
      estimatedWaitTime: null,
      message: 'Estimate not available',
    })
  })

  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId falls back to fifteen minutes when duration is missing', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 4,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: null,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 3,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 3,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 4,
      patientsAhead: 3,
      appointmentDuration: 15,
      staffCount: 3,
      estimatedWaitTime: 15,
    })
  })

  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId scales for a large queue', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 48,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 20,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 47,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 4,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 48,
      patientsAhead: 47,
      appointmentDuration: 20,
      staffCount: 4,
      estimatedWaitTime: 235,
    })
  })

  test('GET /api/queue/:clinicId/estimated-wait-time/:patientId returns 404 when patient is not waiting', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({
      error: 'No active queue entry found for this patient',
    })
    expect(createdBuilders).toHaveLength(1)
  })
})

describe('queue position', () => {
  test('GET /api/queue/:clinicId/position/:patientId returns position and patientsAhead', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 4,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: 20,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 3,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 2,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/position/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 4,
      patientsAhead: 3,
      estimatedWaitTime: 30,
    })

    const positionLookupBuilder = createdBuilders[0]
    const patientsAheadBuilder = createdBuilders[1]
    const clinicMetricsBuilder = createdBuilders[2]
    const staffMetricsBuilder = createdBuilders[3]

    expect(positionLookupBuilder.table).toBe('queue_entries')
    expect(positionLookupBuilder.select).toHaveBeenCalledWith('position')
    expect(positionLookupBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')

    expect(patientsAheadBuilder.table).toBe('queue_entries')
    expect(patientsAheadBuilder.select).toHaveBeenCalledWith('*', {
      count: 'exact',
      head: true,
    })
    expect(patientsAheadBuilder.eq).toHaveBeenCalledWith(
      'clinic_id',
      validClinicId
    )
    expect(patientsAheadBuilder.eq).toHaveBeenCalledWith('status', 'Waiting')
    expect(patientsAheadBuilder.lt).toHaveBeenCalledWith('position', 4)

    expect(clinicMetricsBuilder.table).toBe('clinics')
    expect(staffMetricsBuilder.table).toBe('users')
    expect(staffMetricsBuilder.in).toHaveBeenCalledWith('role', [
      'Staff',
      'Admin',
    ])
  })

  test('GET /api/queue/:clinicId/position/:patientId returns zero estimatedWaitTime when nobody is ahead', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 1,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: null,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 0,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 0,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/position/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 1,
      patientsAhead: 0,
      estimatedWaitTime: null,
      message: 'Estimated wait time may be inaccurate',
    })
  })

  test('GET /api/queue/:clinicId/position/:patientId defaults missing duration to 15 minutes', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 3,
        },
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          appointment_duration_minutes: null,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 2,
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 2,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/position/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      position: 3,
      patientsAhead: 2,
      estimatedWaitTime: 15,
      message: 'Estimated wait time may be inaccurate',
    })
  })

  test('GET /api/queue/:clinicId/position/:patientId returns 404 when no waiting entry exists', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/position/${validPatientId}`
    )

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({
      error: 'No active queue entry found for this patient',
    })
    expect(createdBuilders).toHaveLength(1)
  })
})

describe('completed queue count', () => {
  test('GET /api/queue/:clinicId/completed-count returns 400 for invalid clinic id', async () => {
    const res = await request(app).get(
      `/api/queue/${invalidId}/completed-count`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid clinic ID format' })
  })

  test('GET /api/queue/:clinicId/completed-count returns count successfully', async () => {
    scenario.thenable.queue_entries = [
      {
        count: 4,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/completed-count`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ completedCount: 4 })
  })

  test('GET /api/queue/:clinicId/completed-count returns 500 on database error', async () => {
    scenario.thenable.queue_entries = [
      {
        count: null,
        error: new Error('Count query failed'),
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/completed-count`
    )

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch completed count' })
  })
})