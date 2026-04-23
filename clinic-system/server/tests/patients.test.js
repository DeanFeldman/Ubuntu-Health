const request = require('supertest')
const app = require('../src/app')

jest.mock('@supabase/supabase-js', () => {
  const mockSingle = jest.fn()
  const mockSelect = jest.fn()
  const mockEq = jest.fn()
  const mockInsert = jest.fn()
  const mockFrom = jest.fn()

  mockSingle.mockResolvedValue({ data: null, error: null })
  mockEq.mockReturnValue({
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    select: mockSelect,
    eq: mockEq,
  })
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle })
  mockInsert.mockReturnValue({
    select: jest.fn().mockReturnValue({ single: mockSingle }),
  })
  mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, eq: mockEq })

  return {
    createClient: jest.fn(() => ({ from: mockFrom })),
  }
})

const VALID_UUID = '0b0d9f9a-9a5e-47fe-92e0-7d1696e41464'
const INVALID_UUID = 'not-a-uuid'

describe('POST /api/patients', () => {
  it('returns 400 when full_name is missing', async () => {
    const res = await request(app)
      .post('/api/patients')
      .send({
        email: 'john@example.com',
        created_by: VALID_UUID,
      })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'full_name is required')
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/patients')
      .send({
        full_name: 'John Doe',
        created_by: VALID_UUID,
      })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'email is required')
  })

  it('returns 400 when created_by is missing', async () => {
    const res = await request(app)
      .post('/api/patients')
      .send({
        full_name: 'John Doe',
        email: 'john@example.com',
      })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'created_by is required')
  })

  it('returns 400 when created_by is not a valid UUID', async () => {
    const res = await request(app)
      .post('/api/patients')
      .send({
        full_name: 'John Doe',
        email: 'john@example.com',
        created_by: INVALID_UUID,
      })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Invalid created_by ID format')
  })

  it('returns 400 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/patients')
      .send({
        full_name: 'John Doe',
        email: 'not-an-email',
        created_by: VALID_UUID,
      })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Invalid email format')
  })
})