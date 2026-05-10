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
  validateClinicBookingCapacity,
} = require('../../../src/appointmentSlotValidation')

const VALID_UUID = '0b0d9f9a-9a5e-47fe-92e0-7d1696e41464'
const INVALID_UUID = 'not-a-uuid'
const FUTURE_STATIC_DATE = '2099-05-10'

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
    test('returns true for a valid UUID', () => {
      expect(isValidUuid(VALID_UUID)).toBe(true)
    })

    test('returns false for invalid or missing UUID values', () => {
      expect(isValidUuid(INVALID_UUID)).toBe(false)
      expect(isValidUuid('')).toBe(false)
      expect(isValidUuid()).toBe(false)
      expect(isValidUuid(null)).toBe(false)
    })
  })

  describe('isValidDateFormat', () => {
    test('returns true for valid YYYY-MM-DD dates', () => {
      expect(isValidDateFormat('2099-05-10')).toBe(true)
      expect(isValidDateFormat('2024-02-29')).toBe(true)
    })

    test('returns false for missing, non-string, or incorrectly formatted dates', () => {
      expect(isValidDateFormat()).toBe(false)
      expect(isValidDateFormat(null)).toBe(false)
      expect(isValidDateFormat(20990510)).toBe(false)
      expect(isValidDateFormat('10-05-2099')).toBe(false)
      expect(isValidDateFormat('2099/05/10')).toBe(false)
      expect(isValidDateFormat('not-a-date')).toBe(false)
    })

    test('returns false for rolled-over calendar dates', () => {
      expect(isValidDateFormat('2099-02-31')).toBe(false)
      expect(isValidDateFormat('2023-02-29')).toBe(false)
    })
  })

  describe('isPastDate', () => {
    test('returns true for a past date', () => {
      expect(isPastDate(getPastDate())).toBe(true)
    })

    test('returns false for today or a future date', () => {
      const today = new Date().toISOString().split('T')[0]

      expect(isPastDate(today)).toBe(false)
      expect(isPastDate(getFutureDate())).toBe(false)
    })
  })

  describe('validateSlotRetrievalInput', () => {
    test('rejects missing clinic_id', () => {
      expect(
        validateSlotRetrievalInput({
          date: getFutureDate(),
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'clinic_id is required',
      })
    })

    test('rejects missing date', () => {
      expect(
        validateSlotRetrievalInput({
          clinic_id: VALID_UUID,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'date is required',
      })
    })

    test('rejects invalid clinic_id format', () => {
      expect(
        validateSlotRetrievalInput({
          clinic_id: INVALID_UUID,
          date: getFutureDate(),
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid clinic ID format',
      })
    })

    test('rejects invalid date format', () => {
      expect(
        validateSlotRetrievalInput({
          clinic_id: VALID_UUID,
          date: '10-05-2099',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid date format',
      })
    })

    test('rejects past dates', () => {
      expect(
        validateSlotRetrievalInput({
          clinic_id: VALID_UUID,
          date: getPastDate(),
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Past dates cannot be used for slot retrieval',
      })
    })

    test('accepts valid clinic_id and future date', () => {
      expect(
        validateSlotRetrievalInput({
          clinic_id: VALID_UUID,
          date: getFutureDate(),
        })
      ).toEqual({
        valid: true,
      })
    })
  })

  describe('sanitizeGeneratedSlots', () => {
    test('returns empty array when input is not an array', () => {
      expect(sanitizeGeneratedSlots(null, FUTURE_STATIC_DATE)).toEqual([])
      expect(sanitizeGeneratedSlots(undefined, FUTURE_STATIC_DATE)).toEqual([])
    })

    test('removes invalid slot formats and non-string values', () => {
      expect(
        sanitizeGeneratedSlots(
          ['09:00', 'bad', '25:99', null, undefined, 900],
          FUTURE_STATIC_DATE
        )
      ).toEqual(['09:00'])
    })

    test('removes duplicate slots and sorts valid slots', () => {
      expect(
        sanitizeGeneratedSlots(
          ['10:00', '09:00', '09:00', '08:30'],
          FUTURE_STATIC_DATE
        )
      ).toEqual(['08:30', '09:00', '10:00'])
    })

    test('removes past slots for today', () => {
      const today = new Date().toISOString().split('T')[0]

      expect(sanitizeGeneratedSlots(['00:00'], today)).toEqual([])
    })

    test('keeps slots for future dates without comparing them to current time', () => {
      expect(sanitizeGeneratedSlots(['00:00'], getFutureDate())).toEqual(['00:00'])
    })
  })

  describe('normalizeSlotTime', () => {
    test('returns null for missing time', () => {
      expect(normalizeSlotTime()).toBeNull()
      expect(normalizeSlotTime(null)).toBeNull()
    })

    test('returns valid HH:mm time strings unchanged', () => {
      expect(normalizeSlotTime('09:30')).toBe('09:30')
      expect(normalizeSlotTime('23:59')).toBe('23:59')
    })

    test('returns null for invalid time strings', () => {
      expect(normalizeSlotTime('not-a-time')).toBeNull()
    })

    test('normalizes valid datetime strings into HH:mm format', () => {
      const result = normalizeSlotTime('2099-05-10T09:30:00.000Z')

      expect(result).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
    })
  })

  describe('validateGeneratedSlots', () => {
    test('rejects non-array generated slots', () => {
      expect(validateGeneratedSlots(null, FUTURE_STATIC_DATE)).toEqual({
        valid: false,
        status: 500,
        error: 'Generated slots must be an array',
      })
    })

    test('returns sanitized valid slots', () => {
      expect(
        validateGeneratedSlots(
          ['10:00', '09:00', '09:00', 'bad'],
          FUTURE_STATIC_DATE
        )
      ).toEqual({
        valid: true,
        slots: ['09:00', '10:00'],
      })
    })
  })

  describe('validateSelectedSlot', () => {
    test('rejects invalid selected time format', () => {
      expect(
        validateSelectedSlot({
          date: FUTURE_STATIC_DATE,
          time: 'bad-time',
          validSlots: ['09:00', '09:30'],
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid date or time format',
      })
    })

    test('rejects invalid date even when time format is valid', () => {
      expect(
        validateSelectedSlot({
          date: 'not-a-date',
          time: '09:00',
          validSlots: ['09:00'],
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid date or time format',
      })
    })

    test('rejects a past selected slot', () => {
      expect(
        validateSelectedSlot({
          date: getPastDate(),
          time: '09:00',
          validSlots: ['09:00', '09:30'],
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Cannot book a past time slot',
      })
    })

    test('rejects selected time when validSlots is not an array', () => {
      expect(
        validateSelectedSlot({
          date: FUTURE_STATIC_DATE,
          time: '09:00',
          validSlots: null,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Selected time is outside clinic hours or does not match the appointment duration',
      })
    })

    test('rejects a selected time that is not in the generated slot list', () => {
      expect(
        validateSelectedSlot({
          date: FUTURE_STATIC_DATE,
          time: '11:00',
          validSlots: ['09:00', '09:30'],
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Selected time is outside clinic hours or does not match the appointment duration',
      })
    })

    test('accepts a selected time that exists in the generated slot list', () => {
      const result = validateSelectedSlot({
        date: FUTURE_STATIC_DATE,
        time: '09:00',
        validSlots: ['09:00', '09:30'],
      })

      expect(result.valid).toBe(true)
      expect(result.normalizedTime).toBe('09:00')
      expect(result.slotDateTime).toBeInstanceOf(Date)
    })
  })

  describe('removeFullyBookedSlots', () => {
    test('removes fully booked slots from generated slots when booked times are a Set', () => {
      expect(
        removeFullyBookedSlots(
          ['09:00', '09:30', '10:00'],
          new Set(['09:30'])
        )
      ).toEqual(['09:00', '10:00'])
    })

    test('removes fully booked slots when booked times are an array', () => {
      expect(
        removeFullyBookedSlots(
          ['09:00', '09:30', '10:00'],
          ['09:00', '10:00']
        )
      ).toEqual(['09:30'])
    })

    test('returns all slots when no booked times are provided', () => {
      expect(removeFullyBookedSlots(['09:00', '09:30'])).toEqual([
        '09:00',
        '09:30',
      ])

      expect(removeFullyBookedSlots(['09:00', '09:30'], null)).toEqual([
        '09:00',
        '09:30',
      ])
    })
  })

  describe('validateClinicBookingCapacity', () => {
    test('accepts positive staff counts', () => {
      expect(validateClinicBookingCapacity(2)).toEqual({
        valid: true,
        capacity: 2,
      })

      expect(validateClinicBookingCapacity('3')).toEqual({
        valid: true,
        capacity: 3,
      })
    })

    test.each([0, -1, undefined, null, 'not-a-number'])(
      'rejects invalid staff count %s',
      (staffCount) => {
        expect(validateClinicBookingCapacity(staffCount)).toEqual({
          valid: false,
          status: 409,
          reason: 'NO_STAFF',
          error: 'Appointments are not currently available for this clinic',
        })
      }
    )
  })
})