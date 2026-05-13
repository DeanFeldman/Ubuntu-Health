const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'

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

describe('wait time prediction backend integration', () => {
  test('clinic prediction and patient queue wait endpoint both expose ML prediction when history exists', async () => {
    const historyRows = buildHistoryRows()

    scenario.thenable.queue_entries = [
      {
        data: historyRows,
        error: null,
      },
      {
        count: 2,
        error: null,
      },
      {
        data: historyRows,
        error: null,
      },
    ]

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

    const clinicPredictionResponse = await request(app).get(
      `/api/clinics/${validClinicId}/predicted-wait-time`
    )

    expect(clinicPredictionResponse.statusCode).toBe(200)
    expect(Number.isFinite(clinicPredictionResponse.body.predictedWaitTime)).toBe(
      true
    )
    expect(clinicPredictionResponse.body.predictionBasedOnRows).toBe(3)
    expect(clinicPredictionResponse.body.predictionFallbackUsed).toBe(false)
    expect(clinicPredictionResponse.body.predictionStrategy).toBe(
      'knn-regression'
    )

    const patientQueueResponse = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(patientQueueResponse.statusCode).toBe(200)
    expect(patientQueueResponse.body.position).toBe(3)
    expect(patientQueueResponse.body.patientsAhead).toBe(2)
    expect(patientQueueResponse.body.estimatedWaitTime).toBe(30)

    expect(Number.isFinite(patientQueueResponse.body.predictedWaitTime)).toBe(
      true
    )
    expect(patientQueueResponse.body.predictionBasedOnRows).toBe(3)
    expect(patientQueueResponse.body.predictionFallbackUsed).toBe(false)
    expect(patientQueueResponse.body.predictionStrategy).toBe('knn-regression')
  })

  test('clinic prediction and patient queue wait endpoint both fall back safely when no history exists', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
      {
        count: 4,
        error: null,
      },
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
      {
        count: 2,
        error: null,
      },
    ]

    const clinicPredictionResponse = await request(app).get(
      `/api/clinics/${validClinicId}/predicted-wait-time`
    )

    expect(clinicPredictionResponse.statusCode).toBe(200)
    expect(clinicPredictionResponse.body.predictedWaitTime).toBe(20)
    expect(clinicPredictionResponse.body.predictionBasedOnRows).toBe(0)
    expect(clinicPredictionResponse.body.predictionFallbackUsed).toBe(true)
    expect(clinicPredictionResponse.body.predictionStrategy).toBe(
      'estimated-wait-fallback'
    )
    expect(clinicPredictionResponse.body.predictionMessage).toBe(
      'Not enough historical queue data yet'
    )

    const patientQueueResponse = await request(app).get(
      `/api/queue/${validClinicId}/estimated-wait-time/${validPatientId}`
    )

    expect(patientQueueResponse.statusCode).toBe(200)
    expect(patientQueueResponse.body.position).toBe(4)
    expect(patientQueueResponse.body.patientsAhead).toBe(3)
    expect(patientQueueResponse.body.estimatedWaitTime).toBe(15)

    expect(patientQueueResponse.body.predictedWaitTime).toBe(15)
    expect(patientQueueResponse.body.predictionBasedOnRows).toBe(0)
    expect(patientQueueResponse.body.predictionFallbackUsed).toBe(true)
    expect(patientQueueResponse.body.predictionStrategy).toBe(
      'estimated-wait-fallback'
    )
  })
})