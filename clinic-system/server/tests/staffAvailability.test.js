const request = require('supertest')
const app = require('../src/app')

jest.mock('@supabase/supabase-js', () => {
  const mockFrom = jest.fn()
  const mockSelect = jest.fn()
  const mockEq = jest.fn()
  const mockOrder = jest.fn()

  mockOrder.mockResolvedValue({ data: [], error: null })
  mockEq.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })

  return {
    createClient: jest.fn(() => ({
      from: mockFrom,
    })),
  }
})

const VALID_UUID = '0b0d9f9a-9a5e-47fe-92e0-7d1696e41464'
const INVALID_UUID = 'not-a-uuid'

describe('GET /api/staff/:staffId/availability', () => {
  it('returns 200 with empty array when staff has no availability', async () => {
    const res = await request(app).get(`/api/staff/${VALID_UUID}/availability`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('availability')
    expect(Array.isArray(res.body.availability)).toBe(true)
  })

  it('returns 400 for invalid staff ID', async () => {
    const res = await request(app).get(`/api/staff/${INVALID_UUID}/availability`)
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Invalid staff ID format')
  })
})