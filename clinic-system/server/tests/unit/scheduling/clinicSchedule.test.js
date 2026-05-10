const {
  generateDailySlots,
  getDefaultAppointmentDuration,
  getDefaultOperatingHours,
  normalizeAppointmentDuration,
  normalizeOperatingHours,
  resolveClinicSchedule,
} = require('../../../src/clinicSchedule')

function customOperatingHours(overrides = {}) {
  return {
    monday: { open: '09:10', close: '10:10' },
    tuesday: { open: '', close: '' },
    wednesday: { open: '', close: '' },
    thursday: { open: '', close: '' },
    friday: { open: '', close: '' },
    saturday: { open: '', close: '' },
    sunday: { open: '', close: '' },
    ...overrides,
  }
}

describe('clinicSchedule', () => {
  describe('default schedule values', () => {
    test('returns default operating hours', () => {
      const hours = getDefaultOperatingHours()

      expect(hours.monday).toEqual({ open: '07:30', close: '16:30' })
      expect(hours.friday).toEqual({ open: '07:30', close: '16:30' })
      expect(hours.saturday).toEqual({ open: '', close: '' })
      expect(hours.sunday).toEqual({ open: '', close: '' })
    })

    test('returns a fresh copy of default operating hours', () => {
      const first = getDefaultOperatingHours()
      const second = getDefaultOperatingHours()

      first.monday.open = '99:99'

      expect(second.monday.open).toBe('07:30')
    })

    test('returns default appointment duration', () => {
      expect(getDefaultAppointmentDuration()).toBe(15)
    })
  })

  describe('normalizeOperatingHours', () => {
    test('uses default operating hours when operating_hours is null or undefined', () => {
      expect(normalizeOperatingHours(null).monday).toEqual({
        open: '07:30',
        close: '16:30',
      })

      expect(normalizeOperatingHours(undefined).monday).toEqual({
        open: '07:30',
        close: '16:30',
      })
    })

    test('keeps provided operating hours when present', () => {
      const operatingHours = customOperatingHours()

      expect(normalizeOperatingHours(operatingHours)).toBe(operatingHours)
    })
  })

  describe('normalizeAppointmentDuration', () => {
    test('uses default appointment duration when duration is null or undefined', () => {
      expect(normalizeAppointmentDuration(null)).toBe(15)
      expect(normalizeAppointmentDuration(undefined)).toBe(15)
    })

    test('keeps provided appointment duration when present', () => {
      expect(normalizeAppointmentDuration(20)).toBe(20)
      expect(normalizeAppointmentDuration(0)).toBe(0)
    })
  })

  describe('resolveClinicSchedule', () => {
    test('resolves missing clinic row to default schedule values', () => {
      expect(resolveClinicSchedule()).toMatchObject({
        appointment_duration_minutes: 15,
        operating_hours: {
          monday: { open: '07:30', close: '16:30' },
        },
      })
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

    test('keeps clinic-specific schedule values when they are present', () => {
      const operating_hours = customOperatingHours()

      expect(
        resolveClinicSchedule({
          operating_hours,
          appointment_duration_minutes: 20,
        })
      ).toEqual({
        operating_hours,
        appointment_duration_minutes: 20,
      })
    })
  })

  describe('generateDailySlots', () => {
    test('generates default 15-minute weekday slots and stops before closing time', () => {
      const slots = generateDailySlots({
        date: '2026-04-20',
        operating_hours: null,
        appointment_duration_minutes: null,
      })

      expect(slots.slice(0, 4)).toEqual(['07:30', '07:45', '08:00', '08:15'])
      expect(slots.at(-1)).toBe('16:15')
      expect(slots).not.toContain('16:30')
    })

    test('generates slots from clinic-specific hours and duration', () => {
      const slots = generateDailySlots({
        date: '2026-04-20',
        operating_hours: {
          monday: { open: '09:10', close: '10:10' },
        },
        appointment_duration_minutes: 20,
      })

      expect(slots).toEqual(['09:10', '09:30', '09:50'])
    })

    test('returns empty list for closed default weekend days', () => {
      expect(
        generateDailySlots({
          date: '2026-04-25',
          operating_hours: null,
          appointment_duration_minutes: null,
        })
      ).toEqual([])
    })

    test('returns empty list when day is explicitly closed', () => {
      expect(
        generateDailySlots({
          date: '2026-04-20',
          operating_hours: {
            monday: { open: '08:00', close: '17:00', closed: true },
          },
          appointment_duration_minutes: 15,
        })
      ).toEqual([])
    })

    test('returns empty list when day hours are missing', () => {
      expect(
        generateDailySlots({
          date: '2026-04-20',
          operating_hours: {
            tuesday: { open: '08:00', close: '17:00' },
          },
          appointment_duration_minutes: 15,
        })
      ).toEqual([])
    })

    test('returns empty list when date is invalid', () => {
      expect(
        generateDailySlots({
          date: 'bad-date',
          operating_hours: null,
          appointment_duration_minutes: null,
        })
      ).toEqual([])
    })

    test('returns empty list when appointment duration is invalid', () => {
      expect(
        generateDailySlots({
          date: '2026-04-20',
          operating_hours: {
            monday: { open: '08:00', close: '17:00' },
          },
          appointment_duration_minutes: 0,
        })
      ).toEqual([])

      expect(
        generateDailySlots({
          date: '2026-04-20',
          operating_hours: {
            monday: { open: '08:00', close: '17:00' },
          },
          appointment_duration_minutes: 'bad-duration',
        })
      ).toEqual([])
    })

    test('returns empty list when opening or closing time is invalid', () => {
      expect(
        generateDailySlots({
          date: '2026-04-20',
          operating_hours: {
            monday: { open: 'bad-time', close: '17:00' },
          },
          appointment_duration_minutes: 15,
        })
      ).toEqual([])

      expect(
        generateDailySlots({
          date: '2026-04-20',
          operating_hours: {
            monday: { open: '17:00', close: '08:00' },
          },
          appointment_duration_minutes: 15,
        })
      ).toEqual([])
    })

    test('only creates slots that can finish before closing time', () => {
      const slots = generateDailySlots({
        date: '2026-04-20',
        operating_hours: {
          monday: { open: '09:00', close: '09:50' },
        },
        appointment_duration_minutes: 20,
      })

      expect(slots).toEqual(['09:00', '09:20'])
      expect(slots).not.toContain('09:40')
    })
  })
})