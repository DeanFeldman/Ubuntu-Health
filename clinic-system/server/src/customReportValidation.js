const { APPOINTMENT_STATUSES } = require('./appointmentStatusValidation')

const CUSTOM_REPORT_TYPES = ['appointments', 'queue']
const QUEUE_REPORT_STATUSES = ['Waiting', 'In Consultation', 'Complete', 'Called']

function normalizeCustomReportType(reportType) {
  if (typeof reportType !== 'string') return null

  const normalized = reportType.trim().toLowerCase()
  return normalized || null
}

function validateCustomReportType(reportType) {
  const normalized = normalizeCustomReportType(reportType)

  if (!CUSTOM_REPORT_TYPES.includes(normalized)) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid report_type. Use appointments or queue',
    }
  }

  return {
    valid: true,
    reportType: normalized,
  }
}

function normalizeStatusFilter(status) {
  if (status === undefined || status === null || String(status).trim() === '') {
    return null
  }

  const normalized = String(status).trim()

  if (normalized.toLowerCase() === 'all') {
    return null
  }

  return normalized
}

function getAllowedStatusesForReportType(reportType) {
  if (reportType === 'appointments') return APPOINTMENT_STATUSES
  if (reportType === 'queue') return QUEUE_REPORT_STATUSES

  return []
}

function validateCustomReportStatus(reportType, status) {
  const normalizedStatus = normalizeStatusFilter(status)

  if (!normalizedStatus) {
    return {
      valid: true,
      status: null,
    }
  }

  const allowedStatuses = getAllowedStatusesForReportType(reportType)

  if (!allowedStatuses.includes(normalizedStatus)) {
    return {
      valid: false,
      status: 400,
      error: `Invalid status for ${reportType} report`,
    }
  }

  return {
    valid: true,
    status: normalizedStatus,
  }
}

module.exports = {
  CUSTOM_REPORT_TYPES,
  QUEUE_REPORT_STATUSES,
  normalizeCustomReportType,
  validateCustomReportType,
  normalizeStatusFilter,
  getAllowedStatusesForReportType,
  validateCustomReportStatus,
}
