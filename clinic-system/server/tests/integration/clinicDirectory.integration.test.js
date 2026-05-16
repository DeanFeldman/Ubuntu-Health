const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'

let app
let scenario

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
})

describe('clinic directory integration flow', () => {
  test('clinic directory returns real clinic-style data and selected clinic can be viewed', async () => {
    const clinic = {
      id: validClinicId,
      name: 'Ubuntu Clinic',
      facility_type: 'Clinic',
      province: 'Gauteng',
      district: 'Johannesburg',
      municipality: 'Region F',
      services: ['General Consultation', 'HIV Testing'],
      appointment_duration_minutes: 30,
      operating_hours: {
        monday: { open: '08:00', close: '17:00' },
        tuesday: { open: '08:00', close: '17:00' },
        wednesday: { open: '08:00', close: '17:00' },
        thursday: { open: '08:00', close: '17:00' },
        friday: { open: '08:00', close: '17:00' },
        saturday: { open: '', close: '' },
        sunday: { open: '', close: '' },
      },
    }

    scenario.thenable.clinics = [
      {
        data: [clinic],
        error: null,
      },
    ]

    scenario.maybeSingle.clinics = [
      {
        data: clinic,
        error: null,
      },
    ]

    const directoryResponse = await request(app).get('/api/clinics')

    expect(directoryResponse.statusCode).toBe(200)
    expect(directoryResponse.body.clinics).toEqual([clinic])

    const selectedClinicResponse = await request(app).get(
      `/api/clinics/${validClinicId}`
    )

    expect(selectedClinicResponse.statusCode).toBe(200)
    expect(selectedClinicResponse.body.clinic).toEqual(clinic)
  })
})