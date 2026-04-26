const request = require('supertest')
const app = require('../../src/app')

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
describe('POST /api/staff/:staffId/availability', () => {
  it('returns 400 for invalid staff ID', async () => {
    const res = await request(app)
      .post(`/api/staff/${INVALID_UUID}/availability`)
      .send({ day_of_week: 1, start_time: '08:00', end_time: '16:00' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Invalid staff ID format')
  })

  it('returns 400 when day_of_week is missing', async () => {
    const res = await request(app)
      .post(`/api/staff/${VALID_UUID}/availability`)
      .send({ start_time: '08:00', end_time: '16:00' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'day_of_week is required')
  })

  it('returns 400 when day_of_week is out of range', async () => {
    const res = await request(app)
      .post(`/api/staff/${VALID_UUID}/availability`)
      .send({ day_of_week: 7, start_time: '08:00', end_time: '16:00' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'day_of_week must be an integer between 0 and 6')
  })

  it('returns 400 when start_time or end_time is missing', async () => {
    const res = await request(app)
      .post(`/api/staff/${VALID_UUID}/availability`)
      .send({ day_of_week: 1, start_time: '08:00' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'start_time and end_time are required')
  })

  it('returns 400 when start_time is after end_time', async () => {
    const res = await request(app)
      .post(`/api/staff/${VALID_UUID}/availability`)
      .send({ day_of_week: 1, start_time: '16:00', end_time: '08:00' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'start_time must be before end_time')
  })
})
describe('PATCH /api/staff/:staffId/availability/:availabilityId', () => {
  const VALID_AVAILABILITY_ID = '8a8d439e-6634-44df-be8e-f51b9e0ca87a'

  it('returns 400 for invalid staff ID', async () => {
    const res = await request(app)
      .patch(`/api/staff/${INVALID_UUID}/availability/${VALID_AVAILABILITY_ID}`)
      .send({ start_time: '09:00', end_time: '17:00' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Invalid ID format')
  })

  it('returns 400 for invalid availability ID', async () => {
    const res = await request(app)
      .patch(`/api/staff/${VALID_UUID}/availability/${INVALID_UUID}`)
      .send({ start_time: '09:00', end_time: '17:00' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Invalid ID format')
  })

  it('returns 400 when no fields are provided', async () => {
    const res = await request(app)
      .patch(`/api/staff/${VALID_UUID}/availability/${VALID_AVAILABILITY_ID}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'At least one field must be provided to update')
  })

  it('returns 400 when start_time is after end_time', async () => {
    const res = await request(app)
      .patch(`/api/staff/${VALID_UUID}/availability/${VALID_AVAILABILITY_ID}`)
      .send({ start_time: '17:00', end_time: '09:00' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'start_time must be before end_time')
  })
})