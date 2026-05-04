const {
  isValidUuid,
  isValidDateFormat,
  isPastDate,
  validateSlotRetrievalInput,
  sanitizeGeneratedSlots,
  validateGeneratedSlots,
  validateSelectedSlot,
  removeFullyBookedSlots,
  normalizeSlotTime,
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

  describe('validateGeneratedSlots', () => {
    it('rejects non-array generated slots', () => {
      const result = validateGeneratedSlots(null, '2099-05-10')

      expect(result).toEqual({
        valid: false,
        status: 500,
        error: 'Generated slots must be an array',
      })
    })

    it('returns sanitized valid slots', () => {
      const result = validateGeneratedSlots(
        ['10:00', '09:00', '09:00', 'bad'],
        '2099-05-10'
      )

      expect(result).toEqual({
        valid: true,
        slots: ['09:00', '10:00'],
      })
    })
  })

  describe('validateSelectedSlot', () => {
    it('rejects invalid selected time format', () => {
      const result = validateSelectedSlot({
        date: '2099-05-10',
        time: 'bad-time',
        validSlots: ['09:00', '09:30'],
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid date or time format',
      })
    })

    it('rejects a selected time that is not in the generated slot list', () => {
      const result = validateSelectedSlot({
        date: '2099-05-10',
        time: '11:00',
        validSlots: ['09:00', '09:30'],
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Selected time is outside clinic hours or does not match the appointment duration',
      })
    })

    it('accepts a selected time that exists in the generated slot list', () => {
      const result = validateSelectedSlot({
        date: '2099-05-10',
        time: '09:00',
        validSlots: ['09:00', '09:30'],
      })

      expect(result.valid).toBe(true)
      expect(result.normalizedTime).toBe('09:00')
      expect(result.slotDateTime).toBeInstanceOf(Date)
    })

    it('rejects a past selected slot', () => {
      const result = validateSelectedSlot({
        date: getPastDate(),
        time: '09:00',
        validSlots: ['09:00', '09:30'],
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Cannot book a past time slot',
      })
    })
  })

  describe('removeFullyBookedSlots', () => {
    it('removes fully booked slots from generated slots', () => {
      const result = removeFullyBookedSlots(
        ['09:00', '09:30', '10:00'],
        new Set(['09:30'])
      )

      expect(result).toEqual(['09:00', '10:00'])
    })

    it('returns all slots when no booked times are provided', () => {
      const result = removeFullyBookedSlots(['09:00', '09:30'])

      expect(result).toEqual(['09:00', '09:30'])
    })
  })
  describe('normalizeSlotTime', () => {
  it('returns null for missing time', () => {
    expect(normalizeSlotTime()).toBeNull()
  })

  it('returns HH:MM time strings unchanged', () => {
    expect(normalizeSlotTime('09:30')).toBe('09:30')
  })

  it('returns null for invalid time strings', () => {
    expect(normalizeSlotTime('not-a-time')).toBeNull()
  })

  it('normalizes valid datetime strings into HH:MM format', () => {
    const result = normalizeSlotTime('2099-05-10T09:30:00.000Z')

    expect(result).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
  })
})

describe('sanitizeGeneratedSlots same-day filtering', () => {
  it('removes past slots for today', () => {
    const today = new Date().toISOString().split('T')[0]

    expect(sanitizeGeneratedSlots(['00:00'], today)).toEqual([])
  })

  it('keeps slots for future dates without comparing them to current time', () => {
    expect(sanitizeGeneratedSlots(['00:00'], getFutureDate())).toEqual(['00:00'])
  })
})

describe('validateSelectedSlot extra branches', () => {
  it('rejects when validSlots is not an array', () => {
    const result = validateSelectedSlot({
      date: '2099-05-10',
      time: '09:00',
      validSlots: null,
    })

    expect(result).toEqual({
      valid: false,
      status: 400,
      error: 'Selected time is outside clinic hours or does not match the appointment duration',
    })
  })

  it('rejects invalid date even when time format is valid', () => {
    const result = validateSelectedSlot({
      date: 'not-a-date',
      time: '09:00',
      validSlots: ['09:00'],
    })

    expect(result).toEqual({
      valid: false,
      status: 400,
      error: 'Invalid date or time format',
    })
  })
})

describe('removeFullyBookedSlots extra branches', () => {
  it('accepts booked times as an array', () => {
    const result = removeFullyBookedSlots(
      ['09:00', '09:30', '10:00'],
      ['09:00', '10:00']
    )

    expect(result).toEqual(['09:30'])
  })

  it('treats null booked times as empty', () => {
    const result = removeFullyBookedSlots(['09:00', '09:30'], null)

    expect(result).toEqual(['09:00', '09:30'])
  })
})
})