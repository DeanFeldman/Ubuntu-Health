const {
  CUSTOM_REPORT_TYPES,
  QUEUE_REPORT_STATUSES,
  normalizeCustomReportType,
  validateCustomReportType,
  normalizeStatusFilter,
  getAllowedStatusesForReportType,
  validateCustomReportStatus,
} = require('../../../src/customReportValidation')

const { APPOINTMENT_STATUSES } = require('../../../src/appointmentStatusValidation')

describe('customReportValidation', () => {
  describe('CUSTOM_REPORT_TYPES', () => {
    test('contains the supported custom report types', () => {
      expect(CUSTOM_REPORT_TYPES).toEqual(['appointments', 'queue'])
    })
  })

  describe('QUEUE_REPORT_STATUSES', () => {
    test('contains the supported queue report statuses', () => {
      expect(QUEUE_REPORT_STATUSES).toEqual([
        'Waiting',
        'In Consultation',
        'Complete',
        'Called',
      ])
    })
  })

  describe('normalizeCustomReportType', () => {
    test('normalizes report type by trimming and lowercasing', () => {
      expect(normalizeCustomReportType(' Appointments ')).toBe('appointments')
      expect(normalizeCustomReportType(' QUEUE ')).toBe('queue')
    })

    test('returns null for empty strings after trimming', () => {
      expect(normalizeCustomReportType('   ')).toBeNull()
    })

    test('returns null for non-string values', () => {
      expect(normalizeCustomReportType(null)).toBeNull()
      expect(normalizeCustomReportType(undefined)).toBeNull()
      expect(normalizeCustomReportType(123)).toBeNull()
      expect(normalizeCustomReportType({})).toBeNull()
    })
  })

  describe('validateCustomReportType', () => {
    test('accepts appointments report type', () => {
      expect(validateCustomReportType('appointments')).toEqual({
        valid: true,
        reportType: 'appointments',
      })
    })

    test('accepts queue report type', () => {
      expect(validateCustomReportType('queue')).toEqual({
        valid: true,
        reportType: 'queue',
      })
    })

    test('accepts report type with whitespace and different casing', () => {
      expect(validateCustomReportType(' Appointments ')).toEqual({
        valid: true,
        reportType: 'appointments',
      })

      expect(validateCustomReportType(' QUEUE ')).toEqual({
        valid: true,
        reportType: 'queue',
      })
    })

    test('rejects invalid report type', () => {
      expect(validateCustomReportType('patients')).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid report_type. Use appointments or queue',
      })
    })

    test('rejects missing or blank report type', () => {
      expect(validateCustomReportType(undefined)).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid report_type. Use appointments or queue',
      })

      expect(validateCustomReportType('   ')).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid report_type. Use appointments or queue',
      })
    })
  })

  describe('normalizeStatusFilter', () => {
    test('returns null when status is missing', () => {
      expect(normalizeStatusFilter(undefined)).toBeNull()
      expect(normalizeStatusFilter(null)).toBeNull()
    })

    test('returns null when status is blank', () => {
      expect(normalizeStatusFilter('')).toBeNull()
      expect(normalizeStatusFilter('   ')).toBeNull()
    })

    test('returns null when status is all regardless of casing', () => {
      expect(normalizeStatusFilter('all')).toBeNull()
      expect(normalizeStatusFilter('ALL')).toBeNull()
      expect(normalizeStatusFilter(' All ')).toBeNull()
    })

    test('trims valid status values', () => {
      expect(normalizeStatusFilter(' Waiting ')).toBe('Waiting')
      expect(normalizeStatusFilter(' Completed ')).toBe('Completed')
    })

    test('converts non-null status values to strings before trimming', () => {
      expect(normalizeStatusFilter(123)).toBe('123')
      expect(normalizeStatusFilter(true)).toBe('true')
    })
  })

  describe('getAllowedStatusesForReportType', () => {
    test('returns appointment statuses for appointment reports', () => {
      expect(getAllowedStatusesForReportType('appointments')).toEqual(
        APPOINTMENT_STATUSES
      )
    })

    test('returns queue statuses for queue reports', () => {
      expect(getAllowedStatusesForReportType('queue')).toEqual(
        QUEUE_REPORT_STATUSES
      )
    })

    test('returns an empty list for unknown report types', () => {
      expect(getAllowedStatusesForReportType('invalid')).toEqual([])
      expect(getAllowedStatusesForReportType(null)).toEqual([])
    })
  })

  describe('validateCustomReportStatus', () => {
    test('accepts missing appointment status filter as all statuses', () => {
      expect(validateCustomReportStatus('appointments', undefined)).toEqual({
        valid: true,
        status: null,
      })

      expect(validateCustomReportStatus('appointments', 'all')).toEqual({
        valid: true,
        status: null,
      })
    })

    test('accepts valid appointment status filter', () => {
      expect(validateCustomReportStatus('appointments', 'Completed')).toEqual({
        valid: true,
        status: 'Completed',
      })
    })

    test('accepts trimmed appointment status filter', () => {
      expect(validateCustomReportStatus('appointments', ' Completed ')).toEqual({
        valid: true,
        status: 'Completed',
      })
    })

    test('rejects invalid appointment status filter', () => {
        expect(validateCustomReportStatus('appointments', 'Invalid Status')).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid status for appointments report',
    })
    })
    test('accepts Waiting as a valid appointment status filter', () => {
        expect(validateCustomReportStatus('appointments', 'Waiting')).toEqual({
        valid: true,
        status: 'Waiting',
        })
    })

    test('accepts missing queue status filter as all statuses', () => {
      expect(validateCustomReportStatus('queue', undefined)).toEqual({
        valid: true,
        status: null,
      })

      expect(validateCustomReportStatus('queue', 'ALL')).toEqual({
        valid: true,
        status: null,
      })
    })

    test('accepts valid queue status filter', () => {
      expect(validateCustomReportStatus('queue', 'Waiting')).toEqual({
        valid: true,
        status: 'Waiting',
      })

      expect(validateCustomReportStatus('queue', 'In Consultation')).toEqual({
        valid: true,
        status: 'In Consultation',
      })

      expect(validateCustomReportStatus('queue', 'Complete')).toEqual({
        valid: true,
        status: 'Complete',
      })

      expect(validateCustomReportStatus('queue', 'Called')).toEqual({
        valid: true,
        status: 'Called',
      })
    })

    test('accepts trimmed queue status filter', () => {
      expect(validateCustomReportStatus('queue', ' Waiting ')).toEqual({
        valid: true,
        status: 'Waiting',
      })
    })

    test('rejects invalid queue status filter', () => {
      expect(validateCustomReportStatus('queue', 'Completed')).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid status for queue report',
      })
    })

    test('rejects status for unknown report type', () => {
      expect(validateCustomReportStatus('invalid', 'Completed')).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid status for invalid report',
      })
    })
  })
})