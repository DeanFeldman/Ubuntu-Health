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
    test('defines all supported appointment statuses', () => {
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

    test('trims status values', () => {
      expect(normalizeAppointmentStatus(' Completed ')).toBe('Completed')
    })

    test.each([
      ['Pending', 'Confirmed'],
      ['Rescheduled', 'Confirmed'],
      ['Complete', 'Completed'],
      ['NoShow', 'No-show'],
      ['No_Show', 'No-show'],
      ['No-show', 'No-show'],
    ])('maps legacy status %s to %s', (input, expected) => {
      expect(normalizeAppointmentStatus(input)).toBe(expected)
    })

    test('returns unknown statuses unchanged after trimming', () => {
      expect(normalizeAppointmentStatus('Unknown')).toBe('Unknown')
    })
  })

  describe('isValidAppointmentStatus', () => {
    test.each([
      'Confirmed',
      'Waiting',
      'Completed',
      'Cancelled',
      'No-show',
    ])('returns true for valid status %s', (status) => {
      expect(isValidAppointmentStatus(status)).toBe(true)
    })

    test.each([
      'Pending',
      'Complete',
      'NoShow',
      'Unknown',
      '',
      null,
      undefined,
    ])('returns false for invalid status %s', (status) => {
      expect(isValidAppointmentStatus(status)).toBe(false)
    })
  })

  describe('isFinalAppointmentStatus', () => {
    test.each(['Cancelled', 'Completed', 'No-show'])(
      'returns true for final status %s',
      (status) => {
        expect(isFinalAppointmentStatus(status)).toBe(true)
      }
    )

    test.each(['Confirmed', 'Waiting', 'Pending', null, undefined])(
      'returns false for non-final status %s',
      (status) => {
        expect(isFinalAppointmentStatus(status)).toBe(false)
      }
    )
  })

  describe('canMarkAppointmentStatus', () => {
    test.each([
      ['Completed', 'Completed'],
      ['Complete', 'Completed'],
      ['No-show', 'No-show'],
      ['NoShow', 'No-show'],
      ['No_Show', 'No-show'],
    ])(
      'allows marking an active appointment as %s',
      (nextStatus, normalizedStatus) => {
        expect(canMarkAppointmentStatus('Confirmed', nextStatus)).toEqual({
          valid: true,
          normalizedStatus,
        })
      }
    )

    test('rejects unsupported next statuses', () => {
      expect(canMarkAppointmentStatus('Confirmed', 'Cancelled')).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid appointment status',
      })

      expect(canMarkAppointmentStatus('Confirmed', 'Waiting')).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid appointment status',
      })
    })

    test.each(['Cancelled', 'Completed', 'No-show'])(
      'rejects marking appointment when current status is already final: %s',
      (currentStatus) => {
        expect(canMarkAppointmentStatus(currentStatus, 'Completed')).toEqual({
          valid: false,
          status: 409,
          error: `Appointment is already ${currentStatus}`,
        })
      }
    )

    test('rejects marking a future appointment as No-show', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)

      expect(
        canMarkAppointmentStatus('Confirmed', 'No-show', futureDate.toISOString())
      ).toEqual({
        valid: false,
        status: 409,
        error: 'Cannot mark a future appointment as No-show',
      })
    })

    test('allows marking a past appointment as No-show', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      expect(
        canMarkAppointmentStatus('Confirmed', 'No-show', pastDate.toISOString())
      ).toEqual({
        valid: true,
        normalizedStatus: 'No-show',
      })
    })

    test('allows No-show when appointment datetime is invalid', () => {
      expect(
        canMarkAppointmentStatus('Confirmed', 'No-show', 'not-a-date')
      ).toEqual({
        valid: true,
        normalizedStatus: 'No-show',
      })
    })

    test('allows Completed even when appointment datetime is in the future', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)

      expect(
        canMarkAppointmentStatus('Confirmed', 'Completed', futureDate.toISOString())
      ).toEqual({
        valid: true,
        normalizedStatus: 'Completed',
      })
    })
  })

  describe('canRescheduleAppointment', () => {
    test.each(['Confirmed', 'Waiting', undefined, null])(
      'allows rescheduling appointment with status %s',
      (currentStatus) => {
        expect(canRescheduleAppointment(currentStatus)).toEqual({
          valid: true,
        })
      }
    )

    test.each(['Cancelled', 'Completed', 'No-show'])(
      'rejects rescheduling appointment with final status %s',
      (currentStatus) => {
        expect(canRescheduleAppointment(currentStatus)).toEqual({
          valid: false,
          status: 409,
          error: `Cannot reschedule an appointment that is ${currentStatus}`,
        })
      }
    )
  })

  describe('canCancelAppointment', () => {
    test.each(['Confirmed', 'Waiting', undefined, null])(
      'allows cancelling appointment with status %s',
      (currentStatus) => {
        expect(canCancelAppointment(currentStatus)).toEqual({
          valid: true,
        })
      }
    )

    test('rejects already cancelled appointment', () => {
      expect(canCancelAppointment('Cancelled')).toEqual({
        valid: false,
        status: 409,
        error: 'Appointment is already cancelled',
      })
    })

    test.each(['Completed', 'No-show'])(
      'rejects cancelling appointment with status %s',
      (currentStatus) => {
        expect(canCancelAppointment(currentStatus)).toEqual({
          valid: false,
          status: 409,
          error: `Cannot cancel an appointment that is ${currentStatus}`,
        })
      }
    )
  })
})