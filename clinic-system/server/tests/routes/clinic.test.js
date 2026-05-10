const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
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

describe('Clinic endpoints', () => {
  describe('GET /api/clinics', () => {
    test('returns clinics list', async () => {
      scenario.thenable.clinics = [
        {
          data: [
            {
              id: validClinicId,
              name: 'Ubuntu Clinic',
              province: 'Gauteng',
              district: 'Test District',
              municipality: 'Test Municipality',
              facility_type: 'Clinic',
            },
          ],
          error: null,
        },
      ]

      const res = await request(app).get('/api/clinics')

      expect(res.statusCode).toBe(200)
      expect(res.body.clinics).toHaveLength(1)
      expect(res.body.clinics[0]).toEqual(
        expect.objectContaining({
          id: validClinicId,
          name: 'Ubuntu Clinic',
          province: 'Gauteng',
          district: 'Test District',
          municipality: 'Test Municipality',
          facility_type: 'Clinic',
          appointment_duration_minutes: 15,
        })
      )
      expect(res.body.clinics[0].operating_hours).toBeDefined()
    })

    test.each([
      ['province', 'Gauteng'],
      ['district', 'Test District'],
      ['facility_type', 'Clinic'],
      ['municipality', 'Test Municipality'],
    ])('applies %s filter when provided', async (filterName, filterValue) => {
      scenario.thenable.clinics = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app).get(
        `/api/clinics?${filterName}=${encodeURIComponent(filterValue)}`
      )

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        clinics: [],
      })

      const clinicBuilder = createdBuilders.find(
        (builder) => builder.table === 'clinics'
      )

      expect(clinicBuilder.eq).toHaveBeenCalledWith(filterName, filterValue)
    })

    test('applies search filter when provided', async () => {
      scenario.thenable.clinics = [
        {
          data: [],
          error: null,
        },
      ]

      const res = await request(app).get('/api/clinics?search=ubuntu')

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({
        clinics: [],
      })

      const clinicBuilder = createdBuilders.find(
        (builder) => builder.table === 'clinics'
      )

      expect(clinicBuilder.ilike).toHaveBeenCalled()
    })

    test('returns 500 when clinics query fails', async () => {
      scenario.thenable.clinics = [
        {
          data: null,
          error: new Error('Clinics query failed'),
        },
      ]

      const res = await request(app).get('/api/clinics')

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to fetch clinics',
      })
    })
  })

  describe('GET /api/clinics/:id', () => {
    test('returns 400 for invalid clinic id', async () => {
      const res = await request(app).get(`/api/clinics/${invalidId}`)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        error: 'Invalid clinic ID format',
      })
    })

    test('returns clinic when found', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: {
            id: validClinicId,
            name: 'Ubuntu Clinic',
            province: 'Gauteng',
          },
          error: null,
        },
      ]

      const res = await request(app).get(`/api/clinics/${validClinicId}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.clinic).toEqual(
        expect.objectContaining({
          id: validClinicId,
          name: 'Ubuntu Clinic',
          province: 'Gauteng',
          appointment_duration_minutes: 15,
        })
      )
      expect(res.body.clinic.operating_hours).toBeDefined()
    })

    test('returns 404 when clinic is not found', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: null,
          error: null,
        },
      ]

      const res = await request(app).get(`/api/clinics/${validClinicId}`)

      expect(res.statusCode).toBe(404)
      expect(res.body).toEqual({
        error: 'Clinic not found',
      })
    })

    test('returns 500 when clinic lookup fails', async () => {
      scenario.maybeSingle.clinics = [
        {
          data: null,
          error: new Error('Clinic lookup failed'),
        },
      ]

      const res = await request(app).get(`/api/clinics/${validClinicId}`)

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        error: 'Failed to fetch clinic',
      })
    })
  })
})