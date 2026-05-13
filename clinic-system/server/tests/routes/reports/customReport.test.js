const request = require('supertest')
const { setupMockApp } = require('../../helpers/mockSupabaseApp')

const validClinicId = '00000000-0000-0000-0000-000000000001'
const validPatientId = '00000000-0000-0000-0000-000000000002'
const validAppointmentId = '00000000-0000-0000-0000-000000000003'
const validQueueEntryId = '00000000-0000-0000-0000-000000000004'
const validSlotId = '00000000-0000-0000-0000-000000000005'
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

describe('custom report', () => {
  test('defaults to all clinics, all time, and all statuses', async () => {
    scenario.thenable.appointments = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=appointments'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      filters: {
        report_type: 'appointments',
        clinic_id: null,
        clinic_name: 'All clinics',
        start_date: null,
        end_date: null,
        date_range_label: 'All time',
        status: null,
        status_label: 'All statuses',
      },
      records: [],
    })

    expect(createdBuilders).toHaveLength(1)
    expect(createdBuilders[0].table).toBe('appointments')
    expect(createdBuilders[0].eq).not.toHaveBeenCalled()
    expect(createdBuilders[0].gte).not.toHaveBeenCalled()
    expect(createdBuilders[0].lte).not.toHaveBeenCalled()
  })

  test('appointment report queries appointment records', async () => {
    const appointmentRecord = {
      id: validAppointmentId,
      patient_id: validPatientId,
      clinic_id: validClinicId,
      slot_id: validSlotId,
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
    }

    scenario.thenable.appointments = [
      {
        data: [appointmentRecord],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=appointments'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.records).toEqual([appointmentRecord])

    const appointmentBuilder = createdBuilders[0]
    expect(appointmentBuilder.table).toBe('appointments')
    expect(appointmentBuilder.select).toHaveBeenCalledWith(
      'id, patient_id, clinic_id, slot_id, status, service, slots(id, slot_datetime), clinics(id, name)'
    )
  })

  test('queue report queries queue records', async () => {
    const queueRecord = {
      id: validQueueEntryId,
      clinic_id: validClinicId,
      patient_id: validPatientId,
      position: 1,
      status: 'Waiting',
      joined_at: '2026-05-11T08:00:00.000Z',
      called_at: null,
      completed_at: null,
      clinics: {
        id: validClinicId,
        name: 'Ubuntu Clinic',
      },
    }

    scenario.thenable.queue_entries = [
      {
        data: [queueRecord],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=queue'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.records).toEqual([queueRecord])

    const queueBuilder = createdBuilders[0]
    expect(queueBuilder.table).toBe('queue_entries')
    expect(queueBuilder.select).toHaveBeenCalledWith(
      'id, clinic_id, patient_id, position, status, joined_at, called_at, completed_at, clinics(id, name)'
    )
    expect(queueBuilder.order).toHaveBeenCalledWith('joined_at', {
      ascending: true,
    })
  })

  test('applies clinic filter after selected clinic lookup', async () => {
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
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/reports/custom?report_type=appointments&clinic_id=${validClinicId}`
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters.clinic_id).toBe(validClinicId)
    expect(res.body.filters.clinic_name).toBe('Ubuntu Clinic')

    const clinicBuilder = createdBuilders[0]
    const appointmentBuilder = createdBuilders[1]

    expect(clinicBuilder.table).toBe('clinics')
    expect(clinicBuilder.eq).toHaveBeenCalledWith('id', validClinicId)
    expect(appointmentBuilder.eq).toHaveBeenCalledWith('clinic_id', validClinicId)
  })

  test('applies appointment start_date and end_date filters using slot datetime', async () => {
    scenario.thenable.appointments = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=appointments&start_date=2026-05-01&end_date=2026-05-11'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters.date_range_label).toBe('2026-05-01 to 2026-05-11')

    const appointmentBuilder = createdBuilders[0]
    expect(appointmentBuilder.select).toHaveBeenCalledWith(
      'id, patient_id, clinic_id, slot_id, status, service, slots!inner(id, slot_datetime), clinics(id, name)'
    )
    expect(appointmentBuilder.gte).toHaveBeenCalledWith(
      'slots.slot_datetime',
      '2026-05-01T00:00:00.000Z'
    )
    expect(appointmentBuilder.lte).toHaveBeenCalledWith(
      'slots.slot_datetime',
      '2026-05-11T23:59:59.999Z'
    )
  })

  test('applies queue start_date and end_date filters using joined_at', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=queue&start_date=2026-05-01&end_date=2026-05-11'
    )

    expect(res.statusCode).toBe(200)

    const queueBuilder = createdBuilders[0]
    expect(queueBuilder.gte).toHaveBeenCalledWith(
      'joined_at',
      '2026-05-01T00:00:00.000Z'
    )
    expect(queueBuilder.lte).toHaveBeenCalledWith(
      'joined_at',
      '2026-05-11T23:59:59.999Z'
    )
  })

  test('applies appointment status filter for appointment reports', async () => {
    scenario.thenable.appointments = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=appointments&status=Completed'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters.status).toBe('Completed')
    expect(res.body.filters.status_label).toBe('Completed')
    expect(createdBuilders[0].eq).toHaveBeenCalledWith('status', 'Completed')
  })

  test('applies queue status filter for queue reports', async () => {
    scenario.thenable.queue_entries = [
      {
        data: [],
        error: null,
      },
    ]

    const res = await request(app).get(
      '/api/reports/custom?report_type=queue&status=Called'
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.filters.status).toBe('Called')
    expect(createdBuilders[0].eq).toHaveBeenCalledWith('status', 'Called')
  })

  test('returns 400 for invalid report_type', async () => {
    const res = await request(app).get(
      '/api/reports/custom?report_type=unknown'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid report_type. Use appointments or queue',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 400 for invalid clinic id format', async () => {
    const res = await request(app).get(
      `/api/reports/custom?report_type=appointments&clinic_id=${invalidId}`
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'Invalid clinic ID format' })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 404 when selected clinic does not exist', async () => {
    scenario.maybeSingle.clinics = [
      {
        data: null,
        error: null,
      },
    ]

    const res = await request(app).get(
      `/api/reports/custom?report_type=appointments&clinic_id=${validClinicId}`
    )

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Clinic not found' })
    expect(createdBuilders).toHaveLength(1)
    expect(createdBuilders[0].table).toBe('clinics')
  })

  test('returns 400 for invalid date', async () => {
    const res = await request(app).get(
      '/api/reports/custom?report_type=queue&start_date=2026-02-31'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid start_date value. Use YYYY-MM-DD',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 400 when start_date is after end_date', async () => {
    const res = await request(app).get(
      '/api/reports/custom?report_type=queue&start_date=2026-05-12&end_date=2026-05-11'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'start_date must be before or equal to end_date',
    })
    expect(createdBuilders).toHaveLength(0)
  })

  test('returns 400 for invalid status for selected report type', async () => {
    const res = await request(app).get(
      '/api/reports/custom?report_type=queue&status=Completed'
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      error: 'Invalid status for queue report',
    })
    expect(createdBuilders).toHaveLength(0)
  })
})
