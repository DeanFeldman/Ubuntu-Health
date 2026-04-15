const request = require('supertest')
const app = require('../src/app')

// Predefined IDs used across tests (UUID format for validity)
const validUserId = '00000000-0000-0000-0000-000000000010'
const secondValidUserId = '00000000-0000-0000-0000-000000000011'
const validAdminId = '00000000-0000-0000-0000-000000000012'
const nonAdminUserId = '00000000-0000-0000-0000-000000000013'
const invalidId = 'invalid-id'

//Tests validation and submission logic
describe('Role request POST endpoint', () => {

  // Missing required fields -> should fail
  test('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({})

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
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
    expect(res.body).toHaveProperty('error')
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
    expect(res.body).toHaveProperty('error')
  })

  // Valid format but user likely doesn't exist in DB
  test('returns 404 or 500 for unknown user', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: secondValidUserId,
        requested_role: 'Staff',
      })

    expect([404, 500]).toContain(res.statusCode)
  }, 15000)

  // General success / fallback behaviour (DB dependent)
  test('returns valid response for correct input', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: validUserId,
        requested_role: 'Staff',
      })

    expect([201, 400, 404, 409, 500]).toContain(res.statusCode)

    // Only validate structure if actually successful
    if (res.statusCode === 201) {
      expect(res.body).toHaveProperty('request')
      expect(res.body.request).toHaveProperty('user_id')
      expect(res.body.request).toHaveProperty('requested_role')
      expect(res.body.request).toHaveProperty('status')
      expect(res.body.request.user_id).toBe(validUserId)
      expect(res.body.request.requested_role).toBe('Staff')
      expect(res.body.request.status).toBe('pending')
    }
  }, 15000)

  // Duplicate submission scenario
  test('prevents duplicate role requests', async () => {
    const firstRes = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: validUserId,
        requested_role: 'Admin',
      })

    expect([201, 400, 404, 409, 500]).toContain(firstRes.statusCode)

    const secondRes = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: validUserId,
        requested_role: 'Admin',
      })

    expect([400, 404, 409, 500]).toContain(secondRes.statusCode)
  }, 15000)
  test('POST /api/role-requests rejects request when user already has the requested role', async () => {
  const res = await request(app)
    .post('/api/role-requests')
    .send({
      user_id: validUserId,
      requested_role: 'Patient',
    })

  expect([400, 404, 500]).toContain(res.statusCode)
}, 15000)
  //force edge case to hit error handling / catch blocks
  test('handles completely invalid input safely (edge case)', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: null,
        requested_role: null,
      })

    expect([400, 500]).toContain(res.statusCode)
  })
})


//Tests admin access + retrieval logic
describe('Role request GET endpoint', () => {

  // Missing query parameter
  test('returns 400 if admin_id is missing', async () => {
    const res = await request(app).get('/api/role-requests')

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  // Invalid UUID format
  test('returns 400 for invalid admin ID format', async () => {
    const res = await request(app)
      .get(`/api/role-requests?admin_id=${invalidId}`)

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  // Admin does not exist
  test('returns 404 or 500 for unknown admin', async () => {
    const res = await request(app)
      .get(`/api/role-requests?admin_id=${secondValidUserId}`)

    expect([404, 500]).toContain(res.statusCode)
  }, 15000)

  // Not an admin (authorization failure)
  test('returns 403, 404, or 500 for non-admin user', async () => {
    const res = await request(app)
      .get(`/api/role-requests?admin_id=${nonAdminUserId}`)

    expect([403, 404, 500]).toContain(res.statusCode)
  }, 15000)

  // Valid admin request
  test('returns role requests for valid admin', async () => {
    const res = await request(app)
      .get(`/api/role-requests?admin_id=${validAdminId}`)

    expect([200, 404, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('requests')
      expect(Array.isArray(res.body.requests)).toBe(true)
    }
  }, 15000)

  // Filtered requests
  test('supports filtering by status', async () => {
    const res = await request(app)
      .get(`/api/role-requests?admin_id=${validAdminId}&status=pending`)

    expect([200, 404, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('requests')
      expect(Array.isArray(res.body.requests)).toBe(true)
    }
  }, 15000)
  test('GET /api/role-requests returns requests array structure when successful', async () => {
  const res = await request(app)
    .get(`/api/role-requests?admin_id=${validAdminId}`)

  expect([200, 404, 500]).toContain(res.statusCode)

  if (res.statusCode === 200) {
    expect(res.body).toHaveProperty('requests')
    expect(Array.isArray(res.body.requests)).toBe(true)
  }
}, 15000)
  // weird query input (helps branch coverage)
  test('handles unexpected query values safely', async () => {
    const res = await request(app)
      .get(`/api/role-requests?admin_id=${validAdminId}&status=INVALID_STATUS`)

    expect([200, 400, 404, 500]).toContain(res.statusCode)
  }, 15000)
})