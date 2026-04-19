const POSITION_NOTIFICATION_TYPES = {
  3: 'POSITION_3',
  2: 'POSITION_2',
  1: 'POSITION_1',
}

const NOTIFIABLE_STATUSES = new Set(['Waiting', 'Called'])
const CONSULTATION_STATUS = 'In Consultation'

let supabase = null

function configureQueueNotificationService(client) {
  supabase = client
}

function toPosition(value) {
  // Treat missing or malformed positions as unknown so queue resets do not emit false alerts.
  if (value === null || value === undefined || value === '') return null
  const position = Number(value)
  return Number.isInteger(position) ? position : null
}

function getPositionNotification(oldEntry, newEntry) {
  const oldPosition = toPosition(oldEntry?.position)
  const newPosition = toPosition(newEntry?.position)

  // Patients are only alerted when they newly move into the clinic's top 3 positions.
  if (![1, 2, 3].includes(newPosition)) return null

  // A previous snapshot is required to distinguish progress from a fresh queue load.
  if (!oldEntry) return null

  if (newPosition === null) return null

  // Moving away from the front, or staying in the same slot, should not duplicate alerts.
  if (oldPosition !== null && newPosition >= oldPosition) return null

  // Completed entries can remain in snapshots briefly; they should not receive queue prompts.
  if (newEntry.status === 'Complete') return null

  return {
    queue_entry_id: newEntry.id,
    patient_id: newEntry.patient_id,
    clinic_id: newEntry.clinic_id,
    type: `POSITION_${newPosition}`,
    position: newPosition,
  }
}

function getStatusNotification(oldEntry, newEntry) {
  // Consultation is a one-time transition alert, not a repeated status reminder.
  if (oldEntry?.status === CONSULTATION_STATUS) return null
  if (newEntry?.status !== CONSULTATION_STATUS) return null

  return {
    queue_entry_id: newEntry.id,
    patient_id: newEntry.patient_id,
    clinic_id: newEntry.clinic_id,
    type: 'IN_CONSULTATION',
    position: null,
  }
}

function getQueueNotificationRows(oldQueue, newQueue) {
  // Compare by queue entry id so reordered snapshots only produce real transition events.
  const oldEntriesById = new Map(
    (oldQueue || [])
      .filter((entry) => entry?.id)
      .map((entry) => [entry.id, entry])
  )

  return (newQueue || []).reduce((notifications, newEntry) => {
    const oldEntry = oldEntriesById.get(newEntry?.id)
    const positionNotification = getPositionNotification(oldEntry, newEntry)
    const statusNotification = getStatusNotification(oldEntry, newEntry)

    if (positionNotification) notifications.push(positionNotification)
    if (statusNotification) notifications.push(statusNotification)
    return notifications
  }, [])
}

async function checkAndTriggerNotifications(oldQueue, newQueue) {
  // Detection is side-effect free; persistence only happens once eligible rows exist.
  const notifications = getQueueNotificationRows(oldQueue, newQueue)

  if (notifications.length === 0) {
    return []
  }

  if (!supabase) {
    throw new Error('Queue notification service is not configured')
  }

  const createdNotifications = []

  for (const notification of notifications) {
    const createdNotification = await createNotification(notification)
    if (createdNotification) {
      createdNotifications.push(createdNotification)
    }
  }

  return createdNotifications
}

async function createNotification(notification) {
  if (!supabase) {
    throw new Error('Queue notification service is not configured')
  }

  // Insert immutable events so clients can render a history and avoid update-race ambiguity.
  const { data, error } = await supabase
    .from('queue_notifications')
    .insert({
      queue_entry_id: notification.queue_entry_id,
      patient_id: notification.patient_id,
      clinic_id: notification.clinic_id,
      type: notification.type,
      position: notification.position,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to insert queue notification:', error)
    throw error
  }

  return data || notification
}

module.exports = {
  checkAndTriggerNotifications,
  configureQueueNotificationService,
  createNotification,
  getQueueNotificationRows,
}
