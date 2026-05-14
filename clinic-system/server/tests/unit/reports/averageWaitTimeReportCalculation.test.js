const {
  buildDateRangeLabel,
  roundAverage,
  getWaitMinutes,
  getHourInSouthAfrica,
  getTimeOfDay,
  buildAverageWaitTimeReport,
} = require('../../../src/averageWaitTimeReportCalculation')

const clinicId = '11111111-1111-1111-1111-111111111111'
const secondClinicId = '22222222-2222-2222-2222-222222222222'

function queueEntry(overrides = {}) {
  return {
    id: 'queue-entry-1',
    clinic_id: clinicId,
    joined_at: '2026-05-11T06:00:00.000Z',
    called_at: '2026-05-11T06:30:00.000Z',
    ...overrides,
  }
}

describe('averageWaitTimeReportCalculation', () => {
  describe('buildDateRangeLabel', () => {
    test('returns full date range label when start and end dates exist', () => {
      expect(buildDateRangeLabel('2026-05-01', '2026-05-11')).toBe(
        '2026-05-01 to 2026-05-11'
      )
    })

    test('returns start date label when only start date exists', () => {
      expect(buildDateRangeLabel('2026-05-01', null)).toBe('From 2026-05-01')
    })

    test('returns end date label when only end date exists', () => {
      expect(buildDateRangeLabel(null, '2026-05-11')).toBe('Up to 2026-05-11')
    })

    test('returns all time label when no dates exist', () => {
      expect(buildDateRangeLabel(null, null)).toBe('All time')
    })
  })

  describe('roundAverage', () => {
    test('calculates rounded average to two decimal places', () => {
      expect(roundAverage(100, 3)).toBe(33.33)
    })

    test('returns null when count is zero', () => {
      expect(roundAverage(100, 0)).toBeNull()
    })
  })

  describe('getWaitMinutes', () => {
    test('calculates wait time in minutes from joined_at to called_at', () => {
      expect(
        getWaitMinutes(
          queueEntry({
            joined_at: '2026-05-11T06:00:00.000Z',
            called_at: '2026-05-11T06:45:00.000Z',
          })
        )
      ).toBe(45)
    })

    test('returns null when joined_at is missing', () => {
      expect(
        getWaitMinutes(
          queueEntry({
            joined_at: null,
            called_at: '2026-05-11T06:45:00.000Z',
          })
        )
      ).toBeNull()
    })

    test('returns null when called_at is missing', () => {
      expect(
        getWaitMinutes(
          queueEntry({
            joined_at: '2026-05-11T06:00:00.000Z',
            called_at: null,
          })
        )
      ).toBeNull()
    })

    test('returns null when timestamps are invalid', () => {
      expect(
        getWaitMinutes(
          queueEntry({
            joined_at: 'not-a-date',
            called_at: '2026-05-11T06:45:00.000Z',
          })
        )
      ).toBeNull()
    })

    test('returns null when called_at is before joined_at', () => {
      expect(
        getWaitMinutes(
          queueEntry({
            joined_at: '2026-05-11T07:00:00.000Z',
            called_at: '2026-05-11T06:45:00.000Z',
          })
        )
      ).toBeNull()
    })
  })

  describe('getHourInSouthAfrica', () => {
    test('returns the hour in South African time', () => {
      expect(getHourInSouthAfrica('2026-05-11T06:00:00.000Z')).toBe(8)
    })

    test('returns null for invalid date values', () => {
      expect(getHourInSouthAfrica('not-a-date')).toBeNull()
    })
  })

  describe('getTimeOfDay', () => {
    test('classifies morning queue records', () => {
      expect(getTimeOfDay('2026-05-11T06:00:00.000Z')).toBe('Morning')
    })

    test('classifies afternoon queue records', () => {
      expect(getTimeOfDay('2026-05-11T11:00:00.000Z')).toBe('Afternoon')
    })

    test('classifies evening queue records', () => {
      expect(getTimeOfDay('2026-05-11T15:00:00.000Z')).toBe('Evening')
    })

    test('classifies night queue records', () => {
      expect(getTimeOfDay('2026-05-11T21:00:00.000Z')).toBe('Night')
    })

    test('returns null for invalid date values', () => {
      expect(getTimeOfDay('not-a-date')).toBeNull()
    })
  })

  describe('buildAverageWaitTimeReport', () => {
    test('calculates overall average wait time from valid queue records', () => {
      const report = buildAverageWaitTimeReport({
        entries: [
          queueEntry({
            id: 'queue-1',
            joined_at: '2026-05-11T06:00:00.000Z',
            called_at: '2026-05-11T06:30:00.000Z',
          }),
          queueEntry({
            id: 'queue-2',
            joined_at: '2026-05-11T07:00:00.000Z',
            called_at: '2026-05-11T08:00:00.000Z',
          }),
        ],
        clinicsById: {
          [clinicId]: { id: clinicId, name: 'Ubuntu Clinic' },
        },
        selectedClinic: null,
        filters: {
          clinicId: null,
          startDate: null,
          endDate: null,
        },
      })

      expect(report.summary).toEqual({
        overall_average_wait_time_minutes: 45,
        queue_records_used: 2,
      })
    })

    test('ignores records with missing or invalid timestamps', () => {
      const report = buildAverageWaitTimeReport({
        entries: [
          queueEntry({
            id: 'valid-record',
            joined_at: '2026-05-11T06:00:00.000Z',
            called_at: '2026-05-11T06:30:00.000Z',
          }),
          queueEntry({
            id: 'missing-called-at',
            called_at: null,
          }),
          queueEntry({
            id: 'invalid-date',
            joined_at: 'bad-date',
            called_at: '2026-05-11T06:30:00.000Z',
          }),
          queueEntry({
            id: 'negative-wait',
            joined_at: '2026-05-11T07:00:00.000Z',
            called_at: '2026-05-11T06:30:00.000Z',
          }),
        ],
        clinicsById: {
          [clinicId]: { id: clinicId, name: 'Ubuntu Clinic' },
        },
        selectedClinic: null,
        filters: {},
      })

      expect(report.summary).toEqual({
        overall_average_wait_time_minutes: 30,
        queue_records_used: 1,
      })
    })

    test('calculates average wait time by clinic', () => {
      const report = buildAverageWaitTimeReport({
        entries: [
          queueEntry({
            id: 'clinic-1-record-1',
            clinic_id: clinicId,
            joined_at: '2026-05-11T06:00:00.000Z',
            called_at: '2026-05-11T06:30:00.000Z',
          }),
          queueEntry({
            id: 'clinic-1-record-2',
            clinic_id: clinicId,
            joined_at: '2026-05-11T07:00:00.000Z',
            called_at: '2026-05-11T08:00:00.000Z',
          }),
          queueEntry({
            id: 'clinic-2-record-1',
            clinic_id: secondClinicId,
            joined_at: '2026-05-11T08:00:00.000Z',
            called_at: '2026-05-11T08:15:00.000Z',
          }),
        ],
        clinicsById: {
          [clinicId]: { id: clinicId, name: 'Ubuntu Clinic' },
          [secondClinicId]: { id: secondClinicId, name: 'Hope Clinic' },
        },
        selectedClinic: null,
        filters: {},
      })

      expect(report.by_clinic).toEqual([
        {
          clinic_id: secondClinicId,
          clinic_name: 'Hope Clinic',
          average_wait_time_minutes: 15,
          queue_records_used: 1,
        },
        {
          clinic_id: clinicId,
          clinic_name: 'Ubuntu Clinic',
          average_wait_time_minutes: 45,
          queue_records_used: 2,
        },
      ])
    })

    test('calculates average wait time by time of day', () => {
      const report = buildAverageWaitTimeReport({
        entries: [
          queueEntry({
            id: 'morning-record',
            joined_at: '2026-05-11T06:00:00.000Z',
            called_at: '2026-05-11T06:30:00.000Z',
          }),
          queueEntry({
            id: 'afternoon-record',
            joined_at: '2026-05-11T11:00:00.000Z',
            called_at: '2026-05-11T11:20:00.000Z',
          }),
          queueEntry({
            id: 'evening-record',
            joined_at: '2026-05-11T15:00:00.000Z',
            called_at: '2026-05-11T15:10:00.000Z',
          }),
          queueEntry({
            id: 'night-record',
            joined_at: '2026-05-11T21:00:00.000Z',
            called_at: '2026-05-11T21:05:00.000Z',
          }),
        ],
        clinicsById: {
          [clinicId]: { id: clinicId, name: 'Ubuntu Clinic' },
        },
        selectedClinic: null,
        filters: {},
      })

      expect(report.by_time_of_day).toEqual([
        {
          time_of_day: 'Morning',
          average_wait_time_minutes: 30,
          queue_records_used: 1,
        },
        {
          time_of_day: 'Afternoon',
          average_wait_time_minutes: 20,
          queue_records_used: 1,
        },
        {
          time_of_day: 'Evening',
          average_wait_time_minutes: 10,
          queue_records_used: 1,
        },
        {
          time_of_day: 'Night',
          average_wait_time_minutes: 5,
          queue_records_used: 1,
        },
      ])
    })

    test('handles zero valid queue records safely', () => {
      const report = buildAverageWaitTimeReport({
        entries: [],
        clinicsById: {},
        selectedClinic: null,
        filters: {},
      })

      expect(report.summary).toEqual({
        overall_average_wait_time_minutes: null,
        queue_records_used: 0,
      })

      expect(report.by_clinic).toEqual([])
      expect(report.by_time_of_day).toEqual([
        {
          time_of_day: 'Morning',
          average_wait_time_minutes: null,
          queue_records_used: 0,
        },
        {
          time_of_day: 'Afternoon',
          average_wait_time_minutes: null,
          queue_records_used: 0,
        },
        {
          time_of_day: 'Evening',
          average_wait_time_minutes: null,
          queue_records_used: 0,
        },
        {
          time_of_day: 'Night',
          average_wait_time_minutes: null,
          queue_records_used: 0,
        },
      ])
    })

    test('includes selected clinic with zero records when clinic filter is selected', () => {
      const report = buildAverageWaitTimeReport({
        entries: [],
        clinicsById: {
          [clinicId]: { id: clinicId, name: 'Ubuntu Clinic' },
        },
        selectedClinic: {
          id: clinicId,
          name: 'Ubuntu Clinic',
        },
        filters: {
          clinicId,
          startDate: '2026-05-01',
          endDate: '2026-05-11',
        },
      })

      expect(report.filters).toEqual({
        clinic_id: clinicId,
        clinic_name: 'Ubuntu Clinic',
        start_date: '2026-05-01',
        end_date: '2026-05-11',
        date_range_label: '2026-05-01 to 2026-05-11',
      })

      expect(report.by_clinic).toEqual([
        {
          clinic_id: clinicId,
          clinic_name: 'Ubuntu Clinic',
          average_wait_time_minutes: null,
          queue_records_used: 0,
        },
      ])
    })

    test('uses unknown clinic when clinic details are missing', () => {
      const report = buildAverageWaitTimeReport({
        entries: [
          queueEntry({
            id: 'unknown-clinic-record',
            clinic_id: 'missing-clinic',
          }),
        ],
        clinicsById: {},
        selectedClinic: null,
        filters: {},
      })

      expect(report.by_clinic).toEqual([
        {
          clinic_id: 'missing-clinic',
          clinic_name: 'Unknown clinic',
          average_wait_time_minutes: 30,
          queue_records_used: 1,
        },
      ])
    })

    test('handles non-array entries safely', () => {
      const report = buildAverageWaitTimeReport({
        entries: null,
        clinicsById: {},
        selectedClinic: null,
        filters: {},
      })

      expect(report.summary).toEqual({
        overall_average_wait_time_minutes: null,
        queue_records_used: 0,
      })

      expect(report.by_clinic).toEqual([])
    })

    test('handles missing options safely', () => {
      const report = buildAverageWaitTimeReport({
        entries: [queueEntry()],
      })

      expect(report.filters).toEqual({
        clinic_id: null,
        clinic_name: 'All clinics',
        start_date: null,
        end_date: null,
        date_range_label: 'All time',
      })

      expect(report.summary).toEqual({
        overall_average_wait_time_minutes: 30,
        queue_records_used: 1,
      })
    })
  })
})