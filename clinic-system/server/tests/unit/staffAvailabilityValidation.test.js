const {
  isValidUuid,
  validateAvailabilityCreateInput,
  validateAvailabilityUpdateInput,
} = require('../../src/staffAvailabilityValidation')

const VALID_STAFF_ID = '0b0d9f9a-9a5e-47fe-92e0-7d1696e41464'
const VALID_AVAILABILITY_ID = '8a8d439e-6634-44df-be8e-f51b9e0ca87a'
const INVALID_UUID = 'not-a-uuid'

describe('staffAvailabilityValidation', () => {
  describe('isValidUuid', () => {
    it('returns true for valid UUID', () => {
      expect(isValidUuid(VALID_STAFF_ID)).toBe(true)
    })

    it('returns false for invalid UUID', () => {
      expect(isValidUuid(INVALID_UUID)).toBe(false)
    })

    it('returns false for missing UUID', () => {
      expect(isValidUuid()).toBe(false)
    })
  })

  describe('validateAvailabilityCreateInput', () => {
    it('accepts valid availability input', () => {
      const result = validateAvailabilityCreateInput({
        staffId: VALID_STAFF_ID,
        day_of_week: 1,
        start_time: '08:00',
        end_time: '16:00',
      })

      expect(result).toEqual({ valid: true })
    })

    it('rejects invalid staff ID', () => {
      const result = validateAvailabilityCreateInput({
        staffId: INVALID_UUID,
        day_of_week: 1,
        start_time: '08:00',
        end_time: '16:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid staff ID format',
      })
    })

    it('rejects missing day_of_week', () => {
      const result = validateAvailabilityCreateInput({
        staffId: VALID_STAFF_ID,
        start_time: '08:00',
        end_time: '16:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'day_of_week is required',
      })
    })

    it('accepts day_of_week value 0 as valid boundary', () => {
      const result = validateAvailabilityCreateInput({
        staffId: VALID_STAFF_ID,
        day_of_week: 0,
        start_time: '08:00',
        end_time: '16:00',
      })

      expect(result).toEqual({ valid: true })
    })

    it('accepts day_of_week value 6 as valid boundary', () => {
      const result = validateAvailabilityCreateInput({
        staffId: VALID_STAFF_ID,
        day_of_week: 6,
        start_time: '08:00',
        end_time: '16:00',
      })

      expect(result).toEqual({ valid: true })
    })

    it('rejects day_of_week below valid range', () => {
      const result = validateAvailabilityCreateInput({
        staffId: VALID_STAFF_ID,
        day_of_week: -1,
        start_time: '08:00',
        end_time: '16:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'day_of_week must be an integer between 0 and 6',
      })
    })

    it('rejects day_of_week above valid range', () => {
      const result = validateAvailabilityCreateInput({
        staffId: VALID_STAFF_ID,
        day_of_week: 7,
        start_time: '08:00',
        end_time: '16:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'day_of_week must be an integer between 0 and 6',
      })
    })

    it('rejects non-integer day_of_week', () => {
      const result = validateAvailabilityCreateInput({
        staffId: VALID_STAFF_ID,
        day_of_week: 1.5,
        start_time: '08:00',
        end_time: '16:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'day_of_week must be an integer between 0 and 6',
      })
    })

    it('rejects missing start_time', () => {
      const result = validateAvailabilityCreateInput({
        staffId: VALID_STAFF_ID,
        day_of_week: 1,
        end_time: '16:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'start_time and end_time are required',
      })
    })

    it('rejects missing end_time', () => {
      const result = validateAvailabilityCreateInput({
        staffId: VALID_STAFF_ID,
        day_of_week: 1,
        start_time: '08:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'start_time and end_time are required',
      })
    })

    it('rejects when start_time is after end_time', () => {
      const result = validateAvailabilityCreateInput({
        staffId: VALID_STAFF_ID,
        day_of_week: 1,
        start_time: '16:00',
        end_time: '08:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'start_time must be before end_time',
      })
    })

    it('rejects when start_time equals end_time', () => {
      const result = validateAvailabilityCreateInput({
        staffId: VALID_STAFF_ID,
        day_of_week: 1,
        start_time: '08:00',
        end_time: '08:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'start_time must be before end_time',
      })
    })
  })

  describe('validateAvailabilityUpdateInput', () => {
    it('accepts valid update input', () => {
      const result = validateAvailabilityUpdateInput({
        staffId: VALID_STAFF_ID,
        availabilityId: VALID_AVAILABILITY_ID,
        start_time: '09:00',
        end_time: '17:00',
      })

      expect(result).toEqual({ valid: true })
    })

    it('accepts update with only is_available field', () => {
      const result = validateAvailabilityUpdateInput({
        staffId: VALID_STAFF_ID,
        availabilityId: VALID_AVAILABILITY_ID,
        is_available: false,
      })

      expect(result).toEqual({ valid: true })
    })

    it('rejects invalid staff ID', () => {
      const result = validateAvailabilityUpdateInput({
        staffId: INVALID_UUID,
        availabilityId: VALID_AVAILABILITY_ID,
        start_time: '09:00',
        end_time: '17:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid ID format',
      })
    })

    it('rejects invalid availability ID', () => {
      const result = validateAvailabilityUpdateInput({
        staffId: VALID_STAFF_ID,
        availabilityId: INVALID_UUID,
        start_time: '09:00',
        end_time: '17:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid ID format',
      })
    })

    it('rejects update when no fields are provided', () => {
      const result = validateAvailabilityUpdateInput({
        staffId: VALID_STAFF_ID,
        availabilityId: VALID_AVAILABILITY_ID,
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'At least one field must be provided to update',
      })
    })

    it('rejects when update start_time is after end_time', () => {
      const result = validateAvailabilityUpdateInput({
        staffId: VALID_STAFF_ID,
        availabilityId: VALID_AVAILABILITY_ID,
        start_time: '17:00',
        end_time: '09:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'start_time must be before end_time',
      })
    })

    it('rejects when update start_time equals end_time', () => {
      const result = validateAvailabilityUpdateInput({
        staffId: VALID_STAFF_ID,
        availabilityId: VALID_AVAILABILITY_ID,
        start_time: '09:00',
        end_time: '09:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'start_time must be before end_time',
      })
    })
  })
})