const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validRequestId = '00000000-0000-0000-0000-000000000020'
const secondValidRequestId = '00000000-0000-0000-0000-000000000021'
const validAdminId = '00000000-0000-0000-0000-000000000012'
const nonAdminUserId = '00000000-0000-0000-0000-000000000013'
const validStaffId = '00000000-0000-0000-0000-000000000014'
const validClinicId = '00000000-0000-0000-0000-000000000015'
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

describe('Clinic request routes', () => {
  describe('GET /api/clinic-requests', () => {
    test('returns 400 when admin_id is missing', async () => {
      const res = await request(app).get('/api/clinic-requests')

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'admin_id is required',
      })
    })

    test('returns 400 for invalid admin ID format', async () => {
      const res = await request(app).get(
        `/api/clinic-requests?admin_id=${invalidId}`
      )

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid admin ID format',
      })
    })

    test('returns 404 when admin user is not found', async () => {
      scenario.single.users = [
        {
          data: null,
          error: new Error('Admin not found'),
        },
      ]

      const res = await request(app).get(
        `/api/clinic-requests?admin_id=${validAdminId}`
      )

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Admin user not found',
      })
    })

    test('returns 403 when user is not an admin', async () => {
      scenario.single.users = [
        {
          data: {
            id: nonAdminUserId,
            role: 'Staff',
          },
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/clinic-requests?admin_id=${nonAdminUserId}`
      )

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({
        error: 'Only admins can view clinic requests',
      })
    })

    test('returns clinic requests for an admin', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.thenable.clinic_requests = [
        {
          data: [
            {
              id: validRequestId,
              staff_user_id: validStaffId,
              clinic_id: validClinicId,
              status: 'pending',
              users: {
                id: validStaffId,
                full_name: 'Staff User',
                email: 'staff@example.com',
                role: 'Staff',
              },
              clinics: {
                id: validClinicId,
                name: 'Ubuntu Clinic',
                facility_type: 'Clinic',
                province: 'Gauteng',
              },
            },
          ],
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/clinic-requests?admin_id=${validAdminId}`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        requests: [
          {
            id: validRequestId,
            staff_user_id: validStaffId,
            clinic_id: validClinicId,
            status: 'pending',
            users: {
              id: validStaffId,
              full_name: 'Staff User',
              email: 'staff@example.com',
              role: 'Staff',
            },
            clinics: {
              id: validClinicId,
              name: 'Ubuntu Clinic',
              facility_type: 'Clinic',
              province: 'Gauteng',
            },
          },
        ],
      })
    })

    test('applies status filter when provided', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.thenable.clinic_requests = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/clinic-requests?admin_id=${validAdminId}&status=pending`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        requests: [],
      })

      const requestBuilder = createdBuilders.find(
        (builder) => builder.table === 'clinic_requests'
      )

      expect(requestBuilder.eq).toHaveBeenCalledWith('status', 'pending')
    })

    test('returns 500 when clinic request query fails', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.thenable.clinic_requests = [
        {
          data: null,
          error: new Error('Clinic request query failed'),
        },
      ]

      const res = await request(app).get(
        `/api/clinic-requests?admin_id=${validAdminId}`
      )

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to load clinic requests',
      })
    })
  })

  describe('PATCH /api/clinic-requests/:id/approve', () => {
    test('returns 400 for invalid request ID', async () => {
      const res = await request(app)
        .patch(`/api/clinic-requests/${invalidId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid request or admin ID format',
      })
    })

    test('returns 400 when admin_id is missing', async () => {
      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/approve`)
        .send({})

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'admin_id is required',
      })
    })

    test('returns 400 for invalid admin ID format', async () => {
      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/approve`)
        .send({
          admin_id: invalidId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid request or admin ID format',
      })
    })

    test('returns 404 when admin user is not found', async () => {
      scenario.single.users = [
        {
          data: null,
          error: new Error('Admin not found'),
        },
      ]

      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Admin user not found',
      })
    })

    test('returns 403 when user is not an admin', async () => {
      scenario.single.users = [
        {
          data: {
            id: nonAdminUserId,
            role: 'Staff',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/approve`)
        .send({
          admin_id: nonAdminUserId,
        })

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({
        error: 'Only admins can approve clinic requests',
      })
    })

    test('returns 404 when clinic request is not found', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.single.clinic_requests = [
        {
          data: null,
          error: new Error('Clinic request not found'),
        },
      ]

      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Clinic request not found',
      })
    })

    test('returns 400 when clinic request is not pending', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.single.clinic_requests = [
        {
          data: {
            id: validRequestId,
            staff_user_id: validStaffId,
            clinic_id: validClinicId,
            status: 'approved',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Only pending requests can be approved',
      })
    })

    test('approves clinic request successfully', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.single.clinic_requests = [
        {
          data: {
            id: validRequestId,
            staff_user_id: validStaffId,
            clinic_id: validClinicId,
            status: 'pending',
          },
          error: null,
        },
        {
          data: {
            id: validRequestId,
            staff_user_id: validStaffId,
            clinic_id: validClinicId,
            status: 'approved',
            reviewed_by: validAdminId,
            users: {
              id: validStaffId,
              full_name: 'Staff User',
              email: 'staff@example.com',
              role: 'Staff',
              clinic_id: validClinicId,
            },
            clinics: {
              id: validClinicId,
              name: 'Ubuntu Clinic',
              facility_type: 'Clinic',
              province: 'Gauteng',
            },
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
        .patch(`/api/clinic-requests/${validRequestId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        message: 'Clinic request approved',
        request: {
          id: validRequestId,
          staff_user_id: validStaffId,
          clinic_id: validClinicId,
          status: 'approved',
          reviewed_by: validAdminId,
          users: {
            id: validStaffId,
            full_name: 'Staff User',
            email: 'staff@example.com',
            role: 'Staff',
            clinic_id: validClinicId,
          },
          clinics: {
            id: validClinicId,
            name: 'Ubuntu Clinic',
            facility_type: 'Clinic',
            province: 'Gauteng',
          },
        },
      })

      const userUpdateBuilder = createdBuilders.find(
        (builder) => builder.table === 'users' && builder.update.mock.calls.length
      )

      expect(userUpdateBuilder.update).toHaveBeenCalledWith({
        clinic_id: validClinicId,
      })

      const requestUpdateBuilder = createdBuilders.find(
        (builder) =>
          builder.table === 'clinic_requests' &&
          builder.update.mock.calls.length
      )

      expect(requestUpdateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          reviewed_by: validAdminId,
        })
      )
    })

    test('returns 500 when staff clinic assignment fails during approval', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.single.clinic_requests = [
        {
          data: {
            id: secondValidRequestId,
            staff_user_id: validStaffId,
            clinic_id: validClinicId,
            status: 'pending',
          },
          error: null,
        },
      ]

      scenario.thenable.users = [
        {
          data: null,
          error: new Error('Staff assignment failed'),
        },
      ]

      const res = await request(app)
        .patch(`/api/clinic-requests/${secondValidRequestId}/approve`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to approve clinic request',
      })
    })
  })

  describe('PATCH /api/clinic-requests/:id/reject', () => {
    test('returns 400 for invalid request ID', async () => {
      const res = await request(app)
        .patch(`/api/clinic-requests/${invalidId}/reject`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid request or admin ID format',
      })
    })

    test('returns 400 when admin_id is missing', async () => {
      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/reject`)
        .send({})

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'admin_id is required',
      })
    })

    test('returns 400 for invalid admin ID format', async () => {
      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/reject`)
        .send({
          admin_id: invalidId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid request or admin ID format',
      })
    })

    test('returns 404 when admin user is not found', async () => {
      scenario.single.users = [
        {
          data: null,
          error: new Error('Admin not found'),
        },
      ]

      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/reject`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Admin user not found',
      })
    })

    test('returns 403 when user is not an admin', async () => {
      scenario.single.users = [
        {
          data: {
            id: nonAdminUserId,
            role: 'Staff',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/reject`)
        .send({
          admin_id: nonAdminUserId,
        })

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({
        error: 'Only admins can reject clinic requests',
      })
    })

    test('returns 404 when clinic request is not found', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.single.clinic_requests = [
        {
          data: null,
          error: new Error('Clinic request not found'),
        },
      ]

      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/reject`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Clinic request not found',
      })
    })

    test('returns 400 when clinic request is not pending', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.single.clinic_requests = [
        {
          data: {
            id: validRequestId,
            staff_user_id: validStaffId,
            clinic_id: validClinicId,
            status: 'rejected',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/reject`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Only pending requests can be rejected',
      })
    })

    test('rejects clinic request successfully', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.single.clinic_requests = [
        {
          data: {
            id: validRequestId,
            staff_user_id: validStaffId,
            clinic_id: validClinicId,
            status: 'pending',
          },
          error: null,
        },
        {
          data: {
            id: validRequestId,
            staff_user_id: validStaffId,
            clinic_id: validClinicId,
            status: 'rejected',
            reviewed_by: validAdminId,
            users: {
              id: validStaffId,
              full_name: 'Staff User',
              email: 'staff@example.com',
              role: 'Staff',
            },
            clinics: {
              id: validClinicId,
              name: 'Ubuntu Clinic',
              facility_type: 'Clinic',
              province: 'Gauteng',
            },
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/clinic-requests/${validRequestId}/reject`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        message: 'Clinic request rejected',
        request: {
          id: validRequestId,
          staff_user_id: validStaffId,
          clinic_id: validClinicId,
          status: 'rejected',
          reviewed_by: validAdminId,
          users: {
            id: validStaffId,
            full_name: 'Staff User',
            email: 'staff@example.com',
            role: 'Staff',
          },
          clinics: {
            id: validClinicId,
            name: 'Ubuntu Clinic',
            facility_type: 'Clinic',
            province: 'Gauteng',
          },
        },
      })

      const requestUpdateBuilder = createdBuilders.find(
        (builder) =>
          builder.table === 'clinic_requests' &&
          builder.update.mock.calls.length
      )

      expect(requestUpdateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          reviewed_by: validAdminId,
        })
      )
    })

    test('returns 500 when rejection update fails', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.single.clinic_requests = [
        {
          data: {
            id: secondValidRequestId,
            staff_user_id: validStaffId,
            clinic_id: validClinicId,
            status: 'pending',
          },
          error: null,
        },
        {
          data: null,
          error: new Error('Clinic request rejection failed'),
        },
      ]

      const res = await request(app)
        .patch(`/api/clinic-requests/${secondValidRequestId}/reject`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to reject clinic request',
      })
    })
  })
})