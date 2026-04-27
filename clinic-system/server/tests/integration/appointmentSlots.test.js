const request = require('supertest')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validUserId = '00000000-0000-0000-0000-000000000003'

const mockAppointmentInsert = jest.fn()

jest.mock('@supabase/supabase-js', () => {
  const from = jest.fn((table) => {
    if (table === 'clinics') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: validClinicId,
            operating_hours: {},
            appointment_duration_minutes: 30,
          },
          error: null,
        }),
      }
    }

    if (table === 'appointments') {
      const appointmentsQuery = {
        selected: null,

        select: jest.fn(function (columns) {
          this.selected = columns
          return this
        }),

        eq: jest.fn(function () {
          return this
        }),

        in: jest.fn(function () {
          // Used in GET /slots
          if (this.selected === 'slot_id') {
            return Promise.resolve({
              data: [{ slot_id: 'slot-booked' }],
              error: null,
            })
          }
          return this
        }),

        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),

        insert: mockAppointmentInsert,
      }

      return appointmentsQuery
    }

    if (table === 'slots') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        lt: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'slot-booked',
              slot_datetime: '2099-05-10T08:00:00.000Z',
            },
          ],
          error: null,
        }),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: 'slot-1',
            slot_datetime: '2099-05-10T09:00:00.000Z',
          },
          error: null,
        }),
        insert: jest.fn().mockResolvedValue({
          data: {
            id: 'slot-1',
            slot_datetime: '2099-05-10T09:00:00.000Z',
          },
          error: null,
        }),
      }
    }

    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

  return {
    createClient: jest.fn(() => ({ from })),
  }
})

jest.mock('../../src/clinicSchedule', () => ({
  resolveClinicSchedule: jest.fn(() => ({
    operating_hours: {},
    appointment_duration_minutes: 30,
  })),
  generateDailySlots: jest.fn(() => [
    '09:00',
    'bad-slot',
    '25:99',
    '09:00',
    '10:00',
  ]),
}))

const app = require('../../src/app')

describe('appointments + slot handling', () => {
  beforeEach(() => {
    mockAppointmentInsert.mockClear()

    mockAppointmentInsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'appointment-1',
            clinic_id: validClinicId,
            patient_id: validPatientId,
            slot_id: 'slot-1',
            status: 'Confirmed',
          },
          error: null,
        }),
      }),
    })
  })

  it('returns only valid, unique, unbooked appointment slots', async () => {
    const response = await request(app)
      .get('/api/appointments/slots')
      .query({
        clinic_id: validClinicId,
        date: '2099-05-10',
      })

    expect(response.status).toBe(200)
    expect(response.body).toEqual(['09:00'])
  })

  it('rejects invalid slot retrieval input', async () => {
    const response = await request(app)
      .get('/api/appointments/slots')
      .query({
        clinic_id: 'not-a-uuid',
        date: '2099-05-10',
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Invalid clinic ID format')
  })

  it('stores correct slot_id when creating an appointment', async () => {
    const response = await request(app)
      .post('/api/appointments')
      .send({
        clinic_id: validClinicId,
        patient_id: validPatientId,
        date: '2099-05-10',
        time: '09:00',
        booked_by: validUserId,
      })

    expect(response.status).toBe(201)

    expect(mockAppointmentInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: validClinicId,
        patient_id: validPatientId,
        slot_id: 'slot-1',
        status: 'Confirmed',
      })
    )
  })
})