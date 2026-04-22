const request = require('supertest')

let mockFrom
let mockRpc
let app
//data we will use in our tests - valid IDs for clinic, user and admin, and a different clinic ID for testing cross-clinic assignment prevention
const validClinicId = '123e4567-e89b-12d3-a456-426614174000'
const validUserId = '123e4567-e89b-12d3-a456-426614174001'
const validAdminId = '123e4567-e89b-12d3-a456-426614174002'
const otherClinicId = '123e4567-e89b-12d3-a456-426614174003'

function makeValidOperatingHours() {
  return {
    monday: { open: '08:00', close: '16:00' },
    tuesday: { open: '08:00', close: '16:00' },
    wednesday: { open: '08:00', close: '16:00' },
    thursday: { open: '08:00', close: '16:00' },
    friday: { open: '08:00', close: '16:00' },
    saturday: { open: '', close: '' },
    sunday: { open: '', close: '' },
  }
}

function makeQueryBuilder({ data = null, error = null } = {}) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: data || [], error }),
    single: jest.fn().mockResolvedValue({ data, error }),
    maybeSingle: jest.fn().mockResolvedValue({ data, error }),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  }
}

function setupSupabaseHandlers(handlers) {
  const queues = {}

  Object.entries(handlers).forEach(([tableName, value]) => {
    queues[tableName] = Array.isArray(value) ? [...value] : [value]
  })

  mockFrom.mockImplementation((tableName) => {
    const queue = queues[tableName]

    if (!queue || queue.length === 0) {
      return makeQueryBuilder({ data: null, error: null })
    }

    const next = queue.shift()
    return typeof next === 'function' ? next() : next
  })
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
  })),
}))

jest.mock('../../src/queueNotificationService', () => ({
  configureQueueNotificationService: jest.fn(),
  checkAndTriggerNotifications: jest.fn(() => []),
}))

describe('clinic management integration', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    mockFrom = jest.fn()
    mockRpc = jest.fn().mockResolvedValue({ error: null })

    process.env.SUPABASE_URL = 'http://test.local'
    process.env.SUPABASE_KEY = 'test-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'

    jest.spyOn(console, 'error').mockImplementation(() => {})
    app = require('../../src/app')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('PATCH /api/users/:userId/assign-clinic', () => {
    test('assigns staff to clinic successfully', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: { id: validAdminId, role: 'Admin' },
              error: null,
            })
            return builder
          },
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: {
                id: validUserId,
                role: 'Clinic Staff',
                full_name: 'Sam Staff',
                clinic_id: null,
              },
              error: null,
            })
            return builder
          },
          () => {
            const builder = makeQueryBuilder()
            builder.update.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.select.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: {
                id: validUserId,
                full_name: 'Sam Staff',
                role: 'Clinic Staff',
                clinic_id: validClinicId,
              },
              error: null,
            })
            return builder
          },
        ],
        clinics: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: { id: validClinicId, name: 'Hillbrow Clinic' },
              error: null,
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/users/${validUserId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Sam Staff assigned to Hillbrow Clinic')
      expect(res.body.user.clinic_id).toBe(validClinicId)
    })

    test('rejects invalid ID format', async () => {
      const res = await request(app)
        .patch('/api/users/not-a-uuid/assign-clinic')
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid ID format')
    })

    test('rejects non-admin user', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: { id: validAdminId, role: 'Patient' },
              error: null,
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/users/${validUserId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('Only admins can assign staff to clinics')
    })

    test('rejects when selected user is not found', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: { id: validAdminId, role: 'Admin' },
              error: null,
            })
            return builder
          },
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: null,
              error: { message: 'not found' },
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/users/${validUserId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('User not found')
    })

    test('rejects duplicate same-clinic assignment', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: { id: validAdminId, role: 'Admin' },
              error: null,
            })
            return builder
          },
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: {
                id: validUserId,
                role: 'Clinic Staff',
                full_name: 'Sam Staff',
                clinic_id: validClinicId,
              },
              error: null,
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/users/${validUserId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('Staff member is already assigned to this clinic')
    })

    test('rejects assignment to another clinic when already assigned elsewhere', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: { id: validAdminId, role: 'Admin' },
              error: null,
            })
            return builder
          },
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: {
                id: validUserId,
                role: 'Clinic Staff',
                full_name: 'Sam Staff',
                clinic_id: otherClinicId,
              },
              error: null,
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/users/${validUserId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('Staff member is already assigned to another clinic')
    })

    test('rejects when clinic is not found', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: { id: validAdminId, role: 'Admin' },
              error: null,
            })
            return builder
          },
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: {
                id: validUserId,
                role: 'Clinic Staff',
                full_name: 'Sam Staff',
                clinic_id: null,
              },
              error: null,
            })
            return builder
          },
        ],
        clinics: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: null,
              error: { message: 'not found' },
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/users/${validUserId}/assign-clinic`)
        .send({
          admin_id: validAdminId,
          clinic_id: validClinicId,
        })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Clinic not found')
    })
  })

  describe('PATCH /api/users/:userId/unassign-clinic', () => {
    test('unassigns staff successfully', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: { id: validAdminId, role: 'Admin' },
              error: null,
            })
            return builder
          },
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: {
                id: validUserId,
                role: 'Clinic Staff',
                full_name: 'Sam Staff',
                clinic_id: validClinicId,
              },
              error: null,
            })
            return builder
          },
          () => {
            const builder = makeQueryBuilder()
            builder.update.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.select.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: {
                id: validUserId,
                full_name: 'Sam Staff',
                role: 'Clinic Staff',
                clinic_id: null,
              },
              error: null,
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/users/${validUserId}/unassign-clinic`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Sam Staff unassigned from clinic')
      expect(res.body.user.clinic_id).toBeNull()
    })

    test('rejects invalid ID format', async () => {
      const res = await request(app)
        .patch('/api/users/not-a-uuid/unassign-clinic')
        .send({
          admin_id: validAdminId,
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid ID format')
    })

    test('rejects non-admin user', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: { id: validAdminId, role: 'Patient' },
              error: null,
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/users/${validUserId}/unassign-clinic`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('Only admins can unassign staff from clinics')
    })

    test('rejects when selected user is not found', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: { id: validAdminId, role: 'Admin' },
              error: null,
            })
            return builder
          },
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: null,
              error: { message: 'not found' },
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/users/${validUserId}/unassign-clinic`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('User not found')
    })

    test('rejects when staff member has no clinic', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: { id: validAdminId, role: 'Admin' },
              error: null,
            })
            return builder
          },
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: {
                id: validUserId,
                role: 'Clinic Staff',
                full_name: 'Sam Staff',
                clinic_id: null,
              },
              error: null,
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/users/${validUserId}/unassign-clinic`)
        .send({
          admin_id: validAdminId,
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Staff member is not assigned to a clinic')
    })
  })

  describe('PATCH /api/clinics/:id', () => {
    test('updates clinic successfully with valid payload', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.maybeSingle.mockResolvedValue({
              data: { id: validAdminId, role: 'Admin' },
              error: null,
            })
            return builder
          },
        ],
        clinics: [
          () => {
            const builder = makeQueryBuilder()
            builder.update.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.select.mockReturnValue(builder)
            builder.single.mockResolvedValue({
              data: {
                id: validClinicId,
                name: 'Hillbrow Clinic',
                facility_type: 'Hospital',
                services: ['General Consultation', 'TB Treatment'],
                operating_hours: makeValidOperatingHours(),
              },
              error: null,
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          admin_id: validAdminId,
          name: 'Hillbrow Clinic',
          facility_type: 'Hospital',
          services: ['General Consultation', 'TB Treatment'],
          operating_hours: makeValidOperatingHours(),
        })

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Clinic updated successfully')
      expect(res.body.clinic.facility_type).toBe('Hospital')
    })

    test('rejects invalid clinic ID', async () => {
      const res = await request(app)
        .patch('/api/clinics/not-a-uuid')
        .send({
          admin_id: validAdminId,
          name: 'Hillbrow Clinic',
          facility_type: 'Clinic',
          services: ['General Consultation'],
          operating_hours: {},
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid clinic ID format')
    })

    test('rejects invalid admin ID', async () => {
      const res = await request(app)
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          admin_id: 'bad-id',
          name: 'Hillbrow Clinic',
          facility_type: 'Clinic',
          services: ['General Consultation'],
          operating_hours: {},
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Valid admin_id is required')
    })

    test('rejects when admin user is not found', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.maybeSingle.mockResolvedValue({
              data: null,
              error: null,
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          admin_id: validAdminId,
          name: 'Hillbrow Clinic',
          facility_type: 'Clinic',
          services: ['General Consultation'],
          operating_hours: makeValidOperatingHours(),
        })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Admin user not found')
    })

    test('rejects when user is not admin', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.maybeSingle.mockResolvedValue({
              data: { id: validAdminId, role: 'Patient' },
              error: null,
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          admin_id: validAdminId,
          name: 'Hillbrow Clinic',
          facility_type: 'Clinic',
          services: ['General Consultation'],
          operating_hours: makeValidOperatingHours(),
        })

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('Only admins can update clinics')
    })

    test('rejects invalid services list', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.maybeSingle.mockResolvedValue({
              data: { id: validAdminId, role: 'Admin' },
              error: null,
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          admin_id: validAdminId,
          name: 'Hillbrow Clinic',
          facility_type: 'Clinic',
          services: ['@@@'],
          operating_hours: makeValidOperatingHours(),
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invalid services list')
    })

    test('rejects invalid operating hours', async () => {
      setupSupabaseHandlers({
        users: [
          () => {
            const builder = makeQueryBuilder()
            builder.select.mockReturnValue(builder)
            builder.eq.mockReturnValue(builder)
            builder.maybeSingle.mockResolvedValue({
              data: { id: validAdminId, role: 'Admin' },
              error: null,
            })
            return builder
          },
        ],
      })

      const res = await request(app)
        .patch(`/api/clinics/${validClinicId}`)
        .send({
          admin_id: validAdminId,
          name: 'Hillbrow Clinic',
          facility_type: 'Clinic',
          services: ['General Consultation'],
          operating_hours: {
            monday: { open: '16:00', close: '08:00' },
          },
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invalid operating hours')
    })
  })
})