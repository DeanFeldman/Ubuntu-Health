const {
  validateRescheduleRequest,
  canUseRescheduleSlot,
  buildRescheduleResponse,
} = require('../../../src/appointmentRescheduleValidation')

describe('appointmentRescheduleValidation', () => {
  describe('validateRescheduleRequest', () => {
    test('accepts valid reschedule input and normalizes time', () => {
  expect(
    validateRescheduleRequest({
      appointmentId: 'appointment-1',
      date: '2099-05-11',
      time: '09:15',
    })
  ).toEqual({
    valid: true,
    normalizedTime: '09:15',
  })
})

    test('rejects missing appointment ID', () => {
      expect(
        validateRescheduleRequest({
          appointmentId: '',
          date: '2099-05-11',
          time: '09:15',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'appointment ID is required',
      })
    })

    test('rejects missing date', () => {
      expect(
        validateRescheduleRequest({
          appointmentId: 'appointment-1',
          time: '09:15',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'date is required',
      })
    })

    test('rejects missing time', () => {
      expect(
        validateRescheduleRequest({
          appointmentId: 'appointment-1',
          date: '2099-05-11',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'time is required',
      })
    })

    test('rejects invalid date format', () => {
      expect(
        validateRescheduleRequest({
          appointmentId: 'appointment-1',
          date: '11-05-2099',
          time: '09:15',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid date format',
      })
    })

    test('rejects invalid time format', () => {
      expect(
        validateRescheduleRequest({
          appointmentId: 'appointment-1',
          date: '2099-05-11',
          time: 'bad-time',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid time format',
      })
    })
  })

  describe('canUseRescheduleSlot', () => {
    test('allows slot when booked count is below staff capacity', () => {
      expect(
        canUseRescheduleSlot({
          existingAppointments: [{ id: 'appointment-2' }],
          staffCount: 2,
        })
      ).toEqual({
        valid: true,
        bookedCount: 1,
        capacity: 2,
      })
    })

    test('allows empty slot', () => {
      expect(
        canUseRescheduleSlot({
          existingAppointments: [],
          staffCount: 1,
        })
      ).toEqual({
        valid: true,
        bookedCount: 0,
        capacity: 1,
      })
    })

    test('rejects slot when booked count equals staff capacity', () => {
      expect(
        canUseRescheduleSlot({
          existingAppointments: [{ id: 'appointment-2' }],
          staffCount: 1,
        })
      ).toEqual({
        valid: false,
        status: 409,
        error: 'This slot is already booked',
      })
    })

    test('rejects slot when booked count exceeds staff capacity', () => {
      expect(
        canUseRescheduleSlot({
          existingAppointments: [
            { id: 'appointment-2' },
            { id: 'appointment-3' },
          ],
          staffCount: 1,
        })
      ).toEqual({
        valid: false,
        status: 409,
        error: 'This slot is already booked',
      })
    })
    test('treats a single non-array existing appointment as one booking', () => {
  expect(
    canUseRescheduleSlot({
      existingAppointments: { id: 'appointment-2' },
      staffCount: 2,
    })
  ).toEqual({
    valid: true,
    bookedCount: 1,
    capacity: 2,
  })
})

test('treats missing existing appointments as zero bookings', () => {
  expect(
    canUseRescheduleSlot({
      existingAppointments: null,
      staffCount: 1,
    })
  ).toEqual({
    valid: true,
    bookedCount: 0,
    capacity: 1,
  })
})

test('defaults invalid staff capacity to one when slot is empty', () => {
  expect(
    canUseRescheduleSlot({
      existingAppointments: [],
      staffCount: 'not-a-number',
    })
  ).toEqual({
    valid: true,
    bookedCount: 0,
    capacity: 1,
  })
})

    test('defaults invalid staff capacity to one', () => {
      expect(
        canUseRescheduleSlot({
          existingAppointments: [{ id: 'appointment-2' }],
          staffCount: 0,
        })
      ).toEqual({
        valid: false,
        status: 409,
        error: 'This slot is already booked',
      })
    })
  })

  describe('buildRescheduleResponse', () => {
    test('returns response with updated appointment and slot swap IDs', () => {
      expect(
        buildRescheduleResponse({
          appointment: {
            id: 'appointment-1',
          },
          updatedAppointment: {
            id: 'appointment-1',
            slot_id: 'slot-new',
            status: 'Confirmed',
          },
          oldSlotId: 'slot-old',
          newSlot: {
            id: 'slot-new',
            slot_datetime: '2099-05-11T09:15:00.000Z',
          },
        })
      ).toEqual({
        success: true,
        message: 'Appointment rescheduled successfully',
        appointment: {
          id: 'appointment-1',
          slot_id: 'slot-new',
          status: 'Confirmed',
          slot_datetime: '2099-05-11T09:15:00.000Z',
        },
        old_slot_id: 'slot-old',
        new_slot_id: 'slot-new',
      })
    })
  })
})