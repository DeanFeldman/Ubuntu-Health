const request = require('supertest')
const app = require('../../src/app')

let mockDb = {
  user: { id: '0b0d9f9a-9a5e-47fe-92e0-7d1696e41464', role: 'Staff' },
  existingPatient: null,
  insertedPatient: { id: 'patient-123', full_name: 'John Doe' },
}

jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => ({
      from: (table) => {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                if (table === 'users') {
                  return { data: mockDb.user, error: null }
                }
                if (table === 'patients') {
                  return { data: mockDb.existingPatient, error: null }
                }
                return { data: null, error: null }
              },
            }),
            single: async () => ({
              data: mockDb.user,
              error: null,
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: mockDb.insertedPatient,
                error: null,
              }),
            }),
          }),
        }
      },
    })),
  }
})
const VALID_UUID = '0b0d9f9a-9a5e-47fe-92e0-7d1696e41464'
const INVALID_UUID = 'not-a-uuid'

beforeEach(() => {
  mockDb = {
    user: { id: VALID_UUID, role: 'Staff' },
    existingPatient: null,
    insertedPatient: { id: 'patient-123', full_name: 'John Doe' },
  }
})


describe('POST /api/patients', () => {

  it('returns 400 when full_name is missing', async () => {
    const res = await request(app).post('/api/patients').send({
      email: 'john@example.com',
      created_by: VALID_UUID,
    })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'full_name is required')
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/patients').send({
      full_name: 'John Doe',
      created_by: VALID_UUID,
    })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'email is required')
  })

  it('returns 400 when created_by is missing', async () => {
    const res = await request(app).post('/api/patients').send({
      full_name: 'John Doe',
      email: 'john@example.com',
    })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'created_by is required')
  })

  it('returns 400 when created_by is not a valid UUID', async () => {
    const res = await request(app).post('/api/patients').send({
      full_name: 'John Doe',
      email: 'john@example.com',
      created_by: INVALID_UUID,
    })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Invalid created_by ID format')
  })

  it('returns 400 when email is invalid', async () => {
    const res = await request(app).post('/api/patients').send({
      full_name: 'John Doe',
      email: 'not-an-email',
      created_by: VALID_UUID,
    })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Invalid email format')
  })


  it('returns 404 when created_by user not found', async () => {
    mockDb.user = null

    const res = await request(app).post('/api/patients').send({
      full_name: 'John Doe',
      email: 'john@example.com',
      created_by: VALID_UUID,
    })

    expect(res.status).toBe(404)
  })

  it('returns 403 when user is not staff/admin', async () => {
    mockDb.user = { id: VALID_UUID, role: 'Patient' }

    const res = await request(app).post('/api/patients').send({
      full_name: 'John Doe',
      email: 'john@example.com',
      created_by: VALID_UUID,
    })

    expect(res.status).toBe(403)
  })

  it('returns 409 when email already exists', async () => {
    mockDb.existingPatient = { id: 'existing-id' }

    const res = await request(app).post('/api/patients').send({
      full_name: 'John Doe',
      email: 'john@example.com',
      created_by: VALID_UUID,
    })

    expect(res.status).toBe(409)
    expect(res.body).toHaveProperty('error')
  })


  it('returns 201 and created patient for valid input', async () => {
    const res = await request(app).post('/api/patients').send({
      full_name: 'John Doe',
      email: 'john@example.com',
      created_by: VALID_UUID,
    })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('patient')
    expect(res.body.patient).toHaveProperty('id')
  })
})