// Checks whether the patient actually confirmed the queue join action.
// This helps us make sure a join cannot happen accidentally.
function isJoinConfirmed(confirmed) {
  return confirmed === true
}

// Checks whether the patient already has an active queue entry.
// For now, any queue entry that is not Complete counts as still active.
function canJoinQueue(patientId, activeQueues) {
  return !activeQueues.some(
    (entry) =>
      entry.patient_id === patientId &&
      entry.status !== 'Complete'
  )
}

// Main validation helper for queue joining.
// A join is only valid if the patient confirmed the action
// and does not already have an active queue entry.
function validateQueueJoin(patientId, activeQueues, confirmed) {
  if (!isJoinConfirmed(confirmed)) return false
  if (!canJoinQueue(patientId, activeQueues)) return false
  return true
}

// Checks whether a queue status change follows the expected lifecycle.
// This keeps staff from making invalid jumps between states.
function isValidStatusTransition(currentStatus, nextStatus) {
  const validTransitions = {
    Waiting: ['In Consultation'],
    'In Consultation': ['Complete'],
    Complete: [],
  }

  return validTransitions[currentStatus]?.includes(nextStatus) || false
}
// Finds a same-day appointment at the same clinic for a patient joining the queue.
// Returns the matching appointment or null if none found.
function findSameDayClinicAppointment(appointments = [], clinicId, today) {
  return (
    appointments.find(appointment => {
      if (appointment.clinic_id !== clinicId) return false
      if (!appointment.slot_datetime) return false
      return appointment.slot_datetime.slice(0, 10) === today
    }) || null
  )
}

module.exports = {
  isJoinConfirmed,
  canJoinQueue,
  validateQueueJoin,
  isValidStatusTransition,
  findSameDayClinicAppointment,
}