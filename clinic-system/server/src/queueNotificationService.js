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
  const position = Number(value)
  return Number.isInteger(position) ? position : null
}
/*
function getPositionNotification(oldEntry, newEntry) {
  const oldPosition = toPosition(oldEntry?.position)
  const newPosition = toPosition(newEntry?.position)
  const type = POSITION_NOTIFICATION_TYPES[newPosition]

  if (!type || oldPosition === null || newPosition === null) return null
  if (!NOTIFIABLE_STATUSES.has(newEntry.status)) return null
  if (oldPosition <= newPosition) return null

  return {
    queue_entry_id: newEntry.id,
    patient_id: newEntry.patient_id,
    clinic_id: newEntry.clinic_id,
    type,
    position: newPosition,
  }
}*/
function getPositionNotification(oldEntry, newEntry) {
  const oldPosition = toPosition(oldEntry?.position)
  const newPosition = toPosition(newEntry?.position)


  if (![1, 2, 3].includes(newPosition)) return null

  
  if (!oldEntry) return null

  
  if (oldPosition === null || newPosition === null) return null

  
  if (newPosition >= oldPosition) return null


  if (newEntry.status === 'Complete') return null

  return {
    queue_entry_id: newEntry.id,
    patient_id: newEntry.patient_id,
    clinic_id: newEntry.clinic_id,
    type: `POSITION_${newPosition}`,
    position: newPosition,
  }
}

//

function getStatusNotification(oldEntry, newEntry) {
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
