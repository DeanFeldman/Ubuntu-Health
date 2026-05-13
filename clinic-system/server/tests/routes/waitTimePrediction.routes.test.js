const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const invalidId = 'invalid-id'

let app
let scenario

function buildHistoryRows() {
  return [
    {
      id: 'queue-history-1',
      clinic_id: validClinicId,
      joined_at: '2026-05-04T08:00:00.000Z',
      called_at: '2026-05-04T08:10:00.000Z',
      completed_at: '2026-05-04T08:30:00.000Z',
      status: 'Complete',
    },
    {
      id: 'queue-history-2',
      clinic_id: validClinicId,
      joined_at: '2026-05-05T08:00:00.000Z',
      called_at: '2026-05-05T08:20:00.000Z',
      completed_at: '2026-05-05T08:40:00.000Z',
      status: 'Complete',
    },
    {
      id: 'queue-history-3',
      clinic_id: validClinicId,
      joined_at: '2026-05-06T08:00:00.000Z',
      called_at: '2026-05-06T08:30:00.000Z',
      completed_at: '2026-05-06T08:50:00.000Z',
      status: 'Complete',
    },
  ]
}

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
})

describe('GET /api/clinics/:id/predicted-wait-time', () => {
  test('returns 400 for invalid clinic id', async () => {
    const res = await request(app).get(
      `/api/clinics/${invalidId}/predicted-wait-time`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid clinic ID format' })
  })

  test('returns predicted wait time when enough queue history exists', async () => {
    scenario.thenable.queue_entries = [
      {
        data: buildHistoryRows(),
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/clinics/${validClinicId}/predicted-wait-time`
    )

    expect(res.statusCode).toBe(200)
    expect(Number.isFinite(res.body.predictedWaitTime)).toBe(true)
    expect(res.body.predictedWaitTime).toBeGreaterThanOrEqual(0)
    expect(res.body.predictionBasedOnRows).toBe(3)
    expect(res.body.predictionFallbackUsed).toBe(false)
    expect(res.body.predictionStrategy).toBe('knn-regression')
    expect(res.body.predictionMessage).toBeNull()
  })

  test('uses estimated wait fallback when queue history is missing', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
      {
        count: 4,
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          appointment_duration_minutes: 15,
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
      `/api/clinics/${validClinicId}/predicted-wait-time`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.predictedWaitTime).toBe(30)
    expect(res.body.predictionBasedOnRows).toBe(0)
    expect(res.body.predictionFallbackUsed).toBe(true)
    expect(res.body.predictionStrategy).toBe('estimated-wait-fallback')
    expect(res.body.predictionMessage).toBe('Not enough historical queue data yet')
  })

  test('falls back safely when there are no historical records and no staff count', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
      {
        count: 3,
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          appointment_duration_minutes: 15,
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
      `/api/clinics/${validClinicId}/predicted-wait-time`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.predictedWaitTime).toBe(15)
    expect(res.body.predictionBasedOnRows).toBe(0)
    expect(res.body.predictionFallbackUsed).toBe(true)
    expect(res.body.predictionStrategy).toBe('estimated-wait-fallback')
    expect(res.body.predictionMessage).toBe('Estimate not available')
  })

  test('returns 500 when historical queue lookup fails', async () => {
    scenario.thenable.queue_entries = [
      {
        data: null,
        error: new Error('Queue history lookup failed'),
      },
    ]

    const res = await request(app).get(
      `/api/clinics/${validClinicId}/predicted-wait-time`
    )

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch predicted wait time' })
  })
})

describe('GET /api/queue/:clinicId/estimated-wait-time/:patientId', () => {
  test('returns 400 when clinic id is invalid', async () => {
    const res = await request(app).get(
      `/api/queue/${invalidId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('returns 400 when patient id is invalid', async () => {
    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${invalidId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid ID format' })
  })

  test('returns 404 when patient has no active waiting queue entry', async () => {
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
  })

  test('returns estimated and predicted wait time for a patient in the queue', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 3,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 2,
        error: null,
      },
      {
        data: buildHistoryRows(),
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          appointment_duration_minutes: 15,
        },
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 1,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.position).toBe(3)
    expect(res.body.patientsAhead).toBe(2)
    expect(res.body.appointmentDuration).toBe(15)
    expect(res.body.staffCount).toBe(1)
    expect(res.body.estimatedWaitTime).toBe(30)

    expect(Number.isFinite(res.body.predictedWaitTime)).toBe(true)
    expect(res.body.predictionBasedOnRows).toBe(3)
    expect(res.body.predictionFallbackUsed).toBe(false)
    expect(res.body.predictionStrategy).toBe('knn-regression')
    expect(res.body.predictionMessage).toBeNull()
  })

  test('uses prediction fallback when patient queue exists but history is missing', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: {
          position: 4,
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        count: 3,
        error: null,
      },
      {
        data: [],
        error: null,
      },
      {
        count: 6,
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          appointment_duration_minutes: 10,
        },
        error: null,
      },
      {
        data: {
          id: validClinicId,
          appointment_duration_minutes: 10,
        },
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        count: 2,
        error: null,
      },
      {
        count: 2,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.position).toBe(4)
    expect(res.body.patientsAhead).toBe(3)
    expect(res.body.estimatedWaitTime).toBe(15)

    expect(res.body.predictedWaitTime).toBe(15)
    expect(res.body.predictionBasedOnRows).toBe(0)
    expect(res.body.predictionFallbackUsed).toBe(true)
    expect(res.body.predictionStrategy).toBe('estimated-wait-fallback')
  })

  test('returns 500 when queue position lookup fails', async () => {
    scenario.maybeSingle.queue_entries = [
      {
        data: null,
        error: new Error('Queue position lookup failed'),
      },
    ]

    const res = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch estimated wait time' })
  })
})