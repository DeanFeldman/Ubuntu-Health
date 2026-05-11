const SCHEDULED_APPOINTMENT_STATUSES = [
  'Confirmed',
  'Waiting',
  'Completed',
  'Cancelled',
  'No-show',
]

const COMPLETED_APPOINTMENT_STATUS = 'Completed'
const CANCELLED_APPOINTMENT_STATUS = 'Cancelled'
const NO_SHOW_APPOINTMENT_STATUS = 'No-show'

function normalizeStatus(status) {
  if (typeof status !== 'string') return null
  const normalized = status.trim()
  return normalized || null
}

function createEmptyMetrics() {
  return {
    scheduled_appointments: 0,
    completed_appointments: 0,
    cancelled_appointments: 0,
    no_show_appointments: 0,
    no_show_rate_percent: 0,
  }
}

function calculateNoShowRate(noShowAppointments, scheduledAppointments) {
  if (!scheduledAppointments) return 0

  return Number(((noShowAppointments / scheduledAppointments) * 100).toFixed(2))
}

function finalizeMetrics(metrics) {
  return {
    ...metrics,
    no_show_rate_percent: calculateNoShowRate(
      metrics.no_show_appointments,
      metrics.scheduled_appointments
    ),
  }
}

function addAppointmentToMetrics(metrics, appointment) {
  const status = normalizeStatus(appointment?.status)

  if (!SCHEDULED_APPOINTMENT_STATUSES.includes(status)) {
    return
  }

  metrics.scheduled_appointments += 1

  if (status === COMPLETED_APPOINTMENT_STATUS) {
    metrics.completed_appointments += 1
  }

  if (status === CANCELLED_APPOINTMENT_STATUS) {
    metrics.cancelled_appointments += 1
  }

  if (status === NO_SHOW_APPOINTMENT_STATUS) {
    metrics.no_show_appointments += 1
  }
}

function getClinicDetails(appointment) {
  const clinic = appointment?.clinic || appointment?.clinics || {}
  const clinicId = appointment?.clinic_id || clinic.id || null
  const clinicName =
    appointment?.clinic_name ||
    clinic.name ||
    'Unknown clinic'

  return {
    clinic_id: clinicId,
    clinic_name: clinicName,
  }
}

function calculateNoShowReport(appointments = []) {
  const safeAppointments = Array.isArray(appointments) ? appointments : []
  const summaryMetrics = createEmptyMetrics()
  const clinicMetricsById = {}

  for (const appointment of safeAppointments) {
    addAppointmentToMetrics(summaryMetrics, appointment)

    const status = normalizeStatus(appointment?.status)
    if (!SCHEDULED_APPOINTMENT_STATUSES.includes(status)) {
      continue
    }

    const clinicDetails = getClinicDetails(appointment)
    const clinicKey = clinicDetails.clinic_id || 'unknown'

    if (!clinicMetricsById[clinicKey]) {
      clinicMetricsById[clinicKey] = {
        ...clinicDetails,
        ...createEmptyMetrics(),
      }
    }

    addAppointmentToMetrics(clinicMetricsById[clinicKey], appointment)
  }

  return {
    summary: finalizeMetrics(summaryMetrics),
    by_clinic: Object.values(clinicMetricsById)
      .map((clinicMetrics) => finalizeMetrics(clinicMetrics))
      .sort((a, b) => (a.clinic_name || '').localeCompare(b.clinic_name || '')),
  }
}

module.exports = {
  SCHEDULED_APPOINTMENT_STATUSES,
  calculateNoShowRate,
  calculateNoShowReport,
}
