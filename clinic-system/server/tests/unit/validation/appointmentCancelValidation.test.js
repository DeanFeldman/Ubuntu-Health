const {
  validateCancelRequest,
  validateAppointmentCanBeCancelled,
  buildCancelResponse,
} = require('../../../src/appointmentCancelValidation')

const validAppointmentId = '11111111-1111-4111-8111-111111111111'

function appointment(overrides = {}) {
  return {
    id: validAppointmentId,
    status: 'Confirmed',
    slot_id: 'slot-1',
    ...overrides,
  }
}

describe('appointmentCancelValidation', () => {
  describe('validateCancelRequest', () => {
    test('accepts a valid appointment ID', () => {
      expect(
        validateCancelRequest({
          appointmentId: validAppointmentId,
        })
      ).toEqual({
        valid: true,
      })
    })

    test.each([
      ['', 'appointment ID is required'],
      [null, 'appointment ID is required'],
      [undefined, 'appointment ID is required'],
    ])('rejects missing appointment ID value %s', (appointmentId, error) => {
      expect(
        validateCancelRequest({
          appointmentId,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error,
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

    test.each(['Confirmed', 'Waiting'])(
      'allows %s appointment to be cancelled',
      (status) => {
        expect(
          validateAppointmentCanBeCancelled(
            appointment({
              status,
            })
          )
        ).toEqual({
          valid: true,
        })
      }
    )

    test('allows appointment with missing status to be cancelled', () => {
      expect(
        validateAppointmentCanBeCancelled(
          appointment({
            status: undefined,
          })
        )
      ).toEqual({
        valid: true,
      })
    })

    test('rejects already cancelled appointment', () => {
      expect(
        validateAppointmentCanBeCancelled(
          appointment({
            status: 'Cancelled',
          })
        )
      ).toEqual({
        valid: false,
        status: 409,
        error: 'Appointment is already cancelled',
      })
    })

    test.each(['Completed', 'No-show'])(
      'rejects %s appointment',
      (status) => {
        expect(
          validateAppointmentCanBeCancelled(
            appointment({
              status,
            })
          )
        ).toEqual({
          valid: false,
          status: 409,
          error: `Cannot cancel an appointment that is ${status}`,
        })
      }
    )
  })

  describe('buildCancelResponse', () => {
    test('returns standard cancellation response', () => {
      const cancelledAppointment = appointment({
        status: 'Cancelled',
      })

      expect(
        buildCancelResponse({
          appointment: cancelledAppointment,
        })
      ).toEqual({
        message: 'Appointment cancelled successfully',
        appointment: cancelledAppointment,
      })
    })

    test('builds response with null appointment when passed through', () => {
      expect(
        buildCancelResponse({
          appointment: null,
        })
      ).toEqual({
        message: 'Appointment cancelled successfully',
        appointment: null,
      })
    })
  })
})