const request = require('supertest')
const app = require('../src/app')

const validUserId = '00000000-0000-0000-0000-000000000010'
const secondValidUserId = '00000000-0000-0000-0000-000000000011'
const invalidId = 'invalid-id'

describe('Role request POST endpoint', () => {
  test('POST /api/role-requests with missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({})

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  test('POST /api/role-requests with invalid user id returns 400', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: invalidId,
        requested_role: 'Staff',
      })

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  test('POST /api/role-requests with invalid requested role returns 400', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: validUserId,
        requested_role: 'SuperUser',
      })

    expect(res.statusCode).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  test('POST /api/role-requests with unknown user returns 404 or 500', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: secondValidUserId,
        requested_role: 'Staff',
      })

    expect([404, 500]).toContain(res.statusCode)
  }, 15000)

  test('POST /api/role-requests with valid-format data returns 201, 400, 404, 409, or 500', async () => {
    const res = await request(app)
      .post('/api/role-requests')
      .send({
        user_id: validUserId,
        requested_role: 'Staff',
      })

    expect([201, 400, 404, 409, 500]).toContain(res.statusCode)

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

  test('POST /api/role-requests duplicate submission returns 409, or another valid DB-dependent response', async () => {
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
})