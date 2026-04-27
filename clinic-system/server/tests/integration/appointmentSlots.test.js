const request = require('supertest')

const validClinicId = '00000000-0000-0000-0000-000000000001'

jest.mock('@supabase/supabase-js', () => {
  const from = jest.fn((table) => {
    if (table === 'clinics') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: validClinicId,
            operating_hours: {},
            appointment_duration_minutes: 30,
          },
          error: null,
        }),
      }
    }

    if (table === 'appointments') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [{ slot_id: 'slot-booked' }],
          error: null,
        }),
      }
    }

    if (table === 'slots') {
      return {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        lt: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'slot-booked',
              slot_datetime: '2099-05-10T10:00:00.000Z',
            },
          ],
          error: null,
        }),
      }
    }

    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

  return {
    createClient: jest.fn(() => ({ from })),
  }
})

jest.mock('../../src/clinicSchedule', () => ({
  resolveClinicSchedule: jest.fn(() => ({
    operating_hours: {},
    appointment_duration_minutes: 30,
  })),
  generateDailySlots: jest.fn(() => [
    '09:00',
    'bad-slot',
    '25:99',
    '09:00',
    '10:00',
  ]),
}))

const app = require('../../src/app')

describe('GET /api/appointments/slots', () => {
  it('returns only valid, unique, unbooked appointment slots', async () => {
    const response = await request(app)
      .get('/api/appointments/slots')
      .query({
        clinic_id: validClinicId,
        date: '2099-05-10',
      })

    expect(response.status).toBe(200)
    expect(response.body).toEqual(['09:00'])
  })

  it('rejects invalid slot retrieval input', async () => {
    const response = await request(app)
      .get('/api/appointments/slots')
      .query({
        clinic_id: 'not-a-uuid',
        date: '2099-05-10',
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Invalid clinic ID format')
  })
})