const request = require('supertest')
const { setupMockApp } = require('../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validAppointmentId = '00000000-0000-0000-0000-000000000003'
const validQueueEntryId = '00000000-0000-0000-0000-000000000004'
const validSlotId = '00000000-0000-0000-0000-000000000005'

let app
let scenario

beforeEach(() => {
  const mockContext = setupMockApp()

  app = mockContext.app
  scenario = mockContext.scenario
})

describe('custom report integration flow', () => {
  test('appointment custom report returns filtered appointment records with patient and clinic details', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          name: 'Ubuntu Clinic',
        },
        error: null,
      },
    ]

    scenario.thenable.appointments = [
      {
        data: [
          {
            id: validAppointmentId,
            patient_id: validPatientId,
            clinic_id: validClinicId,
            slot_id: validSlotId,
            appointment_date: null,
            appointment_time: null,
            status: 'Confirmed',
            service: 'General Consultation',
            slots: {
              id: validSlotId,
              slot_datetime: '2026-05-11T08:00:00.000Z',
            },
            clinics: {
              id: validClinicId,
              name: 'Ubuntu Clinic',
            },
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        data: [
          {
            id: validPatientId,
            full_name: 'Jane Patient',
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.patients = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/reports/custom?report_type=appointments&clinic_id=${validClinicId}&status=Confirmed&start_date=2026-05-11&end_date=2026-05-11`
    )

    expect(res.statusCode).toBe(200)

    expect(res.body).toEqual({
      report_type: 'appointments',
      filters: {
        clinic_id: validClinicId,
        clinic_name: 'Ubuntu Clinic',
        start_date: '2026-05-11',
        end_date: '2026-05-11',
        date_range_label: '2026-05-11 to 2026-05-11',
        status: 'Confirmed',
        status_label: 'Confirmed',
      },
      total_records: 1,
      records: [
        {
          id: validAppointmentId,
          patient_name: 'Jane Patient',
          clinic_id: validClinicId,
          clinic_name: 'Ubuntu Clinic',
          appointment_date: '2026-05-11',
          appointment_time: '10:00',
          appointment_status: 'Confirmed',
          service: 'General Consultation',
        },
      ],
    })
  })

  test('queue custom report returns filtered queue records with patient and clinic details', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: {
          id: validClinicId,
          name: 'Ubuntu Clinic',
        },
        error: null,
      },
    ]

    scenario.thenable.queue_entries = [
      {
        data: [
          {
            id: validQueueEntryId,
            clinic_id: validClinicId,
            patient_id: validPatientId,
            position: 1,
            status: 'Complete',
            joined_at: '2026-05-11T08:00:00.000Z',
            called_at: '2026-05-11T08:20:00.000Z',
            completed_at: '2026-05-11T08:45:00.000Z',
            clinics: {
              id: validClinicId,
              name: 'Ubuntu Clinic',
            },
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.users = [
      {
        data: [
          {
            id: validPatientId,
            full_name: 'Queue Patient',
          },
        ],
        error: null,
      },
    ]

    scenario.thenable.patients = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/reports/custom?report_type=queue&clinic_id=${validClinicId}&status=Complete&start_date=2026-05-11&end_date=2026-05-11`
    )

    expect(res.statusCode).toBe(200)

    expect(res.body).toEqual({
      report_type: 'queue',
      filters: {
        clinic_id: validClinicId,
        clinic_name: 'Ubuntu Clinic',
        start_date: '2026-05-11',
        end_date: '2026-05-11',
        date_range_label: '2026-05-11 to 2026-05-11',
        status: 'Complete',
        status_label: 'Complete',
      },
      total_records: 1,
      records: [
        {
          id: validQueueEntryId,
          patient_name: 'Queue Patient',
          clinic_id: validClinicId,
          clinic_name: 'Ubuntu Clinic',
          queue_position: 1,
          queue_status: 'Complete',
          joined_at: '2026-05-11T08:00:00.000Z',
          completed_at: '2026-05-11T08:45:00.000Z',
          updated_at: '2026-05-11T08:45:00.000Z',
        },
      ],
    })
  })
})