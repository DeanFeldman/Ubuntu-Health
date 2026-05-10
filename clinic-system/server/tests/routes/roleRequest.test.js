const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validUserId = '00000000-0000-0000-0000-000000000010'
const secondValidUserId = '00000000-0000-0000-0000-000000000011'
const validAdminId = '00000000-0000-0000-0000-000000000012'
const nonAdminUserId = '00000000-0000-0000-0000-000000000013'
const validRequestId = '00000000-0000-0000-0000-000000000014'
const invalidId = 'invalid-id'

let app
let scenario
let createdBuilders

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
})

describe('Role request routes', () => {
  describe('POST /api/role-requests', () => {
    test('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/role-requests').send({})

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'user_id and requested_role are required',
      })
    })

    test('returns 400 for invalid user ID format', async () => {
      const res = await request(app).post('/api/role-requests').send({
        user_id: invalidId,
        requested_role: 'Staff',
      })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid user ID format',
      })
    })

    test('returns 400 for invalid requested role', async () => {
      const res = await request(app).post('/api/role-requests').send({
        user_id: validUserId,
        requested_role: 'SuperUser',
      })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid requested role',
      })
    })

    test('returns 500 when user lookup fails', async () => {
      scenario.maybeSingle.users = [
        {
          data: null,
          error: new Error('User lookup failed'),
        },
      ]

      const res = await request(app).post('/api/role-requests').send({
        user_id: validUserId,
        requested_role: 'Staff',
      })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to submit role request',
      })
    })

    test('returns 404 for unknown user', async () => {
      scenario.maybeSingle.users = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app).post('/api/role-requests').send({
        user_id: secondValidUserId,
        requested_role: 'Staff',
      })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'User not found',
      })
    })

    test('returns 400 when user already has the requested role', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validUserId,
            role: 'Patient',
          },
          error: null,
        },
      ]

      const res = await request(app).post('/api/role-requests').send({
        user_id: validUserId,
        requested_role: 'Patient',
      })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'User already has this role',
      })
    })

    test('returns 500 when duplicate pending request lookup fails', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validUserId,
            role: 'Patient',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.role_requests = [
        {
          data: null,
          error: new Error('Pending lookup failed'),
        },
      ]

      const res = await request(app).post('/api/role-requests').send({
        user_id: validUserId,
        requested_role: 'Admin',
      })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to submit role request',
      })
    })

    test('prevents duplicate pending role requests', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validUserId,
            role: 'Patient',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.role_requests = [
        {
          data: {
            id: validRequestId,
          },
          error: null,
        },
      ]

      const res = await request(app).post('/api/role-requests').send({
        user_id: validUserId,
        requested_role: 'Admin',
      })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({
        error: 'A pending request for this role already exists',
      })
    })

    test('returns 500 when inserting a valid role request fails', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validUserId,
            role: 'Patient',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.role_requests = [
        {
          data: null,
          error: null,
        },
      ]

      scenario.single.role_requests = [
        {
          data: null,
          error: new Error('Insert failed'),
        },
      ]

      const res = await request(app).post('/api/role-requests').send({
        user_id: validUserId,
        requested_role: 'Staff',
      })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to submit role request',
      })
    })

    test('returns 201 for valid role request submission', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validUserId,
            role: 'Patient',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.role_requests = [
        {
          data: null,
          error: null,
        },
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

      const res = await request(app).post('/api/role-requests').send({
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

      const roleRequestBuilder = createdBuilders.find(
        (builder) =>
          builder.table === 'role_requests' && builder.insert.mock.calls.length
      )

      expect(roleRequestBuilder.insert).toHaveBeenCalledWith({
        user_id: validUserId,
        requested_role: 'Staff',
        status: 'pending',
      })
    })

    test('handles null required fields safely', async () => {
      const res = await request(app).post('/api/role-requests').send({
        user_id: null,
        requested_role: null,
      })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'user_id and requested_role are required',
      })
    })
  })

  describe('GET /api/role-requests', () => {
    test('returns 400 if admin_id is missing', async () => {
      const res = await request(app).get('/api/role-requests')

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'admin_id is required',
      })
    })

    test('returns 400 for invalid admin ID format', async () => {
      const res = await request(app).get(
        `/api/role-requests?admin_id=${invalidId}`
      )

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid admin ID format',
      })
    })

    test('returns 500 when admin lookup fails', async () => {
      scenario.maybeSingle.users = [
        {
          data: null,
          error: new Error('Admin lookup failed'),
        },
      ]

      const res = await request(app).get(
        `/api/role-requests?admin_id=${validAdminId}`
      )

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to fetch role requests',
      })
    })

    test('returns 404 for unknown admin', async () => {
      scenario.maybeSingle.users = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/role-requests?admin_id=${secondValidUserId}`
      )

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Admin user not found',
      })
    })

    test('returns 403 for non-admin user', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: nonAdminUserId,
            role: 'Patient',
          },
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/role-requests?admin_id=${nonAdminUserId}`
      )

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({
        error: 'Only admins can access role requests',
      })
    })

    test('returns 500 when role request query fails', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.thenable.role_requests = [
        {
          data: null,
          error: new Error('Role request query failed'),
        },
      ]

      const res = await request(app).get(
        `/api/role-requests?admin_id=${validAdminId}`
      )

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to fetch role requests',
      })
    })

    test('returns role requests for valid admin', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
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

      const res = await request(app).get(
        `/api/role-requests?admin_id=${validAdminId}`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        requests: [
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
      })
    })

    test('supports filtering by status', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.thenable.role_requests = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/role-requests?admin_id=${validAdminId}&status=pending`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        requests: [],
      })

      const roleRequestBuilder = createdBuilders.find(
        (builder) => builder.table === 'role_requests'
      )

      expect(roleRequestBuilder).toBeDefined()
      expect(roleRequestBuilder.eq).toHaveBeenCalledWith('status', 'pending')
    })

    test('handles unexpected status query values safely', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.thenable.role_requests = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/role-requests?admin_id=${validAdminId}&status=INVALID_STATUS`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        requests: [],
      })
    })
  })
})