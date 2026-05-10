const {
  isJoinConfirmed,
  canJoinQueue,
  validateQueueJoin,
  isValidStatusTransition,
  getTimeFromAppointmentDatetime,
  attachSlotDatetimesToAppointments,
  findSameDayClinicAppointment,
  buildLinkedAppointmentResponse,
} = require('../../../src/queueValidation')

describe('queueValidation', () => {
  describe('isJoinConfirmed', () => {
    test('returns true only when confirmed is exactly true', () => {
      expect(isJoinConfirmed(true)).toBe(true)
      expect(isJoinConfirmed(false)).toBe(false)
      expect(isJoinConfirmed('true')).toBe(false)
      expect(isJoinConfirmed(1)).toBe(false)
      expect(isJoinConfirmed(undefined)).toBe(false)
    })
  })

  describe('canJoinQueue', () => {
    test('allows a patient to join when they have no active queue entry', () => {
      expect(canJoinQueue('patient-1', [])).toBe(true)
    })

    test('allows a patient to join when another patient has an active queue entry', () => {
      const activeQueues = [
        {
          patient_id: 'patient-2',
          clinic_id: 'clinic-a',
          status: 'Waiting',
        },
      ]

      expect(canJoinQueue('patient-1', activeQueues)).toBe(true)
    })

    test('prevents a patient from joining when they already have an active queue entry', () => {
      const activeQueues = [
        {
          patient_id: 'patient-1',
          clinic_id: 'clinic-a',
          status: 'Waiting',
        },
      ]

      expect(canJoinQueue('patient-1', activeQueues)).toBe(false)
    })

    test('prevents joining when patient already has an active queue entry at another clinic', () => {
      const activeQueues = [
        {
          patient_id: 'patient-1',
          clinic_id: 'clinic-b',
          status: 'Waiting',
        },
      ]

      expect(canJoinQueue('patient-1', activeQueues)).toBe(false)
    })

    test('allows a patient to join again when previous queue entry is Complete', () => {
      const activeQueues = [
        {
          patient_id: 'patient-1',
          clinic_id: 'clinic-a',
          status: 'Complete',
        },
      ]

      expect(canJoinQueue('patient-1', activeQueues)).toBe(true)
    })

    test('handles default empty queue input', () => {
      expect(canJoinQueue('patient-1')).toBe(true)
    })
  })

  describe('validateQueueJoin', () => {
    test('allows queue join when confirmed and no active queue entry exists', () => {
      expect(validateQueueJoin('patient-1', [], true)).toBe(true)
    })

    test('rejects queue join when action was not confirmed', () => {
      expect(validateQueueJoin('patient-1', [], false)).toBe(false)
      expect(validateQueueJoin('patient-1', [], undefined)).toBe(false)
    })

    test('rejects queue join when patient already has an active queue entry', () => {
      const activeQueues = [
        {
          patient_id: 'patient-1',
          clinic_id: 'clinic-a',
          status: 'Waiting',
        },
      ]

      expect(validateQueueJoin('patient-1', activeQueues, true)).toBe(false)
    })

    test('allows queue join when previous queue entry is Complete', () => {
      const activeQueues = [
        {
          patient_id: 'patient-1',
          clinic_id: 'clinic-a',
          status: 'Complete',
        },
      ]

      expect(validateQueueJoin('patient-1', activeQueues, true)).toBe(true)
    })

    test('handles default empty queue input when confirmed', () => {
      expect(validateQueueJoin('patient-1', undefined, true)).toBe(true)
    })
  })

  describe('isValidStatusTransition', () => {
    test.each([
      ['Waiting', 'In Consultation'],
      ['In Consultation', 'Complete'],
    ])('allows valid transition from %s to %s', (currentStatus, nextStatus) => {
      expect(isValidStatusTransition(currentStatus, nextStatus)).toBe(true)
    })

    test.each([
      ['Waiting', 'Complete'],
      ['Waiting', 'Called'],
      ['In Consultation', 'Waiting'],
      ['Complete', 'Waiting'],
      ['Complete', 'In Consultation'],
      ['Unknown', 'Waiting'],
      [undefined, 'Waiting'],
    ])('rejects invalid transition from %s to %s', (currentStatus, nextStatus) => {
      expect(isValidStatusTransition(currentStatus, nextStatus)).toBe(false)
    })
  })

  describe('getTimeFromAppointmentDatetime', () => {
    test('formats appointment datetime as Johannesburg appointment time', () => {
      expect(getTimeFromAppointmentDatetime('2099-05-11T07:45:00.000Z')).toBe(
        '09:45'
      )
    })

    test('returns existing HH:mm value without parsing', () => {
      expect(getTimeFromAppointmentDatetime('07:45')).toBe('07:45')
    })

    test('returns null for missing or invalid datetime', () => {
      expect(getTimeFromAppointmentDatetime()).toBeNull()
      expect(getTimeFromAppointmentDatetime(null)).toBeNull()
      expect(getTimeFromAppointmentDatetime('not-a-date')).toBeNull()
    })
  })

  describe('attachSlotDatetimesToAppointments', () => {
    test('attaches slot datetimes to matching appointments', () => {
      const appointments = [
        {
          id: 'appointment-1',
          clinic_id: 'clinic-1',
          slot_id: 'slot-1',
          status: 'Confirmed',
        },
        {
          id: 'appointment-2',
          clinic_id: 'clinic-1',
          slot_id: 'slot-2',
          status: 'Confirmed',
        },
      ]

      const slots = [
        {
          id: 'slot-1',
          slot_datetime: '2099-05-11T07:45:00.000Z',
        },
      ]

      expect(attachSlotDatetimesToAppointments(appointments, slots)).toEqual([
        {
          id: 'appointment-1',
          clinic_id: 'clinic-1',
          slot_id: 'slot-1',
          status: 'Confirmed',
          slot_datetime: '2099-05-11T07:45:00.000Z',
        },
        {
          id: 'appointment-2',
          clinic_id: 'clinic-1',
          slot_id: 'slot-2',
          status: 'Confirmed',
          slot_datetime: null,
        },
      ])
    })

    test('returns empty array when appointments are missing', () => {
      expect(attachSlotDatetimesToAppointments()).toEqual([])
      expect(attachSlotDatetimesToAppointments(null, null)).toEqual([])
    })
  })

  describe('findSameDayClinicAppointment', () => {
    test('finds same-day appointment at the selected clinic', () => {
      const appointments = [
        {
          id: 'wrong-clinic',
          clinic_id: 'clinic-2',
          slot_datetime: '2099-05-11T07:45:00.000Z',
        },
        {
          id: 'matching-appointment',
          clinic_id: 'clinic-1',
          slot_datetime: '2099-05-11T08:00:00.000Z',
        },
      ]

      expect(
        findSameDayClinicAppointment(appointments, 'clinic-1', '2099-05-11')
      ).toEqual({
        id: 'matching-appointment',
        clinic_id: 'clinic-1',
        slot_datetime: '2099-05-11T08:00:00.000Z',
      })
    })

    test('returns null when appointment is from a different clinic', () => {
      const appointments = [
        {
          id: 'wrong-clinic',
          clinic_id: 'clinic-2',
          slot_datetime: '2099-05-11T07:45:00.000Z',
        },
      ]

      expect(
        findSameDayClinicAppointment(appointments, 'clinic-1', '2099-05-11')
      ).toBeNull()
    })

    test('returns null when appointment is from a different day', () => {
      const appointments = [
        {
          id: 'different-day',
          clinic_id: 'clinic-1',
          slot_datetime: '2099-05-12T07:45:00.000Z',
        },
      ]

      expect(
        findSameDayClinicAppointment(appointments, 'clinic-1', '2099-05-11')
      ).toBeNull()
    })

    test('returns null when appointment has no slot datetime', () => {
      const appointments = [
        {
          id: 'missing-time',
          clinic_id: 'clinic-1',
          slot_datetime: null,
        },
      ]

      expect(
        findSameDayClinicAppointment(appointments, 'clinic-1', '2099-05-11')
      ).toBeNull()
    })

    test('returns null when no appointment list is provided', () => {
      expect(
        findSameDayClinicAppointment(undefined, 'clinic-1', '2099-05-11')
      ).toBeNull()
    })
  })

  describe('buildLinkedAppointmentResponse', () => {
    test('builds linked appointment response with appointment time', () => {
      expect(
        buildLinkedAppointmentResponse({
          id: 'appointment-1',
          status: 'Waiting',
          slot_datetime: '2099-05-11T07:45:00.000Z',
        })
      ).toEqual({
        id: 'appointment-1',
        status: 'Waiting',
        slot_datetime: '2099-05-11T07:45:00.000Z',
        appointment_time: '09:45',
      })
    })

    test('builds linked appointment response with null appointment time when slot datetime is missing', () => {
      expect(
        buildLinkedAppointmentResponse({
          id: 'appointment-1',
          status: 'Waiting',
          slot_datetime: null,
        })
      ).toEqual({
        id: 'appointment-1',
        status: 'Waiting',
        slot_datetime: null,
        appointment_time: null,
      })
    })

    test('returns null when no appointment matched', () => {
      expect(buildLinkedAppointmentResponse(null)).toBeNull()
    })
  })
})