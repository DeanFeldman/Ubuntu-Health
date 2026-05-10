const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validRequestId = '00000000-0000-0000-0000-000000000020'
const secondValidRequestId = '00000000-0000-0000-0000-000000000021'
const validAdminId = '00000000-0000-0000-0000-000000000012'
const nonAdminUserId = '00000000-0000-0000-0000-000000000013'
const requestUserId = '00000000-0000-0000-0000-000000000014'
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

describe('Role request approval routes', () => {
  describe('PATCH /api/role-requests/:id/approve', () => {
    test('returns 400 for invalid approval request ID', async () => {
      const res = await request(app)
        .patch(`/api/role-requests/${invalidId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid request ID format',
      })
    })

    test('returns 400 when admin_id is missing for approval', async () => {
      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/approve`)
        .send({})

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'admin_id is required',
      })
    })

    test('returns 400 for invalid admin ID format on approval', async () => {
      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/approve`)
        .send({
          admin_id: invalidId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid admin ID format',
      })
    })

    test('returns 404 when approving admin user is not found', async () => {
      scenario.maybeSingle.users = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Admin user not found',
      })
    })

    test('returns 403 when approval is attempted by non-admin user', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: nonAdminUserId,
            role: 'Staff',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/approve`)
        .send({
          admin_id: nonAdminUserId,
        })

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({
        error: 'Only admins can approve role requests',
      })
    })

    test('returns 404 when role request is not found during approval', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
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

      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Role request not found',
      })
    })

    test('returns 400 when role request has already been reviewed during approval', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.role_requests = [
        {
          data: {
            id: validRequestId,
            user_id: requestUserId,
            requested_role: 'Staff',
            status: 'approved',
            users: {
              role: 'Patient',
            },
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Role request has already been reviewed',
      })
    })

    test('returns 404 when requested user role cannot be found during approval', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.role_requests = [
        {
          data: {
            id: validRequestId,
            user_id: requestUserId,
            requested_role: 'Staff',
            status: 'pending',
            users: null,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Request user not found',
      })
    })

    test('approves pending role request successfully', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.role_requests = [
        {
          data: {
            id: validRequestId,
            user_id: requestUserId,
            requested_role: 'Staff',
            status: 'pending',
            users: {
              role: 'Patient',
            },
          },
          error: null,
        },
        {
          data: {
            id: validRequestId,
            user_id: requestUserId,
            requested_role: 'Staff',
            status: 'approved',
          },
          error: null,
        },
      ]

      scenario.thenable.users = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        request: {
          id: validRequestId,
          user_id: requestUserId,
          requested_role: 'Staff',
          status: 'approved',
        },
      })

      const userUpdateBuilder = createdBuilders.find(
        (builder) =>
          builder.table === 'users' && builder.update.mock.calls.length
      )

      expect(userUpdateBuilder.update).toHaveBeenCalledWith({
        role: 'Staff',
      })

      const requestUpdateBuilder = createdBuilders
        .filter((builder) => builder.table === 'role_requests')
        .find((builder) => builder.update.mock.calls.length)

      expect(requestUpdateBuilder.update).toHaveBeenCalledWith({
        status: 'approved',
      })
      expect(requestUpdateBuilder.eq).toHaveBeenCalledWith('id', validRequestId)
      expect(requestUpdateBuilder.eq).toHaveBeenCalledWith('status', 'pending')
    })

    test('returns 409 and rolls back when approval update no longer finds pending request', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.role_requests = [
        {
          data: {
            id: secondValidRequestId,
            user_id: requestUserId,
            requested_role: 'Staff',
            status: 'pending',
            users: {
              role: 'Patient',
            },
          },
          error: null,
        },
        {
          data: null,
          error: null,
        },
      ]

      scenario.thenable.users = [
        {
          data: null,
          error: null,
        },
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/role-requests/${secondValidRequestId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({
        error: 'Role request is no longer pending',
      })

      const userUpdateBuilders = createdBuilders.filter(
        (builder) =>
          builder.table === 'users' && builder.update.mock.calls.length
      )

      expect(userUpdateBuilders[0].update).toHaveBeenCalledWith({
        role: 'Staff',
      })
      expect(userUpdateBuilders[1].update).toHaveBeenCalledWith({
        role: 'Patient',
      })
    })

    test('returns 500 when user role update fails during approval', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.role_requests = [
        {
          data: {
            id: secondValidRequestId,
            user_id: requestUserId,
            requested_role: 'Staff',
            status: 'pending',
            users: {
              role: 'Patient',
            },
          },
          error: null,
        },
      ]

      scenario.thenable.users = [
        {
          data: null,
          error: new Error('User role update failed'),
        },
      ]

      const res = await request(app)
        .patch(`/api/role-requests/${secondValidRequestId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to approve role request',
      })
    })
  })

  describe('PATCH /api/role-requests/:id/reject', () => {
    test('returns 400 for invalid rejection request ID', async () => {
      const res = await request(app)
        .patch(`/api/role-requests/${invalidId}/reject`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid request ID format',
      })
    })

    test('returns 400 when admin_id is missing for rejection', async () => {
      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/reject`)
        .send({})

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'admin_id is required',
      })
    })

    test('returns 400 for invalid admin ID format on rejection', async () => {
      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/reject`)
        .send({
          admin_id: invalidId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid admin ID format',
      })
    })

    test('returns 404 when rejecting admin user is not found', async () => {
      scenario.maybeSingle.users = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/reject`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Admin user not found',
      })
    })

    test('returns 403 when rejection is attempted by non-admin user', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: nonAdminUserId,
            role: 'Staff',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/reject`)
        .send({
          admin_id: nonAdminUserId,
        })

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({
        error: 'Only admins can reject role requests',
      })
    })

    test('returns 409 when pending role request is not found during rejection', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
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

      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/reject`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({
        error: 'Role request is no longer pending',
      })
    })

    test('rejects pending role request successfully', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.role_requests = [
        {
          data: {
            id: validRequestId,
            user_id: requestUserId,
            requested_role: 'Staff',
            status: 'rejected',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/role-requests/${validRequestId}/reject`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        request: {
          id: validRequestId,
          user_id: requestUserId,
          requested_role: 'Staff',
          status: 'rejected',
        },
      })

      const requestUpdateBuilder = createdBuilders
        .filter((builder) => builder.table === 'role_requests')
        .find((builder) => builder.update.mock.calls.length)

      expect(requestUpdateBuilder.update).toHaveBeenCalledWith({
        status: 'rejected',
      })
      expect(requestUpdateBuilder.eq).toHaveBeenCalledWith('id', validRequestId)
      expect(requestUpdateBuilder.eq).toHaveBeenCalledWith('status', 'pending')
    })

    test('returns 500 when rejection update fails', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.role_requests = [
        {
          data: null,
          error: new Error('Role request rejection failed'),
        },
      ]

      const res = await request(app)
        .patch(`/api/role-requests/${secondValidRequestId}/reject`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to reject role request',
      })
    })
  })
})