const { resolveClinicSchedule } = require('./clinicSchedule')

function getClinicCloseTimeForDate(clinic, slotDatetime) {
  if (!clinic || !slotDatetime) return null

  const date = new Date(slotDatetime)

  if (Number.isNaN(date.getTime())) return null

  const dayName = date.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'Africa/Johannesburg',
  }).toLowerCase()

  const schedule = resolveClinicSchedule(clinic)
  const operatingHours = schedule.operating_hours || {}

  const dayHours =
    operatingHours[dayName] ||
    operatingHours[dayName.slice(0, 3)] ||
    null

  if (!dayHours) return null

  const close =
    dayHours.close ||
    dayHours.end ||
    dayHours.end_time ||
    dayHours.closing_time ||
    null

  if (!close) return null

  const slotDate = slotDatetime.slice(0, 10)
  const closeDateTime = new Date(`${slotDate}T${String(close).slice(0, 5)}:00`)

  if (Number.isNaN(closeDateTime.getTime())) return null

  // Dean's auto no-show rule:
  // an appointment becomes eligible for No-show after clinic close + 2 hours.
  closeDateTime.setHours(closeDateTime.getHours() + 2)

  return closeDateTime
}

function findMissedAppointmentIds({
  appointments = [],
  slotsById = {},
  clinicsById = {},
  clinic = null,
  now = new Date(),
} = {}) {
  return (appointments || [])
    .filter((appointment) => {
      const slotDatetime = slotsById[appointment.slot_id]?.slot_datetime
      const appointmentClinic = clinic || clinicsById[appointment.clinic_id]

      if (!slotDatetime || !appointmentClinic) return false

      const autoNoShowTime = getClinicCloseTimeForDate(
        appointmentClinic,
        slotDatetime
      )

      if (!autoNoShowTime) return false

      return now >= autoNoShowTime
    })
    .map((appointment) => appointment.id)
}

function buildAutoNoShowResponse(updatedAppointments = []) {
  const updatedCount = updatedAppointments.length

  if (updatedCount === 0) {
    return {
      message: 'No missed appointments found',
      updatedCount: 0,
      appointments: [],
    }
  }

  return {
    message: `${updatedCount} appointment(s) marked as No-show`,
    updatedCount,
    appointments: updatedAppointments,
  }
}

module.exports = {
  getClinicCloseTimeForDate,
  findMissedAppointmentIds,
  buildAutoNoShowResponse,
}