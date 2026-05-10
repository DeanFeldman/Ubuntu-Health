const {
  validateRescheduleRequest,
  canUseRescheduleSlot,
  buildRescheduleResponse,
} = require('../../../src/appointmentRescheduleValidation')

const validRequest = {
  appointmentId: 'appointment-1',
  date: '2099-05-11',
  time: '09:15',
}

function existingAppointment(id = 'appointment-2') {
  return { id }
}

describe('appointmentRescheduleValidation', () => {
  describe('validateRescheduleRequest', () => {
    test('accepts valid reschedule input and normalizes time', () => {
      expect(validateRescheduleRequest(validRequest)).toEqual({
        valid: true,
        normalizedTime: '09:15',
      })
    })

    test('normalizes datetime values to Johannesburg HH:mm time', () => {
    expect(
        validateRescheduleRequest({
          ...validRequest,
          time: '2099-05-11T10:30:00.000Z',
        })
      ).toEqual({
      valid: true,
      normalizedTime: '12:30',
    })
  })

    test.each([
      ['appointmentId', 'appointment ID is required'],
      ['date', 'date is required'],
      ['time', 'time is required'],
    ])('rejects missing %s', (field, error) => {
      const request = { ...validRequest }
      delete request[field]

      expect(validateRescheduleRequest(request)).toEqual({
        valid: false,
        status: 400,
        error,
      })
    })

    test.each([
      '11-05-2099',
      '2099/05/11',
      '2099-02-30',
      'bad-date',
    ])('rejects invalid date value %s', (date) => {
      expect(
        validateRescheduleRequest({
          ...validRequest,
          date,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid date format',
      })
    })

    test.each([
      'bad-time',
      '25:00',
    ])('rejects invalid time value %s', (time) => {
      expect(
        validateRescheduleRequest({
          ...validRequest,
          time,
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
          existingAppointments: [existingAppointment()],
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

    test('treats a single non-array existing appointment as one booking', () => {
      expect(
        canUseRescheduleSlot({
          existingAppointments: existingAppointment(),
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

    test.each([
      [1, 1],
      [2, 1],
    ])(
      'rejects slot when booked count %i is greater than or equal to staff capacity %i',
      (bookedCount, staffCount) => {
        const existingAppointments = Array.from(
          { length: bookedCount },
          (_, index) => existingAppointment(`appointment-${index + 1}`)
        )

        expect(
          canUseRescheduleSlot({
            existingAppointments,
            staffCount,
          })
        ).toEqual({
          valid: false,
          status: 409,
          error: 'This slot is already booked',
        })
      }
    )

    test.each([
      0,
      -1,
      null,
      undefined,
      'not-a-number',
    ])('defaults invalid staff capacity %s to one when slot is empty', (staffCount) => {
      expect(
        canUseRescheduleSlot({
          existingAppointments: [],
          staffCount,
        })
      ).toEqual({
        valid: true,
        bookedCount: 0,
        capacity: 1,
      })
    })

    test.each([
      0,
      -1,
      null,
      undefined,
      'not-a-number',
    ])('defaults invalid staff capacity %s to one when slot has one booking', (staffCount) => {
      expect(
        canUseRescheduleSlot({
          existingAppointments: [existingAppointment()],
          staffCount,
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

    test('preserves other updated appointment fields in the response', () => {
      expect(
        buildRescheduleResponse({
          appointment: {
            id: 'appointment-1',
          },
          updatedAppointment: {
            id: 'appointment-1',
            slot_id: 'slot-new',
            status: 'Confirmed',
            service: 'General consultation',
          },
          oldSlotId: 'slot-old',
          newSlot: {
            id: 'slot-new',
            slot_datetime: '2099-05-11T09:15:00.000Z',
          },
        }).appointment
      ).toEqual({
        id: 'appointment-1',
        slot_id: 'slot-new',
        status: 'Confirmed',
        service: 'General consultation',
        slot_datetime: '2099-05-11T09:15:00.000Z',
      })
    })
  })
})