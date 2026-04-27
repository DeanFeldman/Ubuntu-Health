const request = require('supertest')
const app = require('../../src/app')

// Mock Supabase
jest.mock('@supabase/supabase-js', () => {
  const mockFrom = jest.fn()

  return {
    createClient: jest.fn(() => ({
      from: mockFrom,
    })),
  }
})

describe('App API basic routes', () => {
  it('GET /api returns health message', async () => {
    const res = await request(app).get('/api')

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('message')
  })
})

describe('Patient appointments endpoint', () => {
  it('returns empty appointments array when none exist', async () => {
    const supabase = require('@supabase/supabase-js')
    const mockFrom = supabase.createClient().from

    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    })

    const res = await request(app).get(
      '/api/appointments/patient/123e4567-e89b-12d3-a456-426614174000'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.appointments).toEqual([])
  })

  it('rejects invalid patient ID', async () => {
    const res = await request(app).get('/api/appointments/patient/invalid-id')

    expect(res.statusCode).toBe(400)
  })
})

describe('Clinic appointments endpoint (staff view)', () => {
  it('requires date param', async () => {
    const res = await request(app).get(
      '/api/appointments/clinic/123e4567-e89b-12d3-a456-426614174000'
    )

    expect(res.statusCode).toBe(400)
  })

  it('rejects invalid clinic ID', async () => {
    const res = await request(app).get(
      '/api/appointments/clinic/invalid-id?date=2026-01-01'
    )

    expect(res.statusCode).toBe(400)
  })
})