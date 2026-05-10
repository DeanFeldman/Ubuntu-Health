const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validSlotId = '00000000-0000-0000-0000-000000000020'
const invalidId = 'invalid-id'

const FUTURE_MONDAY = '2099-05-11'
const FUTURE_SATURDAY = '2099-05-16'

let app
let scenario

function mockClinicBookingCapacity(count = 1) {
  scenario.thenable.users = [
    {
      count,
      error: null,
    },
    {
      count,
      error: null,
    },
  ]
}

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
})

describe('GET /api/appointments/slots', () => {
    test('returns 400 when clinic_id is missing', async () => {
      const res = await request(app)
        .get('/api/appointments/slots')
        .query({ date: FUTURE_MONDAY })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'clinic_id is required' })
    })


    test('returns 400 for invalid clinic id', async () => {
      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: invalidId,
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'Invalid clinic ID format' })
    })

    test('returns 400 when appointment slot date is in the past', async () => {
      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: '2020-01-01',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Past dates cannot be used for slot retrieval',
      })
    })

    test('returns 404 when clinic is not found', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({ error: 'Clinic not found' })
    })

    test('returns available appointment slots for clinic day', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: {
            id: validClinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
          error: null,
        },
      ]
      mockClinicBookingCapacity(1)
      scenario.thenable.appointments = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toContain('07:30')
      expect(res.body).toContain('07:45')
    })

    test('returns default weekday slots from opening time up to before closing time', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: {
            id: validClinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
          error: null,
        },
      ]
      mockClinicBookingCapacity(1)
      scenario.thenable.appointments = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body.slice(0, 4)).toEqual(['07:30', '07:45', '08:00', '08:15'])
      expect(res.body.at(-1)).toBe('16:15')
      expect(res.body).not.toContain('16:30')
    })

    test('uses clinic-specific operating hours and appointment duration for slots', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: {
            id: validClinicId,
            operating_hours: {
              monday: { open: '09:10', close: '10:10' },
            },
            appointment_duration_minutes: 20,
          },
          error: null,
        },
      ]
      mockClinicBookingCapacity(1)
      scenario.thenable.appointments = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual(['09:10', '09:30', '09:50'])
    })

    test('returns empty slots array for closed clinic day', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: {
            id: validClinicId,
            operating_hours: null,
            appointment_duration_minutes: null,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: FUTURE_SATURDAY,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual([])
    })

    test('returns 500 when clinic lookup fails', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: null,
          error: new Error('Clinic lookup failed'),
        },
      ]

      const res = await request(app)
        .get('/api/appointments/slots')
        .query({
          clinic_id: validClinicId,
          date: FUTURE_MONDAY,
        })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: 'Failed to fetch appointment slots' })
    })
  test('removes fully booked appointment slots from available slots', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          operating_hours: null,
          appointment_duration_minutes: null,
        },
        error: null,
      },
    ]

    mockClinicBookingCapacity(1)

    scenario.thenable.appointments = [
      {
        data: [
          {
            slot_id: validSlotId,
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
            slot_datetime: `${FUTURE_MONDAY}T05:30:00.000Z`,
          },
        ],
        error: null,
      },
    ]

    const res = await request(app)
      .get('/api/appointments/slots')
      .query({
        clinic_id: validClinicId,
        date: FUTURE_MONDAY,
      })

    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain('07:30')
    expect(res.body).toContain('07:45')
  })

  test('returns empty slots when clinic has no assigned staff', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          operating_hours: null,
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

    const res = await request(app)
      .get('/api/appointments/slots')
      .query({
        clinic_id: validClinicId,
        date: FUTURE_MONDAY,
      })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([])
  })
})
