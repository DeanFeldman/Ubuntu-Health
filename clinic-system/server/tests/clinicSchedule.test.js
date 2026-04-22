const {
  generateDailySlots,
  getDefaultAppointmentDuration,
  normalizeAppointmentDuration,
  normalizeOperatingHours,
  resolveClinicSchedule,
} = require('../src/clinicSchedule')

describe('clinicSchedule', () => {
  test('uses default operating hours when operating_hours is null', () => {
    const hours = normalizeOperatingHours(null)

    expect(hours.monday).toEqual({ open: '07:30', close: '16:30' })
    expect(hours.friday).toEqual({ open: '07:30', close: '16:30' })
    expect(hours.saturday).toEqual({ open: '', close: '' })
    expect(hours.sunday).toEqual({ open: '', close: '' })
  })

  test('uses default appointment duration when duration is null', () => {
    expect(getDefaultAppointmentDuration()).toBe(15)
    expect(normalizeAppointmentDuration(null)).toBe(15)
    expect(normalizeAppointmentDuration(undefined)).toBe(15)
  })

  test('resolves nullable clinic schedule fields to effective values', () => {
    expect(
      resolveClinicSchedule({
        operating_hours: null,
        appointment_duration_minutes: null,
      })
    ).toMatchObject({
      appointment_duration_minutes: 15,
      operating_hours: {
        monday: { open: '07:30', close: '16:30' },
      },
    })
  })

  test('generates 15-minute slots and stops before closing time', () => {
    const slots = generateDailySlots({
      date: '2026-04-20',
      operating_hours: null,
      appointment_duration_minutes: null,
    })

    expect(slots.slice(0, 4)).toEqual(['07:30', '07:45', '08:00', '08:15'])
    expect(slots.at(-1)).toBe('16:15')
    expect(slots).not.toContain('16:30')
  })

  test('returns an empty list for closed days', () => {
    expect(
      generateDailySlots({
        date: '2026-04-25',
        operating_hours: null,
        appointment_duration_minutes: null,
      })
    ).toEqual([])
  })
})
