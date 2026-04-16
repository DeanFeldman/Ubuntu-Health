const POSITION_NOTIFICATION_TYPES = {
  3: 'POSITION_3',
  2: 'POSITION_2',
  1: 'POSITION_1',
}

const NOTIFIABLE_STATUSES = new Set(['Waiting', 'Called'])

let supabase = null

function configureQueueNotificationService(client) {
  supabase = client
}

function toPosition(value) {
  const position = Number(value)
  return Number.isInteger(position) ? position : null
}

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
}

function getQueueNotificationRows(oldQueue, newQueue) {
  const oldEntriesById = new Map(
    (oldQueue || [])
      .filter((entry) => entry?.id)
      .map((entry) => [entry.id, entry])
  )

  return (newQueue || []).reduce((notifications, newEntry) => {
    const oldEntry = oldEntriesById.get(newEntry?.id)
    const notification = getPositionNotification(oldEntry, newEntry)

    if (notification) notifications.push(notification)
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

  const { data: existingNotification, error: fetchError } = await supabase
    .from('queue_notifications')
    .select('id')
    .eq('queue_entry_id', notification.queue_entry_id)
    .eq('type', notification.type)
    .maybeSingle()

  if (fetchError) throw fetchError

  if (existingNotification) {
    return null
  }

  const { data, error } = await supabase
    .from('queue_notifications')
    .insert(notification)
    .select()
    .single()

  if (error) throw error

  return data || notification
}

module.exports = {
  checkAndTriggerNotifications,
  configureQueueNotificationService,
  createNotification,
  getQueueNotificationRows,
}
