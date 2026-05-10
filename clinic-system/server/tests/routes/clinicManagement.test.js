const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000015'
const validAdminId = '00000000-0000-0000-0000-000000000012'
const validStaffId = '00000000-0000-0000-0000-000000000014'
const nonAdminUserId = '00000000-0000-0000-0000-000000000013'
const invalidId = 'invalid-id'

let app
let scenario
let createdBuilders

const validOperatingHours = {
  monday: { open: '08:00', close: '17:00' },
  tuesday: { open: '08:00', close: '17:00' },
  wednesday: { open: '08:00', close: '17:00' },
  thursday: { open: '08:00', close: '17:00' },
  friday: { open: '08:00', close: '17:00' },
  saturday: { open: '', close: '' },
  sunday: { open: '', close: '' },
}

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
})

describe('Clinic management routes', () => {
  describe('PATCH /api/users/:userId/assign-clinic', () => {
    test('returns 400 for invalid user ID', async () => {
      const res = await request(app)
        .patch(`/api/users/${invalidId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid ID format',
      })
    })

    test('returns 400 for invalid admin ID', async () => {
      const res = await request(app)
        .patch(`/api/users/${validStaffId}/assign-clinic`)
        .send({
          admin_id: invalidId,
          clinic_id: validClinicId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid ID format',
      })
    })

    test('returns 400 for invalid clinic ID', async () => {
      const res = await request(app)
        .patch(`/api/users/${validStaffId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: invalidId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid ID format',
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
        .patch(`/api/users/${validStaffId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Admin user not found',
      })
    })

    test('returns 403 when requester is not admin', async () => {
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
        .patch(`/api/users/${validStaffId}/assign-clinic`)
        .send({
          admin_id: nonAdminUserId,
          clinic_id: validClinicId,
        })

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({
        error: 'Only admins can assign staff to clinics',
      })
    })

    test('returns 404 when selected user is not found', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
        {
          data: null,
          error: new Error('User not found'),
        },
      ]

      const res = await request(app)
        .patch(`/api/users/${validStaffId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'User not found',
      })
    })

    test('returns 400 when selected user cannot be assigned to clinic', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
        {
          data: {
            id: validStaffId,
            role: 'Patient',
            full_name: 'Patient User',
            clinic_id: null,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/users/${validStaffId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    test('returns 404 when clinic is not found', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
        {
          data: {
            id: validStaffId,
            role: 'Staff',
            full_name: 'Staff User',
            clinic_id: null,
          },
          error: null,
        },
      ]

      scenario.single.clinics = [
        {
          data: null,
          error: new Error('Clinic not found'),
        },
      ]

      const res = await request(app)
        .patch(`/api/users/${validStaffId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Clinic not found',
      })
    })

    test('assigns staff member to clinic successfully', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
        {
          data: {
            id: validStaffId,
            role: 'Staff',
            full_name: 'Staff User',
            clinic_id: null,
          },
          error: null,
        },
        {
          data: {
            id: validStaffId,
            full_name: 'Staff User',
            role: 'Staff',
            clinic_id: validClinicId,
          },
          error: null,
        },
      ]

      scenario.single.clinics = [
        {
          data: {
            id: validClinicId,
            name: 'Ubuntu Clinic',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/users/${validStaffId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        message: 'Staff User assigned to Ubuntu Clinic',
        user: {
          id: validStaffId,
          full_name: 'Staff User',
          role: 'Staff',
          clinic_id: validClinicId,
        },
        clinic: {
          id: validClinicId,
          name: 'Ubuntu Clinic',
        },
      })

      const userUpdateBuilder = createdBuilders.find(
        (builder) => builder.table === 'users' && builder.update.mock.calls.length
      )

      expect(userUpdateBuilder.update).toHaveBeenCalledWith({
        clinic_id: validClinicId,
      })
    })

    test('returns 500 when assignment update fails', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
        {
          data: {
            id: validStaffId,
            role: 'Staff',
            full_name: 'Staff User',
            clinic_id: null,
          },
          error: null,
        },
        {
          data: null,
          error: new Error('Assignment update failed'),
        },
      ]

      scenario.single.clinics = [
        {
          data: {
            id: validClinicId,
            name: 'Ubuntu Clinic',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/users/${validStaffId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to assign staff to clinic',
      })
    })
  })

  describe('PATCH /api/users/:userId/unassign-clinic', () => {
    test('returns 400 for invalid user ID', async () => {
      const res = await request(app)
        .patch(`/api/users/${invalidId}/unassign-clinic`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid ID format',
      })
    })

    test('returns 400 for invalid admin ID', async () => {
      const res = await request(app)
        .patch(`/api/users/${validStaffId}/unassign-clinic`)
        .send({
          admin_id: invalidId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid ID format',
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
        .patch(`/api/users/${validStaffId}/unassign-clinic`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Admin user not found',
      })
    })

    test('returns 403 when requester is not admin', async () => {
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
        .patch(`/api/users/${validStaffId}/unassign-clinic`)
        .send({
          admin_id: nonAdminUserId,
        })

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({
        error: 'Only admins can unassign staff from clinics',
      })
    })

    test('returns 404 when selected user is not found', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
        {
          data: null,
          error: new Error('User not found'),
        },
      ]

      const res = await request(app)
        .patch(`/api/users/${validStaffId}/unassign-clinic`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'User not found',
      })
    })

    test('returns 400 when selected user cannot be unassigned', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
        {
          data: {
            id: validStaffId,
            role: 'Staff',
            full_name: 'Staff User',
            clinic_id: null,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/users/${validStaffId}/unassign-clinic`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    test('unassigns staff member from clinic successfully', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
        {
          data: {
            id: validStaffId,
            role: 'Staff',
            full_name: 'Staff User',
            clinic_id: validClinicId,
          },
          error: null,
        },
        {
          data: {
            id: validStaffId,
            full_name: 'Staff User',
            role: 'Staff',
            clinic_id: null,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/users/${validStaffId}/unassign-clinic`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        message: 'Staff User unassigned from clinic',
        user: {
          id: validStaffId,
          full_name: 'Staff User',
          role: 'Staff',
          clinic_id: null,
        },
      })

      const userUpdateBuilder = createdBuilders.find(
        (builder) => builder.table === 'users' && builder.update.mock.calls.length
      )

      expect(userUpdateBuilder.update).toHaveBeenCalledWith({
        clinic_id: null,
      })
    })

    test('returns 500 when unassignment update fails', async () => {
      scenario.single.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
        {
          data: {
            id: validStaffId,
            role: 'Staff',
            full_name: 'Staff User',
            clinic_id: validClinicId,
          },
          error: null,
        },
        {
          data: null,
          error: new Error('Unassignment update failed'),
        },
      ]

      const res = await request(app)
        .patch(`/api/users/${validStaffId}/unassign-clinic`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to unassign staff from clinic',
      })
    })
  })

  describe('PATCH /api/clinics/:id', () => {
    test('returns 400 for invalid clinic ID', async () => {
      const res = await request(app)
        .patch(`/api/clinics/${invalidId}`)
        .send({
          admin_id: validAdminId,
          name: 'Updated Clinic',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid clinic ID format',
      })
    })

    test('returns 400 when admin_id is missing', async () => {
      const res = await request(app)
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          name: 'Updated Clinic',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Valid admin_id is required',
      })
    })

    test('returns 400 for invalid admin_id', async () => {
      const res = await request(app)
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          admin_id: invalidId,
          name: 'Updated Clinic',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Valid admin_id is required',
      })
    })

    test('returns 404 when admin user is not found', async () => {
      scenario.maybeSingle.users = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          admin_id: validAdminId,
          name: 'Updated Clinic',
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Admin user not found',
      })
    })

    test('returns 403 when requester is not admin', async () => {
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
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          admin_id: nonAdminUserId,
          name: 'Updated Clinic',
        })

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({
        error: 'Only admins can update clinics',
      })
    })

    test('returns 400 for invalid clinic update payload', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          admin_id: validAdminId,
          name: '',
          facility_type: '',
          operating_hours: null,
          services: [],
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    test('updates clinic successfully', async () => {
      const updatedClinic = {
        id: validClinicId,
        name: 'Updated Ubuntu Clinic',
        facility_type: 'Clinic',
        operating_hours: validOperatingHours,
        appointment_duration_minutes: 20,
        services: ['General Consultation', 'Vaccination'],
      }

      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.single.clinics = [
        {
          data: updatedClinic,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          admin_id: validAdminId,
          name: 'Updated Ubuntu Clinic',
          facility_type: 'Clinic',
          operating_hours: validOperatingHours,
          appointment_duration_minutes: 20,
          services: ['General Consultation', 'Vaccination'],
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        message: 'Clinic updated successfully',
        clinic: updatedClinic,
      })

      const clinicUpdateBuilder = createdBuilders.find(
        (builder) => builder.table === 'clinics' && builder.update.mock.calls.length
      )

      expect(clinicUpdateBuilder.update).toHaveBeenCalledWith({
        name: 'Updated Ubuntu Clinic',
        facility_type: 'Clinic',
        operating_hours: validOperatingHours,
        appointment_duration_minutes: 20,
        services: ['General Consultation', 'Vaccination'],
      })
    })

    test('returns 500 when clinic update fails', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validAdminId,
            role: 'Admin',
          },
          error: null,
        },
      ]

      scenario.single.clinics = [
        {
          data: null,
          error: new Error('Clinic update failed'),
        },
      ]

      const res = await request(app)
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          admin_id: validAdminId,
          name: 'Updated Ubuntu Clinic',
          facility_type: 'Clinic',
          operating_hours: validOperatingHours,
          appointment_duration_minutes: 20,
          services: ['General Consultation'],
        })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to update clinic',
      })
    })
  })
})