const {
  isValidUuid,
  hasRequiredAppointmentFields,
  validateAppointmentBookingInput,
  isValidDateString,
  isValidTimeString,
  normalizeTimeValue,
  getDayOfWeekFromDate,
  timeToMinutes,
  isTimeWithinAvailability,
  isStaffUser,
  isSelfBooking,
  isBookingAtOwnClinic,
  getAvailableStaffAtTime,
  validateStaffSelfBookingAvailabilityRule,
  validateAppointmentStatusUpdate,
} = require('../../../src/appointmentBookingValidation')

const clinicId = '11111111-1111-1111-1111-111111111111'
const staffId = '22222222-2222-2222-2222-222222222222'
const otherStaffId = '33333333-3333-3333-3333-333333333333'
const patientId = '44444444-4444-4444-4444-444444444444'
const otherClinicId = '55555555-5555-5555-5555-555555555555'
const appointmentId = '66666666-6666-6666-6666-666666666666'

const validBookingInput = {
  clinic_id: clinicId,
  patient_id: patientId,
  date: '2026-04-27',
  time: '09:00',
  booked_by: staffId,
}

const staffUser = {
  id: staffId,
  role: 'Staff',
  clinic_id: clinicId,
}

const otherStaffUser = {
  id: otherStaffId,
  role: 'Staff',
  clinic_id: clinicId,
}

function availabilityRow(overrides = {}) {
  return {
    staff_id: staffId,
    day_of_week: 1,
    start_time: '08:00',
    end_time: '17:00',
    is_available: true,
    ...overrides,
  }
}

describe('appointmentBookingValidation', () => {
  test('rejects empty time as a missing required field', () => {
  expect(
    validateAppointmentBookingInput({
      ...validBookingInput,
      time: '',
    })
  ).toEqual({
    valid: false,
    status: 400,
    error: 'clinic_id, patient_id, date, time and booked_by are required',
  })
})
  describe('isValidUuid', () => {
    test('returns true for valid UUIDs', () => {
      expect(isValidUuid(clinicId)).toBe(true)
    })

    test('returns false for invalid UUIDs or non-string values', () => {
      expect(isValidUuid('not-a-uuid')).toBe(false)
      expect(isValidUuid('')).toBe(false)
      expect(isValidUuid(null)).toBe(false)
      expect(isValidUuid(undefined)).toBe(false)
      expect(isValidUuid(123)).toBe(false)
    })
  })

  describe('hasRequiredAppointmentFields', () => {
    test('returns true when all required fields are present', () => {
      expect(hasRequiredAppointmentFields(validBookingInput)).toBe(true)
    })

    test.each([
      'clinic_id',
      'patient_id',
      'date',
      'time',
      'booked_by',
    ])('returns false when %s is missing', (field) => {
      const input = { ...validBookingInput }
      delete input[field]

      expect(hasRequiredAppointmentFields(input)).toBe(false)
    })
  })

  describe('validateAppointmentBookingInput', () => {
    test('accepts valid booking input', () => {
      expect(validateAppointmentBookingInput(validBookingInput)).toEqual({
        valid: true,
        status: 200,
        error: null,
      })
    })

    test.each([
      'clinic_id',
      'patient_id',
      'date',
      'time',
      'booked_by',
    ])('rejects booking input when %s is missing', (field) => {
      const input = { ...validBookingInput }
      delete input[field]

      expect(validateAppointmentBookingInput(input)).toEqual({
        valid: false,
        status: 400,
        error: 'clinic_id, patient_id, date, time and booked_by are required',
      })
    })

    test.each([
      ['clinic_id'],
      ['patient_id'],
      ['booked_by'],
    ])('rejects invalid %s UUID values', (field) => {
      const input = {
        ...validBookingInput,
        [field]: 'bad-id',
      }

      expect(validateAppointmentBookingInput(input)).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid ID format',
      })
    })

    test.each([
      '27-04-2026',
      '2026/04/27',
      '2026-02-30',
      'bad-date',
    ])('rejects invalid date value %s', (date) => {
      expect(
        validateAppointmentBookingInput({
          ...validBookingInput,
          date,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid date format',
      })
    })

    test.each([
      '25:00',
      '12:60',
      'bad-time',
    ])('rejects invalid time value %s', (time) => {
      expect(
        validateAppointmentBookingInput({
          ...validBookingInput,
          time,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid time format',
      })
    })
  })

  describe('isValidDateString', () => {
    test('returns true for real ISO date strings', () => {
      expect(isValidDateString('2026-04-27')).toBe(true)
      expect(isValidDateString('2024-02-29')).toBe(true)
    })

    test('returns false for invalid, impossible, or non-string dates', () => {
      expect(isValidDateString('2026-02-30')).toBe(false)
      expect(isValidDateString('27/04/2026')).toBe(false)
      expect(isValidDateString('bad-date')).toBe(false)
      expect(isValidDateString(null)).toBe(false)
    })
  })

  describe('isValidTimeString', () => {
    test('returns true for valid 24-hour times', () => {
      expect(isValidTimeString('00:00')).toBe(true)
      expect(isValidTimeString('09:30')).toBe(true)
      expect(isValidTimeString('23:59')).toBe(true)
    })

    test('returns true when a valid HH:mm value can be extracted from a datetime string', () => {
      expect(isValidTimeString('2026-04-27T14:45:00')).toBe(true)
    })

    test('returns false for invalid or non-string times', () => {
      expect(isValidTimeString('24:00')).toBe(false)
      expect(isValidTimeString('12:60')).toBe(false)
      expect(isValidTimeString('abc')).toBe(false)
      expect(isValidTimeString(null)).toBe(false)
    })
  })

  describe('normalizeTimeValue', () => {
    test('extracts HH:mm from plain time or datetime strings', () => {
      expect(normalizeTimeValue('09:30')).toBe('09:30')
      expect(normalizeTimeValue('2026-04-27T14:45:00')).toBe('14:45')
      expect(normalizeTimeValue(' 08:15 ')).toBe('08:15')
    })

    test('returns null when time cannot be normalized', () => {
      expect(normalizeTimeValue('bad-time')).toBeNull()
      expect(normalizeTimeValue('')).toBeNull()
      expect(normalizeTimeValue(null)).toBeNull()
      expect(normalizeTimeValue(900)).toBeNull()
    })
  })

  describe('getDayOfWeekFromDate', () => {
    test('returns UTC day of week for valid dates', () => {
      expect(getDayOfWeekFromDate('2026-04-26')).toBe(0)
      expect(getDayOfWeekFromDate('2026-04-27')).toBe(1)
      expect(getDayOfWeekFromDate('2026-05-02')).toBe(6)
    })

    test('returns null for invalid dates', () => {
      expect(getDayOfWeekFromDate('bad-date')).toBeNull()
    })
  })

  describe('timeToMinutes', () => {
    test('converts valid time values to minutes after midnight', () => {
      expect(timeToMinutes('00:00')).toBe(0)
      expect(timeToMinutes('01:30')).toBe(90)
      expect(timeToMinutes('23:59')).toBe(1439)
    })

    test('returns null for invalid time values', () => {
      expect(timeToMinutes('24:00')).toBeNull()
      expect(timeToMinutes('12:60')).toBeNull()
      expect(timeToMinutes('bad-time')).toBeNull()
      expect(timeToMinutes(null)).toBeNull()
    })
  })

  describe('isTimeWithinAvailability', () => {
    test('returns true when appointment time is inside the availability range', () => {
      expect(
        isTimeWithinAvailability({
          time: '09:00',
          start_time: '08:00',
          end_time: '17:00',
        })
      ).toBe(true)
    })

    test('allows appointment at the exact start time', () => {
      expect(
        isTimeWithinAvailability({
          time: '08:00',
          start_time: '08:00',
          end_time: '17:00',
        })
      ).toBe(true)
    })

    test('rejects appointment at the exact end time', () => {
      expect(
        isTimeWithinAvailability({
          time: '17:00',
          start_time: '08:00',
          end_time: '17:00',
        })
      ).toBe(false)
    })

    test.each([
      ['bad-time', '08:00', '17:00'],
      ['09:00', 'bad-time', '17:00'],
      ['09:00', '08:00', 'bad-time'],
    ])(
      'returns false when time values are invalid',
      (time, start_time, end_time) => {
        expect(
          isTimeWithinAvailability({
            time,
            start_time,
            end_time,
          })
        ).toBe(false)
      }
    )
  })

  describe('user and booking helper checks', () => {
    test('isStaffUser returns true for Staff and Admin users', () => {
      expect(isStaffUser({ role: 'Staff' })).toBe(true)
      expect(isStaffUser({ role: 'Admin' })).toBe(true)
    })

    test('isStaffUser returns false for Patient or missing users', () => {
      expect(isStaffUser({ role: 'Patient' })).toBe(false)
      expect(isStaffUser(null)).toBe(false)
    })

    test('isSelfBooking detects when patient and booker are the same user', () => {
      expect(
        isSelfBooking({
          patient_id: staffId,
          booked_by: staffId,
        })
      ).toBe(true)

      expect(
        isSelfBooking({
          patient_id: patientId,
          booked_by: staffId,
        })
      ).toBe(false)
    })

    test('isSelfBooking returns false when IDs are missing', () => {
      expect(
        isSelfBooking({
          patient_id: staffId,
          booked_by: null,
        })
      ).toBe(false)
    })

    test('isBookingAtOwnClinic checks the booked clinic against the user clinic', () => {
      expect(
        isBookingAtOwnClinic({
          user: { clinic_id: clinicId },
          clinic_id: clinicId,
        })
      ).toBe(true)

      expect(
        isBookingAtOwnClinic({
          user: { clinic_id: otherClinicId },
          clinic_id: clinicId,
        })
      ).toBe(false)
    })

    test('isBookingAtOwnClinic returns false when user or clinic assignment is missing', () => {
      expect(
        isBookingAtOwnClinic({
          user: null,
          clinic_id: clinicId,
        })
      ).toBe(false)

      expect(
        isBookingAtOwnClinic({
          user: { clinic_id: null },
          clinic_id: clinicId,
        })
      ).toBe(false)
    })
  })

  describe('getAvailableStaffAtTime', () => {
    test('returns staff available at the requested clinic, day, and time', () => {
      const availableStaff = getAvailableStaffAtTime({
        clinic_id: clinicId,
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [
          staffUser,
          otherStaffUser,
          { id: patientId, role: 'Patient', clinic_id: clinicId },
        ],
        availabilityRows: [
          availabilityRow(),
          availabilityRow({
            staff_id: otherStaffId,
            start_time: '10:00',
          }),
        ],
      })

      expect(availableStaff).toEqual([availabilityRow()])
    })

    test('includes Admin users as available staff', () => {
      const adminId = '77777777-7777-7777-7777-777777777777'

      const availableStaff = getAvailableStaffAtTime({
        clinic_id: clinicId,
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [
          {
            id: adminId,
            role: 'Admin',
            clinic_id: clinicId,
          },
        ],
        availabilityRows: [
          availabilityRow({
            staff_id: adminId,
          }),
        ],
      })

      expect(availableStaff).toEqual([
        availabilityRow({
          staff_id: adminId,
        }),
      ])
    })

    test('excludes unavailable staff, wrong clinic staff, and non-staff users', () => {
      const availableStaff = getAvailableStaffAtTime({
        clinic_id: clinicId,
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [
          staffUser,
          { id: otherStaffId, role: 'Staff', clinic_id: otherClinicId },
          { id: patientId, role: 'Patient', clinic_id: clinicId },
        ],
        availabilityRows: [
          availabilityRow({ is_available: false }),
          availabilityRow({ staff_id: otherStaffId }),
          availabilityRow({ staff_id: patientId }),
        ],
      })

      expect(availableStaff).toEqual([])
    })

    test('excludes rows for the wrong day of week', () => {
      const availableStaff = getAvailableStaffAtTime({
        clinic_id: clinicId,
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [staffUser],
        availabilityRows: [
          availabilityRow({
            day_of_week: 2,
          }),
        ],
      })

      expect(availableStaff).toEqual([])
    })

    test('excludes null or malformed availability rows', () => {
      const availableStaff = getAvailableStaffAtTime({
        clinic_id: clinicId,
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [staffUser],
        availabilityRows: [
          null,
          {
            day_of_week: 1,
            start_time: '08:00',
            end_time: '17:00',
            is_available: true,
          },
        ],
      })

      expect(availableStaff).toEqual([])
    })

    test('returns empty array when the booking date is invalid', () => {
      const availableStaff = getAvailableStaffAtTime({
        clinic_id: clinicId,
        date: 'bad-date',
        time: '09:00',
        staffUsers: [staffUser],
        availabilityRows: [availabilityRow()],
      })

      expect(availableStaff).toEqual([])
    })
  })

  describe('validateStaffSelfBookingAvailabilityRule', () => {
    test('allows normal patient booking by staff', () => {
      const result = validateStaffSelfBookingAvailabilityRule({
        clinic_id: clinicId,
        patient_id: patientId,
        booked_by: staffId,
        bookedByUser: staffUser,
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [staffUser],
        availabilityRows: [availabilityRow()],
      })

      expect(result).toEqual({
        valid: true,
        status: 200,
        error: null,
      })
    })

    test('allows patient self-booking when user is not staff', () => {
      const result = validateStaffSelfBookingAvailabilityRule({
        clinic_id: clinicId,
        patient_id: patientId,
        booked_by: patientId,
        bookedByUser: {
          id: patientId,
          role: 'Patient',
          clinic_id: null,
        },
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [],
        availabilityRows: [],
      })

      expect(result).toEqual({
        valid: true,
        status: 200,
        error: null,
      })
    })

    test('allows staff self-booking at a clinic they do not work for', () => {
      const result = validateStaffSelfBookingAvailabilityRule({
        clinic_id: clinicId,
        patient_id: staffId,
        booked_by: staffId,
        bookedByUser: {
          ...staffUser,
          clinic_id: otherClinicId,
        },
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [
          {
            ...staffUser,
            clinic_id: otherClinicId,
          },
        ],
        availabilityRows: [],
      })

      expect(result).toEqual({
        valid: true,
        status: 200,
        error: null,
      })
    })

    test('blocks staff self-booking when they are the only available staff member', () => {
      const result = validateStaffSelfBookingAvailabilityRule({
        clinic_id: clinicId,
        patient_id: staffId,
        booked_by: staffId,
        bookedByUser: staffUser,
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [staffUser],
        availabilityRows: [availabilityRow()],
      })

      expect(result).toEqual({
        valid: false,
        status: 409,
        error:
          'Staff cannot book themselves when they are the only available staff member at this clinic and time',
      })
    })

    test('allows staff self-booking when another staff member is available', () => {
      const result = validateStaffSelfBookingAvailabilityRule({
        clinic_id: clinicId,
        patient_id: staffId,
        booked_by: staffId,
        bookedByUser: staffUser,
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [staffUser, otherStaffUser],
        availabilityRows: [
          availabilityRow(),
          availabilityRow({
            staff_id: otherStaffId,
          }),
        ],
      })

      expect(result).toEqual({
        valid: true,
        status: 200,
        error: null,
      })
    })

    test('allows admin self-booking when another staff member is available', () => {
      const result = validateStaffSelfBookingAvailabilityRule({
        clinic_id: clinicId,
        patient_id: staffId,
        booked_by: staffId,
        bookedByUser: {
          ...staffUser,
          role: 'Admin',
        },
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [
          {
            ...staffUser,
            role: 'Admin',
          },
          otherStaffUser,
        ],
        availabilityRows: [
          availabilityRow(),
          availabilityRow({
            staff_id: otherStaffId,
          }),
        ],
      })

      expect(result).toEqual({
        valid: true,
        status: 200,
        error: null,
      })
    })

    test('blocks staff self-booking when other staff exist but none are available at that time', () => {
      const result = validateStaffSelfBookingAvailabilityRule({
        clinic_id: clinicId,
        patient_id: staffId,
        booked_by: staffId,
        bookedByUser: staffUser,
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [staffUser, otherStaffUser],
        availabilityRows: [
          availabilityRow(),
          availabilityRow({
            staff_id: otherStaffId,
            start_time: '10:00',
          }),
        ],
      })

      expect(result).toEqual({
        valid: false,
        status: 409,
        error:
          'Staff cannot book themselves when they are the only available staff member at this clinic and time',
      })
    })
  })

  describe('validateAppointmentStatusUpdate', () => {
    test.each(['Completed', 'No-show', 'Cancelled'])(
      'accepts %s status updates',
      (status) => {
        expect(
          validateAppointmentStatusUpdate({
            appointment_id: appointmentId,
            status,
          })
        ).toEqual({
          valid: true,
          status: 200,
          error: null,
        })
      }
    )

    test('rejects missing appointment ID or status', () => {
      expect(
        validateAppointmentStatusUpdate({
          appointment_id: appointmentId,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'appointment_id and status are required',
      })

      expect(
        validateAppointmentStatusUpdate({
          status: 'Completed',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'appointment_id and status are required',
      })
    })

    test('rejects invalid appointment ID format', () => {
      expect(
        validateAppointmentStatusUpdate({
          appointment_id: 'bad-id',
          status: 'Completed',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid appointment_id format',
      })
    })

    test('rejects unsupported status values', () => {
      expect(
        validateAppointmentStatusUpdate({
          appointment_id: appointmentId,
          status: 'Confirmed',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid status. Allowed values: Completed, No-show, Cancelled',
      })
    })
  })
})