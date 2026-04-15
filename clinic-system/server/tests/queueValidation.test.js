const {
  isJoinConfirmed,
  canJoinQueue,
  validateQueueJoin,
  isValidStatusTransition,
} = require('../src/queueValidation')

describe('Queue join validation helpers', () => {
  test('returns true when the join action is confirmed', () => {
    expect(isJoinConfirmed(true)).toBe(true)
  })

  test('returns false when the join action is not confirmed', () => {
    expect(isJoinConfirmed(false)).toBe(false)
  })

  test('prevents a patient from joining if they already have an active queue entry', () => {
    const activeQueues = [
      { patient_id: 'patient-1', status: 'Waiting' },
    ]

    expect(canJoinQueue('patient-1', activeQueues)).toBe(false)
  })

  test('allows a patient to join if they do not already have an active queue entry', () => {
    const activeQueues = [
      { patient_id: 'patient-2', status: 'Waiting' },
    ]

    expect(canJoinQueue('patient-1', activeQueues)).toBe(true)
  })

  test('rejects queue join if the action was not confirmed', () => {
    expect(validateQueueJoin('patient-1', [], false)).toBe(false)
  })

  test('rejects queue join if the patient is already in an active queue', () => {
    const activeQueues = [
      { patient_id: 'patient-1', status: 'Waiting' },
    ]

    expect(validateQueueJoin('patient-1', activeQueues, true)).toBe(false)
  })

  test('allows queue join when the action is confirmed and there is no active queue entry', () => {
    expect(validateQueueJoin('patient-1', [], true)).toBe(true)
  })
})

describe('Queue status transition validation', () => {
  test('allows Waiting to move to In Consultation', () => {
    expect(isValidStatusTransition('Waiting', 'In Consultation')).toBe(true)
  })

  test('allows In Consultation to move to Complete', () => {
    expect(isValidStatusTransition('In Consultation', 'Complete')).toBe(true)
  })

  test('rejects Complete moving back to Waiting', () => {
    expect(isValidStatusTransition('Complete', 'Waiting')).toBe(false)
  })

  test('rejects invalid direct transition from Waiting to Complete', () => {
    expect(isValidStatusTransition('Waiting', 'Complete')).toBe(false)
  })

  test('rejects unknown current statuses', () => {
    expect(isValidStatusTransition('Unknown', 'Waiting')).toBe(false)
  })
})