const DEFAULT_APPOINTMENT_DURATION_MINUTES = 15

const DEFAULT_OPERATING_HOURS = {
  monday: { open: '07:30', close: '16:30' },
  tuesday: { open: '07:30', close: '16:30' },
  wednesday: { open: '07:30', close: '16:30' },
  thursday: { open: '07:30', close: '16:30' },
  friday: { open: '07:30', close: '16:30' },
  saturday: { open: '', close: '' },
  sunday: { open: '', close: '' },
}

const WEEK_DAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

function cloneOperatingHours(operatingHours) {
  return Object.fromEntries(
    Object.entries(operatingHours).map(([day, hours]) => [
      day,
      { ...hours },
    ])
  )
}

function getDefaultOperatingHours() {
  return cloneOperatingHours(DEFAULT_OPERATING_HOURS)
}

function getDefaultAppointmentDuration() {
  return DEFAULT_APPOINTMENT_DURATION_MINUTES
}

function normalizeOperatingHours(operating_hours) {
  if (operating_hours == null) {
    return getDefaultOperatingHours()
  }

  return operating_hours
}

function normalizeAppointmentDuration(duration) {
  if (duration == null) {
    return getDefaultAppointmentDuration()
  }

  return duration
}

function resolveClinicSchedule(clinicRow) {
  const row = clinicRow || {}

  return {
    operating_hours: normalizeOperatingHours(row.operating_hours),
    appointment_duration_minutes: normalizeAppointmentDuration(
      row.appointment_duration_minutes
    ),
  }
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function getWeekdayName(date) {
  const parsedDate = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  return WEEK_DAYS[parsedDate.getDay()]
}

function isClosedDay(dayHours) {
  if (!dayHours || typeof dayHours !== 'object') {
    return true
  }

  return dayHours.closed === true || !dayHours.open || !dayHours.close
}

function generateDailySlots({
  date,
  operating_hours,
  appointment_duration_minutes,
}) {
  const normalizedHours = normalizeOperatingHours(operating_hours)
  const duration = normalizeAppointmentDuration(appointment_duration_minutes)
  const weekday = getWeekdayName(date)

  if (!weekday || !Number.isFinite(duration) || duration <= 0) {
    return []
  }

  const dayHours = normalizedHours[weekday]

  // Blank open/close values mean the clinic is closed on that day.
  if (isClosedDay(dayHours)) {
    return []
  }

  const openingMinutes = timeToMinutes(dayHours.open)
  const closingMinutes = timeToMinutes(dayHours.close)

  if (
    !Number.isFinite(openingMinutes) ||
    !Number.isFinite(closingMinutes) ||
    openingMinutes >= closingMinutes
  ) {
    return []
  }

  const slots = []

  // A slot starts only if the full appointment can finish before closing time.
  for (
    let currentMinutes = openingMinutes;
    currentMinutes + duration <= closingMinutes;
    currentMinutes += duration
  ) {
    slots.push(minutesToTime(currentMinutes))
  }

  return slots
}

module.exports = {
  getDefaultOperatingHours,
  getDefaultAppointmentDuration,
  normalizeOperatingHours,
  normalizeAppointmentDuration,
  resolveClinicSchedule,
  generateDailySlots,
}
