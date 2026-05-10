const {
  isValidUuid,
  getDayName,
  validateAvailabilityWithinClinicHours,
  validateAvailabilityCreateInput,
  validateAvailabilityUpdateInput,
} = require('../../../src/staffAvailabilityValidation')

const VALID_STAFF_ID = '0b0d9f9a-9a5e-47fe-92e0-7d1696e41464'
const VALID_AVAILABILITY_ID = '8a8d439e-6634-44df-be8e-f51b9e0ca87a'
const INVALID_UUID = 'not-a-uuid'

const validCreateInput = {
  staffId: VALID_STAFF_ID,
  day_of_week: 1,
  start_time: '08:00',
  end_time: '16:00',
}

const validUpdateInput = {
  staffId: VALID_STAFF_ID,
  availabilityId: VALID_AVAILABILITY_ID,
  start_time: '09:00',
  end_time: '17:00',
}

const clinicOperatingHours = {
  sunday: null,
  monday: { open: '08:00', close: '17:00' },
  tuesday: { open: '08:00', close: '17:00' },
  wednesday: { open: '08:00', close: '17:00' },
  thursday: { open: '08:00', close: '17:00' },
  friday: { open: '08:00', close: '17:00' },
  saturday: { open: '09:00', close: '12:00' },
}

describe('staffAvailabilityValidation', () => {
  describe('isValidUuid', () => {
    test('returns true for a valid UUID', () => {
      expect(isValidUuid(VALID_STAFF_ID)).toBe(true)
    })

    test('returns false for invalid or missing UUID values', () => {
      expect(isValidUuid(INVALID_UUID)).toBe(false)
      expect(isValidUuid('')).toBe(false)
      expect(isValidUuid()).toBe(false)
      expect(isValidUuid(null)).toBe(false)
    })
  })

  describe('getDayName', () => {
    test.each([
      [0, 'monday'],
      [1, 'tuesday'],
      [2, 'wednesday'],
      [3, 'thursday'],
      [4, 'friday'],
      [5, 'saturday'],
      [6, 'sunday'],
    ])('returns %s for day index %i', (dayIndex, expectedDayName) => {
      expect(getDayName(dayIndex)).toBe(expectedDayName)
    })

    test('returns undefined for out-of-range day indexes', () => {
      expect(getDayName(-1)).toBeUndefined()
      expect(getDayName(7)).toBeUndefined()
    })
  })

  describe('validateAvailabilityCreateInput', () => {
    test('accepts valid availability input', () => {
      expect(validateAvailabilityCreateInput(validCreateInput)).toEqual({
        valid: true,
      })
    })

    test.each([
      0,
      6,
    ])('accepts day_of_week boundary value %i', (day_of_week) => {
      expect(
        validateAvailabilityCreateInput({
          ...validCreateInput,
          day_of_week,
        })
      ).toEqual({
        valid: true,
      })
    })

    test('rejects invalid staff ID', () => {
      expect(
        validateAvailabilityCreateInput({
          ...validCreateInput,
          staffId: INVALID_UUID,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid staff ID format',
      })
    })

    test('rejects missing staff ID', () => {
      expect(
        validateAvailabilityCreateInput({
          ...validCreateInput,
          staffId: undefined,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid staff ID format',
      })
    })

    test.each([
      undefined,
      null,
    ])('rejects missing day_of_week value %s', (day_of_week) => {
      expect(
        validateAvailabilityCreateInput({
          ...validCreateInput,
          day_of_week,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'day_of_week is required',
      })
    })

    test.each([
      -1,
      7,
      1.5,
      '1',
    ])('rejects invalid day_of_week value %s', (day_of_week) => {
      expect(
        validateAvailabilityCreateInput({
          ...validCreateInput,
          day_of_week,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'day_of_week must be an integer between 0 and 6',
      })
    })

    test.each([
      ['start_time', undefined],
      ['end_time', undefined],
      ['start_time', ''],
      ['end_time', ''],
    ])('rejects missing %s', (field, value) => {
      expect(
        validateAvailabilityCreateInput({
          ...validCreateInput,
          [field]: value,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'start_time and end_time are required',
      })
    })

    test.each([
      ['16:00', '08:00'],
      ['08:00', '08:00'],
    ])('rejects invalid time range %s to %s', (start_time, end_time) => {
      expect(
        validateAvailabilityCreateInput({
          ...validCreateInput,
          start_time,
          end_time,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'start_time must be before end_time',
      })
    })
  })

  describe('validateAvailabilityUpdateInput', () => {
    test('accepts valid update input', () => {
      expect(validateAvailabilityUpdateInput(validUpdateInput)).toEqual({
        valid: true,
      })
    })

    test('accepts update with only is_available field', () => {
      expect(
        validateAvailabilityUpdateInput({
          staffId: VALID_STAFF_ID,
          availabilityId: VALID_AVAILABILITY_ID,
          is_available: false,
        })
      ).toEqual({
        valid: true,
      })
    })

    test('accepts update with only start_time field', () => {
      expect(
        validateAvailabilityUpdateInput({
          staffId: VALID_STAFF_ID,
          availabilityId: VALID_AVAILABILITY_ID,
          start_time: '09:00',
        })
      ).toEqual({
        valid: true,
      })
    })

    test('accepts update with only end_time field', () => {
      expect(
        validateAvailabilityUpdateInput({
          staffId: VALID_STAFF_ID,
          availabilityId: VALID_AVAILABILITY_ID,
          end_time: '17:00',
        })
      ).toEqual({
        valid: true,
      })
    })

    test.each([
      ['staffId', INVALID_UUID],
      ['availabilityId', INVALID_UUID],
      ['staffId', undefined],
      ['availabilityId', undefined],
    ])('rejects invalid %s', (field, value) => {
      expect(
        validateAvailabilityUpdateInput({
          ...validUpdateInput,
          [field]: value,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid ID format',
      })
    })

    test('rejects update when no fields are provided', () => {
      expect(
        validateAvailabilityUpdateInput({
          staffId: VALID_STAFF_ID,
          availabilityId: VALID_AVAILABILITY_ID,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'At least one field must be provided to update',
      })
    })

    test.each([
      ['17:00', '09:00'],
      ['09:00', '09:00'],
    ])('rejects invalid update time range %s to %s', (start_time, end_time) => {
      expect(
        validateAvailabilityUpdateInput({
          ...validUpdateInput,
          start_time,
          end_time,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'start_time must be before end_time',
      })
    })
  })

  describe('validateAvailabilityWithinClinicHours', () => {
    test('accepts availability within clinic operating hours', () => {
      expect(
        validateAvailabilityWithinClinicHours({
          day_of_week: 1,
          start_time: '09:00',
          end_time: '16:00',
          clinicOperatingHours,
        })
      ).toEqual({
        valid: true,
      })
    })

    test('accepts availability exactly matching clinic operating hours', () => {
      expect(
        validateAvailabilityWithinClinicHours({
          day_of_week: 1,
          start_time: '08:00',
          end_time: '17:00',
          clinicOperatingHours,
        })
      ).toEqual({
        valid: true,
      })
    })

    test('rejects availability before clinic opening time', () => {
      expect(
        validateAvailabilityWithinClinicHours({
          day_of_week: 1,
          start_time: '07:30',
          end_time: '16:00',
          clinicOperatingHours,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Availability must be within clinic operating hours',
      })
    })

    test('rejects availability after clinic closing time', () => {
      expect(
        validateAvailabilityWithinClinicHours({
          day_of_week: 1,
          start_time: '09:00',
          end_time: '18:00',
          clinicOperatingHours,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Availability must be within clinic operating hours',
      })
    })

    test('rejects availability when clinic is closed on the selected day', () => {
      expect(
        validateAvailabilityWithinClinicHours({
          day_of_week: 6,
          start_time: '09:00',
          end_time: '12:00',
          clinicOperatingHours,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Clinic is closed on this day',
      })
    })

    test('rejects availability when clinic hours are missing for the selected day', () => {
      expect(
        validateAvailabilityWithinClinicHours({
          day_of_week: 2,
          start_time: '09:00',
          end_time: '12:00',
          clinicOperatingHours: {
            monday: { open: '08:00', close: '17:00' },
          },
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Clinic is closed on this day',
      })
    })

    test('rejects availability when clinic hours have missing open or close time', () => {
      expect(
        validateAvailabilityWithinClinicHours({
          day_of_week: 1,
          start_time: '09:00',
          end_time: '12:00',
          clinicOperatingHours: {
            tuesday: { open: '08:00', close: '' },
          },
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Clinic is closed on this day',
      })
    })
  })
})