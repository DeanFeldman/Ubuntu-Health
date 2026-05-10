const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validStaffId = '00000000-0000-0000-0000-000000000010'
const validPatientId = '00000000-0000-0000-0000-000000000020'
const createdAuthUserId = '00000000-0000-0000-0000-000000000099'
const invalidId = 'invalid-id'

let app
let mockSupabase
let scenario
let createdBuilders

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  mockSupabase = mockContext.mockSupabase
  scenario = mockContext.scenario
  createdBuilders = mockContext.createdBuilders
})

describe('Patient routes', () => {
  describe('POST /api/patients', () => {
    test('returns 400 when full_name is missing', async () => {
      const res = await request(app).post('/api/patients').send({
        full_name: '',
        email: 'patient@example.com',
        created_by: validStaffId,
      })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'full_name is required',
      })
    })

    test('returns 400 when email is missing', async () => {
      const res = await request(app).post('/api/patients').send({
        full_name: 'Test Patient',
        email: '',
        created_by: validStaffId,
      })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'email is required',
      })
    })

    test('returns 400 when email format is invalid', async () => {
      const res = await request(app).post('/api/patients').send({
        full_name: 'Test Patient',
        email: 'not-an-email',
        created_by: validStaffId,
      })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid email format',
      })
    })

    test('returns 400 when created_by is missing', async () => {
      const res = await request(app).post('/api/patients').send({
        full_name: 'Test Patient',
        email: 'patient@example.com',
        created_by: '',
      })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'created_by is required',
      })
    })

    test('returns 400 when created_by ID format is invalid', async () => {
      const res = await request(app).post('/api/patients').send({
        full_name: 'Test Patient',
        email: 'patient@example.com',
        created_by: invalidId,
      })

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid created_by ID format',
      })
    })

    test('returns 404 when staff member is not found', async () => {
      scenario.maybeSingle.users = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app).post('/api/patients').send({
        full_name: 'Test Patient',
        email: 'patient@example.com',
        created_by: validStaffId,
      })

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Staff member not found',
      })
    })

    test('returns 403 when creator is not staff or admin', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Patient',
          },
          error: null,
        },
      ]

      const res = await request(app).post('/api/patients').send({
        full_name: 'Test Patient',
        email: 'patient@example.com',
        created_by: validStaffId,
      })

      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({
        error: 'Only staff or admin can create patient records',
      })
    })

    test('returns 409 when a patient with this email already exists', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Staff',
          },
          error: null,
        },
      ]

      scenario.maybeSingle.patients = [
        {
          data: {
            id: validPatientId,
          },
          error: null,
        },
      ]

      const res = await request(app).post('/api/patients').send({
        full_name: 'Test Patient',
        email: 'patient@example.com',
        created_by: validStaffId,
      })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({
        error: 'A patient with this email already exists',
      })
    })

    test('returns 409 when patient is already registered as a user', async () => {
      const existingUserId = '00000000-0000-0000-0000-000000000030'

      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Staff',
          },
          error: null,
        },
        {
          data: {
            id: existingUserId,
          },
          error: null,
        },
      ]

      scenario.maybeSingle.patients = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app).post('/api/patients').send({
        full_name: 'Test Patient',
        email: 'patient@example.com',
        created_by: validStaffId,
      })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({
        error:
          'This patient is already registered in the system. Find them in the existing patients list instead.',
        user_id: existingUserId,
      })
    })

    test('returns 409 when email already exists in auth users', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Staff',
          },
          error: null,
        },
        {
          data: null,
          error: null,
        },
      ]

      scenario.maybeSingle.patients = [
        {
          data: null,
          error: null,
        },
      ]

      mockSupabase.auth.admin.listUsers.mockResolvedValueOnce({
        data: {
          users: [
            {
              email: 'patient@example.com',
            },
          ],
        },
        error: null,
      })

      const res = await request(app).post('/api/patients').send({
        full_name: 'Test Patient',
        email: 'Patient@Example.com',
        created_by: validStaffId,
      })

      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({
        error:
          'This patient is already registered in the system. Find them in the existing patients list instead.',
      })
    })

    test('creates patient record successfully', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Staff',
          },
          error: null,
        },
        {
          data: null,
          error: null,
        },
      ]

      scenario.maybeSingle.patients = [
        {
          data: null,
          error: null,
        },
      ]

      mockSupabase.auth.admin.createUser.mockResolvedValueOnce({
        data: {
          user: {
            id: createdAuthUserId,
          },
        },
        error: null,
      })

      scenario.thenable.users = [
        {
          data: null,
          error: null,
        },
      ]

      scenario.single.patients = [
        {
          data: {
            id: validPatientId,
            full_name: 'Test Patient',
            phone: '0123456789',
            email: 'patient@example.com',
            date_of_birth: '2000-01-01',
            created_by: validStaffId,
            linked_user_id: createdAuthUserId,
          },
          error: null,
        },
      ]

      const res = await request(app).post('/api/patients').send({
        full_name: '  Test Patient  ',
        phone: '0123456789',
        email: 'Patient@Example.com',
        date_of_birth: '2000-01-01',
        created_by: validStaffId,
      })

      expect(res.statusCode).toBe(201)
      expect(res.body).toEqual({
        patient: {
          id: validPatientId,
          full_name: 'Test Patient',
          phone: '0123456789',
          email: 'patient@example.com',
          date_of_birth: '2000-01-01',
          created_by: validStaffId,
          linked_user_id: createdAuthUserId,
          user_id: createdAuthUserId,
        },
      })

      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith({
        email: 'patient@example.com',
        email_confirm: true,
        user_metadata: {
          full_name: 'Test Patient',
        },
      })

      const userInsertBuilder = createdBuilders.find(
        (builder) => builder.table === 'users' && builder.insert.mock.calls.length
      )

      expect(userInsertBuilder.insert).toHaveBeenCalledWith({
        id: createdAuthUserId,
        email: 'patient@example.com',
        full_name: 'Test Patient',
        role: 'Patient',
      })

      const patientInsertBuilder = createdBuilders.find(
        (builder) =>
          builder.table === 'patients' && builder.insert.mock.calls.length
      )

      expect(patientInsertBuilder.insert).toHaveBeenCalledWith({
        full_name: 'Test Patient',
        phone: '0123456789',
        email: 'patient@example.com',
        date_of_birth: '2000-01-01',
        created_by: validStaffId,
        linked_user_id: createdAuthUserId,
      })
    })

    test('rolls back auth user when public user insert fails', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Staff',
          },
          error: null,
        },
        {
          data: null,
          error: null,
        },
      ]

      scenario.maybeSingle.patients = [
        {
          data: null,
          error: null,
        },
      ]

      mockSupabase.auth.admin.createUser.mockResolvedValueOnce({
        data: {
          user: {
            id: createdAuthUserId,
          },
        },
        error: null,
      })

      scenario.thenable.users = [
        {
          data: null,
          error: new Error('User insert failed'),
        },
      ]

      const res = await request(app).post('/api/patients').send({
        full_name: 'Test Patient',
        email: 'patient@example.com',
        created_by: validStaffId,
      })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to create patient record',
      })

      expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith(
        createdAuthUserId
      )
    })

    test('rolls back created auth and public user when patient insert fails', async () => {
      scenario.maybeSingle.users = [
        {
          data: {
            id: validStaffId,
            role: 'Staff',
          },
          error: null,
        },
        {
          data: null,
          error: null,
        },
      ]

      scenario.maybeSingle.patients = [
        {
          data: null,
          error: null,
        },
      ]

      mockSupabase.auth.admin.createUser.mockResolvedValueOnce({
        data: {
          user: {
            id: createdAuthUserId,
          },
        },
        error: null,
      })

      scenario.thenable.users = [
        {
          data: null,
          error: null,
        },
      ]

      scenario.single.patients = [
        {
          data: null,
          error: new Error('Patient insert failed'),
        },
      ]

      scenario.thenable.users.push({
        data: null,
        error: null,
      })

      const res = await request(app).post('/api/patients').send({
        full_name: 'Test Patient',
        email: 'patient@example.com',
        created_by: validStaffId,
      })

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to create patient record',
      })

      expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith(
        createdAuthUserId
      )

      const userDeleteBuilder = createdBuilders.find(
        (builder) => builder.table === 'users' && builder.delete.mock.calls.length
      )

      expect(userDeleteBuilder).toBeDefined()
      expect(userDeleteBuilder.eq).toHaveBeenCalledWith('id', createdAuthUserId)
    })
  })
})