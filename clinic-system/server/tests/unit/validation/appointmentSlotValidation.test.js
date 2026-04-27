const {
  isValidUuid,
  isValidDateFormat,
  isPastDate,
  validateSlotRetrievalInput,
} = require('../../../src/appointmentSlotValidation')

const VALID_UUID = '0b0d9f9a-9a5e-47fe-92e0-7d1696e41464'
const INVALID_UUID = 'not-a-uuid'

function getFutureDate() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().split('T')[0]
}

function getPastDate() {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  return date.toISOString().split('T')[0]
}

describe('appointmentSlotValidation', () => {
  describe('isValidUuid', () => {
    it('returns true for a valid UUID', () => {
      expect(isValidUuid(VALID_UUID)).toBe(true)
    })

    it('returns false for an invalid UUID', () => {
      expect(isValidUuid(INVALID_UUID)).toBe(false)
    })

    it('returns false for missing UUID', () => {
      expect(isValidUuid()).toBe(false)
    })
  })

  describe('isValidDateFormat', () => {
    it('returns true for valid YYYY-MM-DD date', () => {
      expect(isValidDateFormat('2099-05-10')).toBe(true)
    })

    it('returns false for missing date', () => {
      expect(isValidDateFormat()).toBe(false)
    })

    it('returns false for wrong date format', () => {
      expect(isValidDateFormat('10-05-2099')).toBe(false)
    })

    it('returns false for invalid date text', () => {
      expect(isValidDateFormat('not-a-date')).toBe(false)
    })
  })

  describe('isPastDate', () => {
    it('returns true for a past date', () => {
      expect(isPastDate(getPastDate())).toBe(true)
    })

    it('returns false for a future date', () => {
      expect(isPastDate(getFutureDate())).toBe(false)
    })
  })

  describe('validateSlotRetrievalInput', () => {
    it('rejects missing clinic_id', () => {
      const result = validateSlotRetrievalInput({
        date: getFutureDate(),
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'clinic_id is required',
      })
    })

    it('rejects missing date', () => {
      const result = validateSlotRetrievalInput({
        clinic_id: VALID_UUID,
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'date is required',
      })
    })

    it('rejects invalid clinic_id format', () => {
      const result = validateSlotRetrievalInput({
        clinic_id: INVALID_UUID,
        date: getFutureDate(),
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid clinic ID format',
      })
    })

    it('rejects invalid date format', () => {
      const result = validateSlotRetrievalInput({
        clinic_id: VALID_UUID,
        date: '10-05-2099',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid date format',
      })
    })

    it('rejects past dates', () => {
      const result = validateSlotRetrievalInput({
        clinic_id: VALID_UUID,
        date: getPastDate(),
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Past dates cannot be used for slot retrieval',
      })
    })

    it('accepts valid clinic_id and future date', () => {
      const result = validateSlotRetrievalInput({
        clinic_id: VALID_UUID,
        date: getFutureDate(),
      })

      expect(result).toEqual({ valid: true })
    })
  })
  const {
  sanitizeGeneratedSlots,
} = require('../../../src/appointmentSlotValidation')

describe('sanitizeGeneratedSlots', () => {
  it('removes invalid slot formats', () => {
    expect(sanitizeGeneratedSlots(['09:00', 'bad', '25:99'], '2099-05-10'))
      .toEqual(['09:00'])
  })

  it('removes duplicate slots and sorts valid slots', () => {
    expect(sanitizeGeneratedSlots(['10:00', '09:00', '09:00'], '2099-05-10'))
      .toEqual(['09:00', '10:00'])
  })

  it('returns empty array when input is not an array', () => {
    expect(sanitizeGeneratedSlots(null, '2099-05-10')).toEqual([])
  })
})
})