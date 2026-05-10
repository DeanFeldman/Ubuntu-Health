const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validStaffId = '00000000-0000-0000-0000-000000000010'
const validAvailabilityId = '00000000-0000-0000-0000-000000000011'
const validClinicId = '00000000-0000-0000-0000-000000000012'
const invalidId = 'invalid-id'

let app
let scenario
let createdBuilders

const clinicOperatingHours = {
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

describe('Staff availability routes', () => {
  describe('GET /api/staff/:staffId/availability', () => {
    test('returns 400 for invalid staff ID', async () => {
      const res = await request(app).get(
        `/api/staff/${invalidId}/availability`
      )

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid staff ID format',
      })
    })

    test('returns staff availability records', async () => {
      scenario.thenable.staff_availability = [
        {
          data: [
            {
              id: validAvailabilityId,
              staff_id: validStaffId,
              day_of_week: 0,
              start_time: '08:00',
              end_time: '16:00',
              is_available: true,
            },
          ],
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/staff/${validStaffId}/availability`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        availability: [
          {
            id: validAvailabilityId,
            staff_id: validStaffId,
            day_of_week: 0,
            start_time: '08:00',
            end_time: '16:00',
            is_available: true,
          },
        ],
      })

      const availabilityBuilder = createdBuilders.find(
        (builder) => builder.table === 'staff_availability'
      )

      expect(availabilityBuilder.select).toHaveBeenCalledWith('*')
      expect(availabilityBuilder.eq).toHaveBeenCalledWith(
        'staff_id',
        validStaffId
      )
      expect(availabilityBuilder.order).toHaveBeenCalledWith('day_of_week', {
        ascending: true,
      })
    })

    test('returns 500 when availability lookup fails', async () => {
      scenario.thenable.staff_availability = [
        {
          data: null,
          error: new Error('Availability lookup failed'),
        },
      ]

      const res = await request(app).get(
        `/api/staff/${validStaffId}/availability`
      )

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to fetch staff availability',
      })
    })
  })

  describe('POST /api/staff/:staffId/availability', () => {
    test('returns 400 for invalid staff ID', async () => {
      const res = await request(app)
        .post(`/api/staff/${invalidId}/availability`)
        .send({
          day_of_week: 0,
          start_time: '08:00',
          end_time: '16:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid staff ID format',
      })
    })

    test('returns 400 when day_of_week is missing', async () => {
      const res = await request(app)
        .post(`/api/staff/${validStaffId}/availability`)
        .send({
          start_time: '08:00',
          end_time: '16:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'day_of_week is required',
      })
    })

    test('returns 400 when day_of_week is outside 0 to 6', async () => {
      const res = await request(app)
        .post(`/api/staff/${validStaffId}/availability`)
        .send({
          day_of_week: 8,
          start_time: '08:00',
          end_time: '16:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'day_of_week must be an integer between 0 and 6',
      })
    })

    test('returns 400 when start_time and end_time are missing', async () => {
      const res = await request(app)
        .post(`/api/staff/${validStaffId}/availability`)
        .send({
          day_of_week: 0,
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'start_time and end_time are required',
      })
    })

    test('returns 400 when start_time is not before end_time', async () => {
      const res = await request(app)
        .post(`/api/staff/${validStaffId}/availability`)
        .send({
          day_of_week: 0,
          start_time: '16:00',
          end_time: '08:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'start_time must be before end_time',
      })
    })

    test('returns 404 when staff member is not found', async () => {
      scenario.maybeSingle.users = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .post(`/api/staff/${validStaffId}/availability`)
        .send({
          day_of_week: 0,
          start_time: '08:00',
          end_time: '16:00',
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Staff member not found',
      })
    })

    test('returns 403 when user is not staff or admin', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Patient',
            clinic_id: validClinicId,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .post(`/api/staff/${validStaffId}/availability`)
        .send({
          day_of_week: 0,
          start_time: '08:00',
          end_time: '16:00',
        })

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({
        error: 'Only staff or admin can have availability records',
      })
    })

    test('returns 400 when staff member is not assigned to a clinic', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Staff',
            clinic_id: null,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .post(`/api/staff/${validStaffId}/availability`)
        .send({
          day_of_week: 0,
          start_time: '08:00',
          end_time: '16:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Staff member is not assigned to a clinic',
      })
    })

    test('returns 404 when staff clinic is not found', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Staff',
            clinic_id: validClinicId,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .post(`/api/staff/${validStaffId}/availability`)
        .send({
          day_of_week: 0,
          start_time: '08:00',
          end_time: '16:00',
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Clinic not found',
      })
    })

    test('returns 400 when availability is outside clinic hours', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Staff',
            clinic_id: validClinicId,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: {
            operating_hours: clinicOperatingHours,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .post(`/api/staff/${validStaffId}/availability`)
        .send({
          day_of_week: 0,
          start_time: '07:00',
          end_time: '16:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Availability must be within clinic operating hours',
      })
    })

    test('returns 409 when availability already exists for the day', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Staff',
            clinic_id: validClinicId,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: {
            operating_hours: clinicOperatingHours,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.staff_availability = [
        {
          data: {
            id: validAvailabilityId,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .post(`/api/staff/${validStaffId}/availability`)
        .send({
          day_of_week: 0,
          start_time: '08:00',
          end_time: '16:00',
        })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({
        error: 'Availability record already exists for this day',
      })
    })

    test('creates availability record successfully', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Staff',
            clinic_id: validClinicId,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: {
            operating_hours: clinicOperatingHours,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.staff_availability = [
        {
          data: null,
          error: null,
        },
      ]

      scenario.single.staff_availability = [
        {
          data: {
            id: validAvailabilityId,
            staff_id: validStaffId,
            day_of_week: 0,
            start_time: '08:00',
            end_time: '16:00',
            is_available: true,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .post(`/api/staff/${validStaffId}/availability`)
        .send({
          day_of_week: 0,
          start_time: '08:00',
          end_time: '16:00',
        })

      expect(res.statusCode).toBe(201)
      expect(res.body).toEqual({
        availability: {
          id: validAvailabilityId,
          staff_id: validStaffId,
          day_of_week: 0,
          start_time: '08:00',
          end_time: '16:00',
          is_available: true,
        },
      })

      const availabilityBuilder = createdBuilders.find(
        (builder) =>
          builder.table === 'staff_availability' &&
          builder.insert.mock.calls.length
      )

      expect(availabilityBuilder.insert).toHaveBeenCalledWith({
        staff_id: validStaffId,
        day_of_week: 0,
        start_time: '08:00',
        end_time: '16:00',
        is_available: true,
      })
    })

    test('returns 500 when availability insert fails', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Staff',
            clinic_id: validClinicId,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: {
            operating_hours: clinicOperatingHours,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.staff_availability = [
        {
          data: null,
          error: null,
        },
      ]

      scenario.single.staff_availability = [
        {
          data: null,
          error: new Error('Availability insert failed'),
        },
      ]

      const res = await request(app)
        .post(`/api/staff/${validStaffId}/availability`)
        .send({
          day_of_week: 0,
          start_time: '08:00',
          end_time: '16:00',
        })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to create availability record',
      })
    })
  })

  describe('PATCH /api/staff/:staffId/availability/:availabilityId', () => {
    test('returns 400 for invalid staff ID', async () => {
      const res = await request(app)
        .patch(`/api/staff/${invalidId}/availability/${validAvailabilityId}`)
        .send({
          start_time: '09:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid ID format',
      })
    })

    test('returns 400 for invalid availability ID', async () => {
      const res = await request(app)
        .patch(`/api/staff/${validStaffId}/availability/${invalidId}`)
        .send({
          start_time: '09:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid ID format',
      })
    })

    test('returns 400 when no update field is provided', async () => {
      const res = await request(app)
        .patch(
          `/api/staff/${validStaffId}/availability/${validAvailabilityId}`
        )
        .send({})

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'At least one field must be provided to update',
      })
    })

    test('returns 400 when updated start time is after end time', async () => {
      const res = await request(app)
        .patch(
          `/api/staff/${validStaffId}/availability/${validAvailabilityId}`
        )
        .send({
          start_time: '17:00',
          end_time: '08:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'start_time must be before end_time',
      })
    })

    test('returns 404 when availability record is not found', async () => {
      scenario.maybeSingle.staff_availability = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(
          `/api/staff/${validStaffId}/availability/${validAvailabilityId}`
        )
        .send({
          start_time: '09:00',
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Availability record not found',
      })
    })

    test('returns 400 when staff member is not assigned to a clinic during update', async () => {
      scenario.maybeSingle.staff_availability = [
        {
          data: {
            id: validAvailabilityId,
            staff_id: validStaffId,
            day_of_week: 0,
            start_time: '08:00',
            end_time: '16:00',
            is_available: true,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.users = [
        {
          data: {
            clinic_id: null,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(
          `/api/staff/${validStaffId}/availability/${validAvailabilityId}`
        )
        .send({
          start_time: '09:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Staff member is not assigned to a clinic',
      })
    })

    test('returns 404 when clinic is not found during update', async () => {
      scenario.maybeSingle.staff_availability = [
        {
          data: {
            id: validAvailabilityId,
            staff_id: validStaffId,
            day_of_week: 0,
            start_time: '08:00',
            end_time: '16:00',
            is_available: true,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.users = [
        {
          data: {
            clinic_id: validClinicId,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app)
        .patch(
          `/api/staff/${validStaffId}/availability/${validAvailabilityId}`
        )
        .send({
          start_time: '09:00',
        })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Clinic not found',
      })
    })

    test('returns 400 when updated availability is outside clinic hours', async () => {
      scenario.maybeSingle.staff_availability = [
        {
          data: {
            id: validAvailabilityId,
            staff_id: validStaffId,
            day_of_week: 0,
            start_time: '08:00',
            end_time: '16:00',
            is_available: true,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.users = [
        {
          data: {
            clinic_id: validClinicId,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: {
            operating_hours: clinicOperatingHours,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(
          `/api/staff/${validStaffId}/availability/${validAvailabilityId}`
        )
        .send({
          start_time: '07:00',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Availability must be within clinic operating hours',
      })
    })

    test('updates availability record successfully', async () => {
      scenario.maybeSingle.staff_availability = [
        {
          data: {
            id: validAvailabilityId,
            staff_id: validStaffId,
            day_of_week: 0,
            start_time: '08:00',
            end_time: '16:00',
            is_available: true,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.users = [
        {
          data: {
            clinic_id: validClinicId,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: {
            operating_hours: clinicOperatingHours,
          },
          error: null,
        },
      ]

      scenario.single.staff_availability = [
        {
          data: {
            id: validAvailabilityId,
            staff_id: validStaffId,
            day_of_week: 0,
            start_time: '09:00',
            end_time: '16:00',
            is_available: false,
          },
          error: null,
        },
      ]

      const res = await request(app)
        .patch(
          `/api/staff/${validStaffId}/availability/${validAvailabilityId}`
        )
        .send({
          start_time: '09:00',
          is_available: false,
        })

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        availability: {
          id: validAvailabilityId,
          staff_id: validStaffId,
          day_of_week: 0,
          start_time: '09:00',
          end_time: '16:00',
          is_available: false,
        },
      })

      const availabilityBuilder = createdBuilders.find(
        (builder) =>
          builder.table === 'staff_availability' &&
          builder.update.mock.calls.length
      )

      expect(availabilityBuilder.update).toHaveBeenCalledWith({
        start_time: '09:00',
        is_available: false,
      })
    })

    test('returns 500 when availability update fails', async () => {
      scenario.maybeSingle.staff_availability = [
        {
          data: {
            id: validAvailabilityId,
            staff_id: validStaffId,
            day_of_week: 0,
            start_time: '08:00',
            end_time: '16:00',
            is_available: true,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.users = [
        {
          data: {
            clinic_id: validClinicId,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.clinics = [
        {
          data: {
            operating_hours: clinicOperatingHours,
          },
          error: null,
        },
      ]

      scenario.single.staff_availability = [
        {
          data: null,
          error: new Error('Availability update failed'),
        },
      ]

      const res = await request(app)
        .patch(
          `/api/staff/${validStaffId}/availability/${validAvailabilityId}`
        )
        .send({
          start_time: '09:00',
        })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to update availability record',
      })
    })
  })
})