const {
  SCHEDULED_APPOINTMENT_STATUSES,
  calculateNoShowRate,
  calculateNoShowReport,
} = require('../../../src/noShowReportCalculation')

const clinicId = '00000000-0000-0000-0000-000000000001'
const secondClinicId = '00000000-0000-0000-0000-000000000002'

function appointment(overrides = {}) {
  return {
    id: 'appointment-1',
    clinic_id: clinicId,
    clinic_name: 'Ubuntu Clinic',
    status: 'Confirmed',
    ...overrides,
  }
}

describe('noShowReportCalculation', () => {
  test('defines statuses that count toward scheduled appointments', () => {
    expect(SCHEDULED_APPOINTMENT_STATUSES).toEqual([
      'Confirmed',
      'Waiting',
      'Completed',
      'Cancelled',
      'No-show',
    ])
  })

  test('empty appointment list returns all zero values and zero percent rate', () => {
    expect(calculateNoShowReport([])).toEqual({
      summary: {
        scheduled_appointments: 0,
        completed_appointments: 0,
        cancelled_appointments: 0,
        no_show_appointments: 0,
        no_show_rate_percent: 0,
      },
      by_clinic: [],
    })
  })

  test('mixed statuses are counted correctly', () => {
    const result = calculateNoShowReport([
      appointment({ id: 'confirmed', status: 'Confirmed' }),
      appointment({ id: 'waiting', status: 'Waiting' }),
      appointment({ id: 'completed-1', status: 'Completed' }),
      appointment({ id: 'completed-2', status: 'Completed' }),
      appointment({ id: 'cancelled', status: 'Cancelled' }),
      appointment({ id: 'no-show', status: 'No-show' }),
    ])

    expect(result.summary).toEqual({
      scheduled_appointments: 6,
      completed_appointments: 2,
      cancelled_appointments: 1,
      no_show_appointments: 1,
      no_show_rate_percent: 16.67,
    })
  })

  test('Confirmed and Waiting count only toward scheduled total', () => {
    const result = calculateNoShowReport([
      appointment({ id: 'confirmed', status: 'Confirmed' }),
      appointment({ id: 'waiting', status: 'Waiting' }),
    ])

    expect(result.summary).toEqual({
      scheduled_appointments: 2,
      completed_appointments: 0,
      cancelled_appointments: 0,
      no_show_appointments: 0,
      no_show_rate_percent: 0,
    })
  })

  test('completed count is correct', () => {
    const result = calculateNoShowReport([
      appointment({ id: 'completed-1', status: 'Completed' }),
      appointment({ id: 'completed-2', status: 'Completed' }),
      appointment({ id: 'confirmed', status: 'Confirmed' }),
    ])

    expect(result.summary.completed_appointments).toBe(2)
  })

  test('cancelled count is correct', () => {
    const result = calculateNoShowReport([
      appointment({ id: 'cancelled-1', status: 'Cancelled' }),
      appointment({ id: 'cancelled-2', status: 'Cancelled' }),
      appointment({ id: 'waiting', status: 'Waiting' }),
    ])

    expect(result.summary.cancelled_appointments).toBe(2)
  })

  test('no-show count is correct', () => {
    const result = calculateNoShowReport([
      appointment({ id: 'no-show-1', status: 'No-show' }),
      appointment({ id: 'no-show-2', status: 'No-show' }),
      appointment({ id: 'completed', status: 'Completed' }),
    ])

    expect(result.summary.no_show_appointments).toBe(2)
  })

  test('no-show rate is calculated and rounded to two decimal places', () => {
    expect(calculateNoShowRate(1, 3)).toBe(33.33)
    expect(calculateNoShowRate(2, 4)).toBe(50)
  })

  test('no-show rate returns zero when there are no scheduled appointments', () => {
    expect(calculateNoShowRate(1, 0)).toBe(0)

    const result = calculateNoShowReport([
      appointment({ id: 'unknown', status: 'Unknown' }),
    ])

    expect(result.summary.no_show_rate_percent).toBe(0)
  })

  test('unknown status does not break calculation or affect counts', () => {
    const result = calculateNoShowReport([
      appointment({ id: 'unknown', status: 'Unknown' }),
      appointment({ id: 'missing-status', status: null }),
      appointment({ id: 'no-show', status: 'No-show' }),
    ])

    expect(result.summary).toEqual({
      scheduled_appointments: 1,
      completed_appointments: 0,
      cancelled_appointments: 0,
      no_show_appointments: 1,
      no_show_rate_percent: 100,
    })
  })

  test('grouping by clinic works when clinic details are available', () => {
    const result = calculateNoShowReport([
      appointment({
        id: 'ubuntu-confirmed',
        clinic_id: clinicId,
        clinic_name: 'Ubuntu Clinic',
        status: 'Confirmed',
      }),
      appointment({
        id: 'ubuntu-no-show',
        clinic_id: clinicId,
        clinic_name: 'Ubuntu Clinic',
        status: 'No-show',
      }),
      appointment({
        id: 'hope-completed',
        clinic_id: secondClinicId,
        clinic_name: 'Hope Clinic',
        status: 'Completed',
      }),
      appointment({
        id: 'hope-cancelled',
        clinic_id: secondClinicId,
        clinic_name: 'Hope Clinic',
        status: 'Cancelled',
      }),
    ])

    expect(result.by_clinic).toEqual([
      {
        clinic_id: secondClinicId,
        clinic_name: 'Hope Clinic',
        scheduled_appointments: 2,
        completed_appointments: 1,
        cancelled_appointments: 1,
        no_show_appointments: 0,
        no_show_rate_percent: 0,
      },
      {
        clinic_id: clinicId,
        clinic_name: 'Ubuntu Clinic',
        scheduled_appointments: 2,
        completed_appointments: 0,
        cancelled_appointments: 0,
        no_show_appointments: 1,
        no_show_rate_percent: 50,
      },
    ])
  })

  test('missing clinic details do not crash grouping', () => {
    const result = calculateNoShowReport([
      {
        id: 'appointment-without-clinic',
        status: 'No-show',
      },
    ])

    expect(result.by_clinic).toEqual([
      {
        clinic_id: null,
        clinic_name: 'Unknown clinic',
        scheduled_appointments: 1,
        completed_appointments: 0,
        cancelled_appointments: 0,
        no_show_appointments: 1,
        no_show_rate_percent: 100,
      },
    ])
  })

  test('reads clinic details from joined clinic objects', () => {
    const result = calculateNoShowReport([
      {
        id: 'joined-clinic-appointment',
        status: 'Completed',
        clinics: {
          id: secondClinicId,
          name: 'Hope Clinic',
        },
      },
    ])

    expect(result.by_clinic).toEqual([
      {
        clinic_id: secondClinicId,
        clinic_name: 'Hope Clinic',
        scheduled_appointments: 1,
        completed_appointments: 1,
        cancelled_appointments: 0,
        no_show_appointments: 0,
        no_show_rate_percent: 0,
      },
    ])
  })
})
