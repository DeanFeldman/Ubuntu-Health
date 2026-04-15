const {
  isJoinConfirmed,
  canJoinQueue,
  validateQueueJoin,
  isValidStatusTransition,
} = require('../src/queueValidation')

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

  // Unknown status handling
  test('rejects unknown current statuses', () => {
    expect(isValidStatusTransition('Unknown', 'Waiting')).toBe(false)
  })
})