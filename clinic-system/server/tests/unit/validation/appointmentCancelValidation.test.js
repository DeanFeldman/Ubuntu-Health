const {
  validateCancelRequest,
  validateAppointmentCanBeCancelled,
  buildCancelResponse,
} = require('../../../src/appointmentCancelValidation')

describe('appointmentCancelValidation', () => {
  describe('validateCancelRequest', () => {
    test('accepts a valid appointment ID', () => {
      expect(
        validateCancelRequest({
          appointmentId: '11111111-1111-4111-8111-111111111111',
        })
      ).toEqual({
        valid: true,
      })
    })

    test('rejects missing appointment ID', () => {
      expect(
        validateCancelRequest({
          appointmentId: '',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'appointment ID is required',
      })
    })

    test('rejects invalid appointment ID format', () => {
      expect(
        validateCancelRequest({
          appointmentId: 'not-a-valid-id',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid appointment ID format',
      })
    })
  })

  describe('validateAppointmentCanBeCancelled', () => {
    test('rejects missing appointment', () => {
      expect(validateAppointmentCanBeCancelled(null)).toEqual({
        valid: false,
        status: 404,
        error: 'Appointment not found',
      })
    })

    test('allows confirmed appointment to be cancelled', () => {
      expect(
        validateAppointmentCanBeCancelled({
          id: 'appointment-1',
          status: 'Confirmed',
        })
      ).toEqual({
        valid: true,
      })
    })

    test('allows waiting appointment to be cancelled', () => {
      expect(
        validateAppointmentCanBeCancelled({
          id: 'appointment-1',
          status: 'Waiting',
        })
      ).toEqual({
        valid: true,
      })
    })

    test('rejects already cancelled appointment', () => {
  expect(
    validateAppointmentCanBeCancelled({
      id: 'appointment-1',
      status: 'Cancelled',
    })
  ).toEqual({
    valid: false,
    status: 409,
    error: 'Appointment is already cancelled',
  })
})

test('rejects completed appointment', () => {
  expect(
    validateAppointmentCanBeCancelled({
      id: 'appointment-1',
      status: 'Completed',
    })
  ).toEqual({
    valid: false,
    status: 409,
    error: 'Cannot cancel an appointment that is Completed',
  })
})

test('rejects no-show appointment', () => {
  expect(
    validateAppointmentCanBeCancelled({
      id: 'appointment-1',
      status: 'No-show',
    })
  ).toEqual({
    valid: false,
    status: 409,
    error: 'Cannot cancel an appointment that is No-show',
  })
})
  })

  describe('buildCancelResponse', () => {
    test('returns standard cancellation response', () => {
      const appointment = {
        id: 'appointment-1',
        status: 'Cancelled',
        slot_id: 'slot-1',
      }

      expect(buildCancelResponse({ appointment })).toEqual({
        message: 'Appointment cancelled successfully',
        appointment,
      })
    })
    test('allows appointment with missing status to be cancelled', () => {
  expect(
    validateAppointmentCanBeCancelled({
      id: 'appointment-1',
    })
  ).toEqual({
    valid: true,
  })
})

test('builds response with null appointment when passed through', () => {
  expect(buildCancelResponse({ appointment: null })).toEqual({
    message: 'Appointment cancelled successfully',
    appointment: null,
  })
})
  })
  
})