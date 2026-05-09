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
const {
  calculateEstimatedWaitTime,
} = require('../../../src/patientValidation')

// QUEUE JOIN VALIDATION TESTS
describe('Queue join validation helpers', () => {

  //Confirms that a confirmed action is accepted
  test('returns true when the join action is confirmed', () => {
    expect(isJoinConfirmed(true)).toBe(true)
  })

  //Confirms that unconfirmed action is rejected
  test('returns false when the join action is not confirmed', () => {
    expect(isJoinConfirmed(false)).toBe(false)
  })

  //Prevent duplicate join
  test('prevents a patient from joining if they already have an active queue entry', () => {
    const activeQueues = [
      { patient_id: 'patient-1', status: 'Waiting' },
    ]

    expect(canJoinQueue('patient-1', activeQueues)).toBe(false)
  })

  // Allows join when no active queue exists
  test('allows a patient to join if they do not already have an active queue entry', () => {
    const activeQueues = [
      { patient_id: 'patient-2', status: 'Waiting' },
    ]

    expect(canJoinQueue('patient-1', activeQueues)).toBe(true)
  })

  // Reject unconfirmed join
  test('rejects queue join if the action was not confirmed', () => {
    expect(validateQueueJoin('patient-1', [], false)).toBe(false)
  })

  // Same-clinic duplicate prevention
  test('prevents a same-clinic duplicate join when the patient already has an active queue entry', () => {
    const activeQueues = [
      { patient_id: 'patient-1', clinic_id: 'clinic-a', status: 'Waiting' },
    ]

    expect(validateQueueJoin('patient-1', activeQueues, true)).toBe(false)
  })

  // Cross-clinic conflict prevention
  test('prevents a cross-clinic join when the patient already has an active queue entry in another clinic', () => {
    const activeQueues = [
      { patient_id: 'patient-1', clinic_id: 'clinic-b', status: 'Waiting' },
    ]

    expect(validateQueueJoin('patient-1', activeQueues, true)).toBe(false)
  })

  // Prevent repeated submissions creating duplicates
  test('prevents repeated join requests from creating duplicate active entries', () => {
    const activeQueues = [
      { patient_id: 'patient-1', clinic_id: 'clinic-a', status: 'Waiting' },
    ]

    expect(canJoinQueue('patient-1', activeQueues)).toBe(false)
    expect(validateQueueJoin('patient-1', activeQueues, true)).toBe(false)
  })

  // Allows rejoining after completion
  test('allows a patient to join again if their previous queue entry is Complete', () => {
    const activeQueues = [
      { patient_id: 'patient-1', clinic_id: 'clinic-a', status: 'Complete' },
    ]

    expect(canJoinQueue('patient-1', activeQueues)).toBe(true)
    expect(validateQueueJoin('patient-1', activeQueues, true)).toBe(true)
  })

  // Another patient's active queue should not block join
  test('allows join when another patient has an active queue entry', () => {
    const activeQueues = [
      { patient_id: 'patient-2', clinic_id: 'clinic-a', status: 'Waiting' },
    ]

    expect(validateQueueJoin('patient-1', activeQueues, true)).toBe(true)
  })

  // Valid join scenario
  test('allows queue join when the action is confirmed and there is no active queue entry', () => {
    expect(validateQueueJoin('patient-1', [], true)).toBe(true)
  })
})



// STATUS TRANSITION TESTS
describe('Queue status transition validation', () => {

  // Valid transitions
  //waiting->consultation
  test('allows Waiting to move to In Consultation', () => {
    expect(isValidStatusTransition('Waiting', 'In Consultation')).toBe(true)
  })

  //  consultation->complete
  test('allows In Consultation to move to Complete', () => {
    expect(isValidStatusTransition('In Consultation', 'Complete')).toBe(true)
  })

  // Invalid backward transition
  test('rejects Complete moving back to Waiting', () => {
    expect(isValidStatusTransition('Complete', 'Waiting')).toBe(false)
  })

  // Invalid direct transition
  test('rejects invalid direct transition from Waiting to Complete', () => {
    expect(isValidStatusTransition('Waiting', 'Complete')).toBe(false)
  })

  // Invalid transition from complete
  test('rejects Complete moving to In Consultation', () => {
    expect(isValidStatusTransition('Complete', 'In Consultation')).toBe(false)
  })

  // Unknown status handling
  test('rejects unknown current statuses', () => {
    expect(isValidStatusTransition('Unknown', 'Waiting')).toBe(false)
  })



})


  // ESTIMATED WAIT TIME TESTS
describe('Estimated wait time validation', () => {
  test('returns estimate not available when no staff are assigned to the clinic', () => {
    const result = calculateEstimatedWaitTime({
      patientsAhead: 3,
      appointmentDuration: 15,
      staffCount: 0,
    })

    expect(result).toEqual({
      estimatedWaitTime: null,
      message: 'Estimate not available',
    })
  })
  describe('Queue appointment sync helpers', () => {
  test('formats appointment datetime as local appointment time', () => {
    expect(getTimeFromAppointmentDatetime('2099-05-11T07:45:00.000Z')).toBe(
      '09:45'
    )
  })

  test('returns existing HH:mm value without parsing', () => {
    expect(getTimeFromAppointmentDatetime('07:45')).toBe('07:45')
  })

  test('returns null for missing or invalid datetime', () => {
    expect(getTimeFromAppointmentDatetime(null)).toBeNull()
    expect(getTimeFromAppointmentDatetime('not-a-date')).toBeNull()
  })

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

  test('does not match appointments from a different day or missing slot time', () => {
    const appointments = [
      {
        id: 'different-day',
        clinic_id: 'clinic-1',
        slot_datetime: '2099-05-12T07:45:00.000Z',
      },
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

  test('returns null linked appointment response when no appointment matched', () => {
    expect(buildLinkedAppointmentResponse(null)).toBeNull()
  })
  test('handles default empty queue inputs', () => {
  expect(canJoinQueue('patient-1')).toBe(true)
  expect(validateQueueJoin('patient-1', undefined, true)).toBe(true)
})

test('attaches no slot datetimes when appointments and slots are missing', () => {
  expect(attachSlotDatetimesToAppointments()).toEqual([])
  expect(attachSlotDatetimesToAppointments(null, null)).toEqual([])
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

test('does not match same-clinic appointment when slot date does not equal today', () => {
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
})
test('returns null when no appointment list is provided', () => {
  expect(
    findSameDayClinicAppointment(undefined, 'clinic-1', '2099-05-11')
  ).toBeNull()
})
})