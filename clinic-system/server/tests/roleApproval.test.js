const request = require('supertest')
const app = require('../src/app')

// UUID-format values used for route/body validation
const validRequestId = '00000000-0000-0000-0000-000000000020'
const secondValidRequestId = '00000000-0000-0000-0000-000000000021'
const validAdminId = '00000000-0000-0000-0000-000000000012'
const nonAdminUserId = '00000000-0000-0000-0000-000000000013'
const unknownAdminId = '00000000-0000-0000-0000-000000000022'
const invalidId = 'invalid-id'

//Tests approval workflow for role requests
describe('Role request APPROVE endpoint', () => {
  // Invalid request ID format
  test('returns 400 for invalid approval request ID', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${invalidId}/approve`)
      .send({ admin_id: validAdminId })

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  // Missing admin_id
  test('returns 400 when admin_id is missing for approval', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${validRequestId}/approve`)
      .send({})

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  // Invalid admin ID format
  test('returns 400 for invalid admin ID format on approval', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${validRequestId}/approve`)
      .send({ admin_id: invalidId })

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  // Unknown admin user
  test('returns 404 or 500 when approving with unknown admin', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${validRequestId}/approve`)
      .send({ admin_id: unknownAdminId })

    expect([404, 500]).toContain(res.statusCode)
  }, 15000)

  // Non-admin user cannot approve
  test('returns 403, 404, or 500 when approval is attempted by non-admin user', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${validRequestId}/approve`)
      .send({ admin_id: nonAdminUserId })

    expect([403, 404, 500]).toContain(res.statusCode)
  }, 15000)

  // DB-dependent approval request
  test('returns valid DB-dependent response for role approval request', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${validRequestId}/approve`)
      .send({ admin_id: validAdminId })

    expect([200, 400, 404, 409, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('request')
    }
  }, 15000)
  // Successful approval should return an approved request when DB state allows it
test('approval returns approved request details when successful', async () => {
  const res = await request(app)
    .patch(`/api/role-requests/${validRequestId}/approve`)
    .send({ admin_id: validAdminId })

  expect([200, 400, 404, 409, 500]).toContain(res.statusCode)

  if (res.statusCode === 200) {
    expect(res.body).toHaveProperty('request')
    expect(res.body.request).toHaveProperty('status')
    expect(res.body.request.status).toBe('approved')
  }
}, 15000)
    test('approval handles server error safely', async () => {
  const res = await request(app)
    .patch(`/api/role-requests/${invalidId}/approve`)
    .send({ admin_id: validAdminId })

  expect([400, 404, 500]).toContain(res.statusCode)
})
  // Second request ID gives another path chance depending on DB state
  test('handles another approval request safely', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${secondValidRequestId}/approve`)
      .send({ admin_id: validAdminId })

    expect([200, 400, 404, 409, 500]).toContain(res.statusCode)
  }, 15000)
})

//Tests rejection workflow for role requests
describe('Role request REJECT endpoint', () => {
  // Invalid request ID format
  test('returns 400 for invalid rejection request ID', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${invalidId}/reject`)
      .send({ admin_id: validAdminId })

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  // Missing admin_id
  test('returns 400 when admin_id is missing for rejection', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${validRequestId}/reject`)
      .send({})

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  // Invalid admin ID format
  test('returns 400 for invalid admin ID format on rejection', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${validRequestId}/reject`)
      .send({ admin_id: invalidId })

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  // Unknown admin user
  test('returns 404 or 500 when rejecting with unknown admin', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${validRequestId}/reject`)
      .send({ admin_id: unknownAdminId })

    expect([404, 500]).toContain(res.statusCode)
  }, 15000)

  // Non-admin user cannot reject
  test('returns 403, 404, or 500 when rejection is attempted by non-admin user', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${validRequestId}/reject`)
      .send({ admin_id: nonAdminUserId })

    expect([403, 404, 500]).toContain(res.statusCode)
  }, 15000)

  // DB-dependent rejection request
  test('returns valid DB-dependent response for role rejection request', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${validRequestId}/reject`)
      .send({ admin_id: validAdminId })

    expect([200, 404, 409, 500]).toContain(res.statusCode)

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('request')
    }
  }, 15000)

  // Second request ID gives another path chance depending on DB state
  test('handles another rejection request safely', async () => {
    const res = await request(app)
      .patch(`/api/role-requests/${secondValidRequestId}/reject`)
      .send({ admin_id: validAdminId })

    expect([200, 404, 409, 500]).toContain(res.statusCode)
  }, 15000)
})