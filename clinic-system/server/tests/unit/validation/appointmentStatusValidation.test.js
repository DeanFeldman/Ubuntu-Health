const {
  APPOINTMENT_STATUSES,
  BOOKED_APPOINTMENT_STATUSES,
  normalizeAppointmentStatus,
  isValidAppointmentStatus,
  isFinalAppointmentStatus,
  canMarkAppointmentStatus,
  canRescheduleAppointment,
  canCancelAppointment,
} = require('../../../src/appointmentStatusValidation')

describe('appointmentStatusValidation', () => {
  describe('status constants', () => {
    test('defines all appointment statuses', () => {
      expect(APPOINTMENT_STATUSES).toEqual([
        'Confirmed',
        'Waiting',
        'Completed',
        'Cancelled',
        'No-show',
      ])
    })

    test('defines booked appointment statuses', () => {
      expect(BOOKED_APPOINTMENT_STATUSES).toEqual(['Confirmed', 'Waiting'])
    })
  })

  describe('normalizeAppointmentStatus', () => {
    test('defaults missing status to Confirmed', () => {
      expect(normalizeAppointmentStatus()).toBe('Confirmed')
      expect(normalizeAppointmentStatus(null)).toBe('Confirmed')
      expect(normalizeAppointmentStatus('')).toBe('Confirmed')
    })

    test('normalizes legacy appointment statuses', () => {
      expect(normalizeAppointmentStatus('Pending')).toBe('Confirmed')
      expect(normalizeAppointmentStatus('Rescheduled')).toBe('Confirmed')
      expect(normalizeAppointmentStatus('Complete')).toBe('Completed')
      expect(normalizeAppointmentStatus('NoShow')).toBe('No-show')
      expect(normalizeAppointmentStatus('No_Show')).toBe('No-show')
      expect(normalizeAppointmentStatus('No-show')).toBe('No-show')
    })

    test('trims status strings', () => {
      expect(normalizeAppointmentStatus(' Completed ')).toBe('Completed')
    })

    test('returns unknown statuses unchanged', () => {
      expect(normalizeAppointmentStatus('SomethingElse')).toBe('SomethingElse')
    })
  })

  describe('isValidAppointmentStatus', () => {
    test('returns true for known appointment statuses', () => {
      expect(isValidAppointmentStatus('Confirmed')).toBe(true)
      expect(isValidAppointmentStatus('Waiting')).toBe(true)
      expect(isValidAppointmentStatus('Completed')).toBe(true)
      expect(isValidAppointmentStatus('Cancelled')).toBe(true)
      expect(isValidAppointmentStatus('No-show')).toBe(true)
    })

    test('returns false for unknown appointment statuses', () => {
      expect(isValidAppointmentStatus('Complete')).toBe(false)
      expect(isValidAppointmentStatus('BadStatus')).toBe(false)
      expect(isValidAppointmentStatus()).toBe(false)
    })
  })

  describe('isFinalAppointmentStatus', () => {
    test('returns true for final statuses', () => {
      expect(isFinalAppointmentStatus('Cancelled')).toBe(true)
      expect(isFinalAppointmentStatus('Completed')).toBe(true)
      expect(isFinalAppointmentStatus('No-show')).toBe(true)
    })

    test('returns false for active statuses', () => {
      expect(isFinalAppointmentStatus('Confirmed')).toBe(false)
      expect(isFinalAppointmentStatus('Waiting')).toBe(false)
      expect(isFinalAppointmentStatus()).toBe(false)
    })
  })

  describe('canMarkAppointmentStatus', () => {
    test('allows marking confirmed appointment as Completed', () => {
      expect(canMarkAppointmentStatus('Confirmed', 'Completed')).toEqual({
        valid: true,
        normalizedStatus: 'Completed',
      })
    })

    test('allows marking confirmed appointment as No-show', () => {
      expect(canMarkAppointmentStatus('Confirmed', 'NoShow')).toEqual({
        valid: true,
        normalizedStatus: 'No-show',
      })
    })

    test('normalizes legacy Complete status before marking', () => {
      expect(canMarkAppointmentStatus('Confirmed', 'Complete')).toEqual({
        valid: true,
        normalizedStatus: 'Completed',
      })
    })

    test('rejects invalid next status', () => {
      expect(canMarkAppointmentStatus('Confirmed', 'Confirmed')).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid appointment status',
      })
    })

    test('rejects appointment that is already final', () => {
      expect(canMarkAppointmentStatus('Completed', 'Completed')).toEqual({
        valid: false,
        status: 409,
        error: 'Appointment is already Completed',
      })

      expect(canMarkAppointmentStatus('Cancelled', 'Completed')).toEqual({
        valid: false,
        status: 409,
        error: 'Appointment is already Cancelled',
      })

      expect(canMarkAppointmentStatus('No-show', 'Completed')).toEqual({
        valid: false,
        status: 409,
        error: 'Appointment is already No-show',
      })
    })
  })

  describe('canRescheduleAppointment', () => {
    test('allows rescheduling active appointment statuses', () => {
      expect(canRescheduleAppointment('Confirmed')).toEqual({ valid: true })
      expect(canRescheduleAppointment('Waiting')).toEqual({ valid: true })
    })

    test('rejects rescheduling final appointment statuses', () => {
      expect(canRescheduleAppointment('Cancelled')).toEqual({
        valid: false,
        status: 409,
        error: 'Cannot reschedule an appointment that is Cancelled',
      })

      expect(canRescheduleAppointment('Completed')).toEqual({
        valid: false,
        status: 409,
        error: 'Cannot reschedule an appointment that is Completed',
      })

      expect(canRescheduleAppointment('No-show')).toEqual({
        valid: false,
        status: 409,
        error: 'Cannot reschedule an appointment that is No-show',
      })
    })
  })

  describe('canCancelAppointment', () => {
    test('allows cancelling active appointment statuses', () => {
      expect(canCancelAppointment('Confirmed')).toEqual({ valid: true })
      expect(canCancelAppointment('Waiting')).toEqual({ valid: true })
    })

    test('rejects already cancelled appointment', () => {
      expect(canCancelAppointment('Cancelled')).toEqual({
        valid: false,
        status: 409,
        error: 'Appointment is already cancelled',
      })
    })

    test('rejects completed appointment', () => {
      expect(canCancelAppointment('Completed')).toEqual({
        valid: false,
        status: 409,
        error: 'Cannot cancel an appointment that is Completed',
      })
    })

    test('rejects no-show appointment', () => {
      expect(canCancelAppointment('No-show')).toEqual({
        valid: false,
        status: 409,
        error: 'Cannot cancel an appointment that is No-show',
      })
    })
  })
})