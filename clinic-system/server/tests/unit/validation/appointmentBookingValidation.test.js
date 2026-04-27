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
} = require('../../../src/appointmentBookingValidation')

const clinicId = '11111111-1111-1111-1111-111111111111'
const staffId = '22222222-2222-2222-2222-222222222222'
const otherStaffId = '33333333-3333-3333-3333-333333333333'
const patientId = '44444444-4444-4444-4444-444444444444'
const otherClinicId = '55555555-5555-5555-5555-555555555555'

describe('appointmentBookingValidation', () => {
  describe('isValidUuid', () => {
    test('returns true for valid UUIDs', () => {
      expect(isValidUuid(clinicId)).toBe(true)
    })

    test('returns false for invalid UUIDs', () => {
      expect(isValidUuid('not-a-uuid')).toBe(false)
      expect(isValidUuid('')).toBe(false)
      expect(isValidUuid(null)).toBe(false)
      expect(isValidUuid(undefined)).toBe(false)
    })
  })

  describe('hasRequiredAppointmentFields', () => {
    test('returns true when all required fields are present', () => {
      expect(
        hasRequiredAppointmentFields({
          clinic_id: clinicId,
          patient_id: patientId,
          date: '2026-04-27',
          time: '09:00',
          booked_by: staffId,
        })
      ).toBe(true)
    })

    test('returns false when a required field is missing', () => {
      expect(
        hasRequiredAppointmentFields({
          clinic_id: clinicId,
          patient_id: patientId,
          date: '2026-04-27',
          time: '09:00',
        })
      ).toBe(false)
    })
  })

  describe('validateAppointmentBookingInput', () => {
    test('accepts valid booking input', () => {
      const result = validateAppointmentBookingInput({
        clinic_id: clinicId,
        patient_id: patientId,
        date: '2026-04-27',
        time: '09:00',
        booked_by: staffId,
      })

      expect(result.valid).toBe(true)
      expect(result.status).toBe(200)
      expect(result.error).toBeNull()
    })

    test('rejects missing required fields', () => {
      const result = validateAppointmentBookingInput({
        clinic_id: clinicId,
        patient_id: patientId,
        date: '2026-04-27',
        time: '09:00',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'clinic_id, patient_id, date, time and booked_by are required',
      })
    })

    test('rejects invalid UUID values', () => {
      const result = validateAppointmentBookingInput({
        clinic_id: 'bad-id',
        patient_id: patientId,
        date: '2026-04-27',
        time: '09:00',
        booked_by: staffId,
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid ID format',
      })
    })

    test('rejects invalid date format', () => {
      const result = validateAppointmentBookingInput({
        clinic_id: clinicId,
        patient_id: patientId,
        date: '27-04-2026',
        time: '09:00',
        booked_by: staffId,
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid date format',
      })
    })

    test('rejects impossible calendar dates', () => {
      const result = validateAppointmentBookingInput({
        clinic_id: clinicId,
        patient_id: patientId,
        date: '2026-02-30',
        time: '09:00',
        booked_by: staffId,
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid date format',
      })
    })

    test('rejects invalid time format', () => {
      const result = validateAppointmentBookingInput({
        clinic_id: clinicId,
        patient_id: patientId,
        date: '2026-04-27',
        time: '25:00',
        booked_by: staffId,
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid time format',
      })
    })
  })

  describe('date and time helpers', () => {
    test('isValidDateString validates real ISO date strings only', () => {
      expect(isValidDateString('2026-04-27')).toBe(true)
      expect(isValidDateString('2026-02-30')).toBe(false)
      expect(isValidDateString('27/04/2026')).toBe(false)
      expect(isValidDateString(null)).toBe(false)
    })

    test('isValidTimeString validates 24-hour times', () => {
      expect(isValidTimeString('00:00')).toBe(true)
      expect(isValidTimeString('09:30')).toBe(true)
      expect(isValidTimeString('23:59')).toBe(true)
      expect(isValidTimeString('24:00')).toBe(false)
      expect(isValidTimeString('12:60')).toBe(false)
      expect(isValidTimeString('abc')).toBe(false)
    })

    test('normalizeTimeValue extracts HH:mm from plain time or datetime strings', () => {
      expect(normalizeTimeValue('09:30')).toBe('09:30')
      expect(normalizeTimeValue('2026-04-27T14:45:00')).toBe('14:45')
      expect(normalizeTimeValue('bad-time')).toBeNull()
    })

    test('getDayOfWeekFromDate returns UTC day of week', () => {
      expect(getDayOfWeekFromDate('2026-04-26')).toBe(0)
      expect(getDayOfWeekFromDate('2026-04-27')).toBe(1)
      expect(getDayOfWeekFromDate('bad-date')).toBeNull()
    })

    test('timeToMinutes converts valid time to minutes after midnight', () => {
      expect(timeToMinutes('00:00')).toBe(0)
      expect(timeToMinutes('01:30')).toBe(90)
      expect(timeToMinutes('23:59')).toBe(1439)
      expect(timeToMinutes('bad-time')).toBeNull()
    })
  })

  describe('isTimeWithinAvailability', () => {
    test('returns true when appointment time is within availability range', () => {
      expect(
        isTimeWithinAvailability({
          time: '09:00',
          start_time: '08:00',
          end_time: '17:00',
        })
      ).toBe(true)
    })

    test('allows appointment at exact start time', () => {
      expect(
        isTimeWithinAvailability({
          time: '08:00',
          start_time: '08:00',
          end_time: '17:00',
        })
      ).toBe(true)
    })

    test('rejects appointment at exact end time', () => {
      expect(
        isTimeWithinAvailability({
          time: '17:00',
          start_time: '08:00',
          end_time: '17:00',
        })
      ).toBe(false)
    })

    test('returns false for invalid time values', () => {
      expect(
        isTimeWithinAvailability({
          time: 'bad-time',
          start_time: '08:00',
          end_time: '17:00',
        })
      ).toBe(false)
    })
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
  })

  describe('getAvailableStaffAtTime', () => {
    test('returns staff available at the requested clinic, day, and time', () => {
      const availableStaff = getAvailableStaffAtTime({
        clinic_id: clinicId,
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [
          { id: staffId, role: 'Staff', clinic_id: clinicId },
          { id: otherStaffId, role: 'Staff', clinic_id: clinicId },
          { id: patientId, role: 'Patient', clinic_id: clinicId },
        ],
        availabilityRows: [
          {
            staff_id: staffId,
            day_of_week: 1,
            start_time: '08:00',
            end_time: '17:00',
            is_available: true,
          },
          {
            staff_id: otherStaffId,
            day_of_week: 1,
            start_time: '10:00',
            end_time: '17:00',
            is_available: true,
          },
        ],
      })

      expect(availableStaff).toEqual([
        {
          staff_id: staffId,
          day_of_week: 1,
          start_time: '08:00',
          end_time: '17:00',
          is_available: true,
        },
      ])
    })

    test('excludes unavailable staff, wrong clinic staff, and non-staff users', () => {
      const availableStaff = getAvailableStaffAtTime({
        clinic_id: clinicId,
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [
          { id: staffId, role: 'Staff', clinic_id: clinicId },
          { id: otherStaffId, role: 'Staff', clinic_id: otherClinicId },
          { id: patientId, role: 'Patient', clinic_id: clinicId },
        ],
        availabilityRows: [
          {
            staff_id: staffId,
            day_of_week: 1,
            start_time: '08:00',
            end_time: '17:00',
            is_available: false,
          },
          {
            staff_id: otherStaffId,
            day_of_week: 1,
            start_time: '08:00',
            end_time: '17:00',
            is_available: true,
          },
          {
            staff_id: patientId,
            day_of_week: 1,
            start_time: '08:00',
            end_time: '17:00',
            is_available: true,
          },
        ],
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
        bookedByUser: { id: staffId, role: 'Staff', clinic_id: clinicId },
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [{ id: staffId, role: 'Staff', clinic_id: clinicId }],
        availabilityRows: [
          {
            staff_id: staffId,
            day_of_week: 1,
            start_time: '08:00',
            end_time: '17:00',
            is_available: true,
          },
        ],
      })

      expect(result.valid).toBe(true)
    })

    test('allows patient self-booking when user is not staff', () => {
      const result = validateStaffSelfBookingAvailabilityRule({
        clinic_id: clinicId,
        patient_id: patientId,
        booked_by: patientId,
        bookedByUser: { id: patientId, role: 'Patient', clinic_id: null },
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [],
        availabilityRows: [],
      })

      expect(result.valid).toBe(true)
    })

    test('allows staff self-booking at a clinic they do not work for', () => {
      const result = validateStaffSelfBookingAvailabilityRule({
        clinic_id: clinicId,
        patient_id: staffId,
        booked_by: staffId,
        bookedByUser: { id: staffId, role: 'Staff', clinic_id: otherClinicId },
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [{ id: staffId, role: 'Staff', clinic_id: otherClinicId }],
        availabilityRows: [],
      })

      expect(result.valid).toBe(true)
    })

    test('blocks staff self-booking when they are the only available staff member', () => {
      const result = validateStaffSelfBookingAvailabilityRule({
        clinic_id: clinicId,
        patient_id: staffId,
        booked_by: staffId,
        bookedByUser: { id: staffId, role: 'Staff', clinic_id: clinicId },
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [{ id: staffId, role: 'Staff', clinic_id: clinicId }],
        availabilityRows: [
          {
            staff_id: staffId,
            day_of_week: 1,
            start_time: '08:00',
            end_time: '17:00',
            is_available: true,
          },
        ],
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
        bookedByUser: { id: staffId, role: 'Staff', clinic_id: clinicId },
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [
          { id: staffId, role: 'Staff', clinic_id: clinicId },
          { id: otherStaffId, role: 'Staff', clinic_id: clinicId },
        ],
        availabilityRows: [
          {
            staff_id: staffId,
            day_of_week: 1,
            start_time: '08:00',
            end_time: '17:00',
            is_available: true,
          },
          {
            staff_id: otherStaffId,
            day_of_week: 1,
            start_time: '08:00',
            end_time: '17:00',
            is_available: true,
          },
        ],
      })

      expect(result.valid).toBe(true)
    })

    test('blocks staff self-booking when other staff exist but none are available at that time', () => {
      const result = validateStaffSelfBookingAvailabilityRule({
        clinic_id: clinicId,
        patient_id: staffId,
        booked_by: staffId,
        bookedByUser: { id: staffId, role: 'Staff', clinic_id: clinicId },
        date: '2026-04-27',
        time: '09:00',
        staffUsers: [
          { id: staffId, role: 'Staff', clinic_id: clinicId },
          { id: otherStaffId, role: 'Staff', clinic_id: clinicId },
        ],
        availabilityRows: [
          {
            staff_id: staffId,
            day_of_week: 1,
            start_time: '08:00',
            end_time: '17:00',
            is_available: true,
          },
          {
            staff_id: otherStaffId,
            day_of_week: 1,
            start_time: '10:00',
            end_time: '17:00',
            is_available: true,
          },
        ],
      })

      expect(result.valid).toBe(false)
      expect(result.status).toBe(409)
    })
  })
  test('rejects missing fields individually', () => {
    const valid = {
      clinic_id: clinicId,
      patient_id: patientId,
      date: '2026-04-27',
      time: '09:00',
      booked_by: staffId,
    }

    for (const field of Object.keys(valid)) {
      const input = { ...valid }
      delete input[field]

      const result = validateAppointmentBookingInput(input)

      expect(result.valid).toBe(false)
      expect(result.status).toBe(400)
    }
  })

  test('rejects invalid patient_id and booked_by UUIDs', () => {
    expect(
      validateAppointmentBookingInput({
        clinic_id: clinicId,
        patient_id: 'bad-id',
        date: '2026-04-27',
        time: '09:00',
        booked_by: staffId,
      }).valid
    ).toBe(false)

    expect(
      validateAppointmentBookingInput({
        clinic_id: clinicId,
        patient_id: patientId,
        date: '2026-04-27',
        time: '09:00',
        booked_by: 'bad-id',
      }).valid
    ).toBe(false)
  })

  test('invalid availability times return false', () => {
    expect(
      isTimeWithinAvailability({
        time: '09:00',
        start_time: 'bad',
        end_time: '17:00',
      })
    ).toBe(false)
  })

  test('getAvailableStaffAtTime returns empty for invalid date', () => {
    const result = getAvailableStaffAtTime({
      clinic_id: clinicId,
      date: 'bad-date',
      time: '09:00',
      staffUsers: [{ id: staffId, role: 'Staff', clinic_id: clinicId }],
      availabilityRows: [],
    })

    expect(result).toEqual([])
  })

  test('allows admin as staff role in self-booking rule', () => {
    const result = validateStaffSelfBookingAvailabilityRule({
      clinic_id: clinicId,
      patient_id: staffId,
      booked_by: staffId,
      bookedByUser: { id: staffId, role: 'Admin', clinic_id: clinicId },
      date: '2026-04-27',
      time: '09:00',
      staffUsers: [
        { id: staffId, role: 'Admin', clinic_id: clinicId },
        { id: otherStaffId, role: 'Staff', clinic_id: clinicId },
      ],
      availabilityRows: [
        {
          staff_id: staffId,
          day_of_week: 1,
          start_time: '08:00',
          end_time: '17:00',
          is_available: true,
        },
        {
          staff_id: otherStaffId,
          day_of_week: 1,
          start_time: '08:00',
          end_time: '17:00',
          is_available: true,
        },
      ],
    })

    expect(result.valid).toBe(true)
  })
})