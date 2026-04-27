const request = require('supertest')

let app
let mockSupabase
let scenario
let createdBuilders = []

// Pull next mocked response for a specific table + method
function getNextResponse(bucket, table, fallback = { data: null, error: null }) {
  if (!bucket[table] || bucket[table].length === 0) {
    return fallback
  }
  return bucket[table].shift()
}

// Create a chainable mock query builder
function makeBuilder(table) {
  const builder = {
    table,

    select: jest.fn(function () {
      return this
    }),

    eq: jest.fn(function () {
      return this
    }),

    order: jest.fn(function () {
      return this
    }),

    insert: jest.fn(function () {
      return this
    }),

    update: jest.fn(function () {
      return this
    }),

    maybeSingle: jest.fn(function () {
      return Promise.resolve(getNextResponse(scenario.maybeSingle, table))
    }),

    single: jest.fn(function () {
      return Promise.resolve(getNextResponse(scenario.single, table))
    }),

    then(resolve, reject) {
      return Promise.resolve(getNextResponse(scenario.thenable, table)).then(
        resolve,
        reject
      )
    },
  }

  createdBuilders.push(builder)
  return builder
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}))

// Predefined IDs used across tests (UUID format for validity)
const validUserId = '00000000-0000-0000-0000-000000000010'
const secondValidUserId = '00000000-0000-0000-0000-000000000011'
const validAdminId = '00000000-0000-0000-0000-000000000012'
const nonAdminUserId = '00000000-0000-0000-0000-000000000013'
const validRequestId = '00000000-0000-0000-0000-000000000014'
const invalidId = 'invalid-id'

beforeEach(() => {
  jest.resetModules()
  createdBuilders = []

  scenario = {
    maybeSingle: {},
    single: {},
    thenable: {},
  }

  mockSupabase = {
    from: jest.fn((table) => makeBuilder(table)),
  }

  app = require('../../../src/app')
})



// Tests validation and submission logic
describe('Role request POST endpoint', () => {

  // Missing required fields -> should fail
  test('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({})

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'user_id and requested_role are required'
    })
  })

  // Invalid UUID format -> should fail validation
  test('returns 400 for invalid user ID format', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: invalidId,
        requested_role: 'Staff',
      })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid user ID format'
    })
  })

  // Invalid role (not allowed system roles)
  test('returns 400 for invalid requested role', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: validUserId,
        requested_role: 'SuperUser',
      })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid requested role'
    })
  })

  // Database lookup failure when checking user
  test('returns 500 when user lookup fails', async () => {
    scenario.maybeSingle.users = [
      { data: null, error: new Error('User lookup failed') },
    ]

    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: validUserId,
        requested_role: 'Staff',
      })

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      error: 'Failed to submit role request'
    })
  })

  // Valid format but user does not exist in DB
  test('returns 404 for unknown user', async () => {
    scenario.maybeSingle.users = [
      { data: null, error: null },
    ]

    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: secondValidUserId,
        requested_role: 'Staff',
      })

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({
      error: 'User not found'
    })
  })

  // Reject same-role request
  test('returns 400 when user already has the requested role', async () => {
    scenario.maybeSingle.users = [
      {
        data: { id: validUserId, role: 'Patient' },
        error: null,
      },
    ]

    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: validUserId,
        requested_role: 'Patient',
      })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'User already has this role'
    })
  })

  // Existing pending request lookup fails
  test('returns 500 when duplicate pending request lookup fails', async () => {
    scenario.maybeSingle.users = [
      {
        data: { id: validUserId, role: 'Patient' },
        error: null,
      },
    ]

    scenario.maybeSingle.role_requests = [
      { data: null, error: new Error('Pending lookup failed') },
    ]

    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: validUserId,
        requested_role: 'Admin',
      })

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      error: 'Failed to submit role request'
    })
  })

  // Duplicate submission scenario
  test('prevents duplicate role requests', async () => {
    scenario.maybeSingle.users = [
      {
        data: { id: validUserId, role: 'Patient' },
        error: null,
      },
    ]

    scenario.maybeSingle.role_requests = [
      { data: { id: validRequestId }, error: null },
    ]

    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: validUserId,
        requested_role: 'Admin',
      })

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      error: 'A pending request for this role already exists'
    })
  })

  // Insert failure on otherwise valid request
  test('returns 500 when inserting a valid role request fails', async () => {
    scenario.maybeSingle.users = [
      {
        data: { id: validUserId, role: 'Patient' },
        error: null,
      },
    ]

    scenario.maybeSingle.role_requests = [
      { data: null, error: null },
    ]

    scenario.single.role_requests = [
      { data: null, error: new Error('Insert failed') },
    ]

    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: validUserId,
        requested_role: 'Staff',
      })

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      error: 'Failed to submit role request'
    })
  })

  // Successful role request submission
  test('returns 201 for valid role request submission', async () => {
    scenario.maybeSingle.users = [
      {
        data: { id: validUserId, role: 'Patient' },
        error: null,
      },
    ]

    scenario.maybeSingle.role_requests = [
      { data: null, error: null },
    ]

    scenario.single.role_requests = [
      {
        data: {
          id: validRequestId,
          user_id: validUserId,
          requested_role: 'Staff',
          status: 'pending',
        },
        error: null,
      },
    ]

    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: validUserId,
        requested_role: 'Staff',
      })

    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({
      request: {
        id: validRequestId,
        user_id: validUserId,
        requested_role: 'Staff',
        status: 'pending',
      },
    })
  })

  // Force edge case to hit required-fields validation cleanly
  test('handles completely invalid input safely (edge case)', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: null,
        requested_role: null,
      })

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'user_id and requested_role are required'
    })
  })
})



// Tests admin access + retrieval logic
describe('Role request GET endpoint', () => {

  // Missing query parameter
  test('returns 400 if admin_id is missing', async () => {
    const res = await request(app).get('/api/role-requests')

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'admin_id is required'
    })
  })

  // Invalid UUID format
  test('returns 400 for invalid admin ID format', async () => {
    const res = await request(app)
      .get(`/api/role-requests?admin_id=${invalidId}`)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid admin ID format'
    })
  })

  // Admin lookup failure
  test('returns 500 when admin lookup fails', async () => {
    scenario.maybeSingle.users = [
      { data: null, error: new Error('Admin lookup failed') },
    ]

    const res = await request(app)
      .get(`/api/role-requests?admin_id=${validAdminId}`)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      error: 'Failed to fetch role requests'
    })
  })

  // Admin does not exist
  test('returns 404 for unknown admin', async () => {
    scenario.maybeSingle.users = [
      { data: null, error: null },
    ]

    const res = await request(app)
      .get(`/api/role-requests?admin_id=${secondValidUserId}`)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({
      error: 'Admin user not found'
    })
  })

  // Not an admin (authorization failure)
  test('returns 403 for non-admin user', async () => {
    scenario.maybeSingle.users = [
      {
        data: { id: nonAdminUserId, role: 'Patient' },
        error: null,
      },
    ]

    const res = await request(app)
      .get(`/api/role-requests?admin_id=${nonAdminUserId}`)

    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({
      error: 'Only admins can access role requests'
    })
  })

  // Query failure after valid admin check
  test('returns 500 when role request query fails', async () => {
    scenario.maybeSingle.users = [
      {
        data: { id: validAdminId, role: 'Admin' },
        error: null,
      },
    ]

    scenario.thenable.role_requests = [
      { data: null, error: new Error('Role request query failed') },
    ]

    const res = await request(app)
      .get(`/api/role-requests?admin_id=${validAdminId}`)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      error: 'Failed to fetch role requests'
    })
  })

  // Valid admin request
  test('returns role requests for valid admin', async () => {
    scenario.maybeSingle.users = [
      {
        data: { id: validAdminId, role: 'Admin' },
        error: null,
      },
    ]

    scenario.thenable.role_requests = [
      {
        data: [
          {
            id: validRequestId,
            user_id: validUserId,
            requested_role: 'Staff',
            status: 'pending',
            created_at: '2026-04-16T10:00:00.000Z',
            users: {
              full_name: 'Test User',
              email: 'test@example.com',
              role: 'Patient',
            },
          },
        ],
        error: null,
      },
    ]

    const res = await request(app)
      .get(`/api/role-requests?admin_id=${validAdminId}`)

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('requests')
    expect(Array.isArray(res.body.requests)).toBe(true)
    expect(res.body.requests).toHaveLength(1)
    expect(res.body.requests[0]).toHaveProperty('requested_role', 'Staff')
  })

  // Filtered requests
  test('supports filtering by status', async () => {
    scenario.maybeSingle.users = [
      {
        data: { id: validAdminId, role: 'Admin' },
        error: null,
      },
    ]

    scenario.thenable.role_requests = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app)
      .get(`/api/role-requests?admin_id=${validAdminId}&status=pending`)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ requests: [] })

    const roleRequestBuilder = createdBuilders.find(
      (builder) => builder.table === 'role_requests'
    )

    expect(roleRequestBuilder).toBeDefined()
    expect(roleRequestBuilder.eq).toHaveBeenCalledWith('status', 'pending')
  })

  // Weird query input (helps branch coverage)
  test('handles unexpected query values safely', async () => {
    scenario.maybeSingle.users = [
      {
        data: { id: validAdminId, role: 'Admin' },
        error: null,
      },
    ]

    scenario.thenable.role_requests = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app)
      .get(`/api/role-requests?admin_id=${validAdminId}&status=INVALID_STATUS`)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ requests: [] })
  })
})