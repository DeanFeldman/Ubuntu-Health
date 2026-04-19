import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import getApiBase from '../lib/getApiBase'


const API_BASE = getApiBase()

const NOTIFICATION_MESSAGES = {
  POSITION_3: 'You are now 3rd in the queue',
  POSITION_2: 'You are now 2nd in the queue',
  POSITION_1: 'You are next in line',
  IN_CONSULTATION: 'Please proceed to consultation',
}

const BROWSER_NOTIFICATION_TITLE = 'Ubuntu Health queue update'
const DISPLAYED_NOTIFICATIONS_KEY_PREFIX = 'queueNotificationsDisplayed'

const styles = `
  .queue-notifications {
    margin-top: 20px;
  }

  .queue-notifications h2 {
    font-size: 1.1rem;
    margin-bottom: 12px;
  }

  .queue-notifications-list {
    display: grid;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .queue-notification {
    border: 1px solid var(--uh-border);
    border-radius: 8px;
    padding: 12px;
  }

  .queue-notification-message {
    font-weight: 700;
    margin: 0 0 4px;
  }

  .queue-notification-time {
    color: var(--uh-muted);
    font-size: 0.88rem;
  }

  .queue-notification-popup {
    background: #111827;
    border-radius: 8px;
    box-shadow: 0 16px 36px rgba(17, 24, 39, 0.22);
    color: white;
    left: 50%;
    max-width: min(360px, calc(100vw - 32px));
    padding: 14px 16px;
    position: fixed;
    top: 84px;
    transform: translateX(-50%);
    z-index: 50;
  }

  .queue-notification-popup p {
    font-weight: 700;
    margin: 0 0 4px;
  }

  .queue-notification-popup time {
    color: rgba(255, 255, 255, 0.78);
    font-size: 0.88rem;
  }
`

function getNotificationMessage(type) {
  return NOTIFICATION_MESSAGES[type] || 'Queue update available'
}

function triggerBrowserNotification(notification) {
  console.log('[QueueNotifications] Browser notification requested', {
    notification,
    notificationSupported: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    isSecureContext: window.isSecureContext,
    visibilityState: document.visibilityState,
  })

  if (!notification) {
    console.log('[QueueNotifications] Browser notification skipped: missing notification')
    return
  }

  if (!('Notification' in window)) {
    console.log('[QueueNotifications] Browser notification skipped: Notification API not supported')
    return
  }

  if (Notification.permission !== 'granted') {
    console.log('[QueueNotifications] Browser notification skipped: permission is not granted', {
      permission: Notification.permission
    })
    return
  }

  try {
    const browserNotification = new Notification(BROWSER_NOTIFICATION_TITLE, {
      body: getNotificationMessage(notification.type),
    })

    console.log('[QueueNotifications] Browser notification created', {
      title: BROWSER_NOTIFICATION_TITLE,
      body: getNotificationMessage(notification.type),
      notificationId: notification.id,
      browserNotification,
    })
  } catch (err) {
    console.error('[QueueNotifications] Browser notification failed', err)
  }
}

function playNotificationSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext

  if (!AudioContext) return

  try {
    const audioContext = new AudioContext()
    const gainNode = audioContext.createGain()

    gainNode.connect(audioContext.destination)
    gainNode.gain.setValueAtTime(0.001, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.42)

    ;[880, 1175].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator()
      const startTime = audioContext.currentTime + index * 0.12

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, startTime)
      oscillator.connect(gainNode)
      oscillator.start(startTime)
      oscillator.stop(startTime + 0.18)
    })

    setTimeout(() => {
      audioContext.close()
    }, 600)
  } catch (err) {
    console.error('[QueueNotifications] Notification sound failed', err)
  }
}

function formatNotificationTime(createdAt) {
  if (!createdAt) return 'Time unavailable'

  return new Date(`${createdAt}Z`).toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  })
}

function getDisplayedNotificationsKey(queueEntryId) {
  return `${DISPLAYED_NOTIFICATIONS_KEY_PREFIX}:${queueEntryId}`
}

function getDisplayedNotificationIds(queueEntryId) {
  if (!queueEntryId) return new Set()

  try {
    const storedIds = JSON.parse(localStorage.getItem(getDisplayedNotificationsKey(queueEntryId)) || '[]')
    return new Set(Array.isArray(storedIds) ? storedIds : [])
  } catch {
    return new Set()
  }
}

function markNotificationDisplayed(queueEntryId, notificationId) {
  if (!queueEntryId || !notificationId) return

  try {
    const displayedIds = getDisplayedNotificationIds(queueEntryId)
    displayedIds.add(notificationId)
    localStorage.setItem(
      getDisplayedNotificationsKey(queueEntryId),
      JSON.stringify([...displayedIds].slice(-20))
    )
  } catch {
    // Non-fatal. In-memory duplicate protection still works until reload.
  }
}

export default function QueueNotifications({ queueEntry }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [popup, setPopup] = useState(null)
  const previousLatestId = useRef(null)
  
  useEffect(() => {
    setNotifications([])
    setPopup(null)
    previousLatestId.current = null
  }, [queueEntry?.id])


  useEffect(() => {
    console.log('[QueueNotifications] Notification permission check on mount', {
      notificationSupported: 'Notification' in window,
      permission: 'Notification' in window ? Notification.permission : 'unsupported',
      isSecureContext: window.isSecureContext,
      visibilityState: document.visibilityState,
    })

    if (!('Notification' in window)) {
      console.log('[QueueNotifications] Permission request skipped: Notification API not supported')
      return
    }

    if (Notification.permission !== 'default') {
      console.log('[QueueNotifications] Permission request skipped: existing permission state', {
        permission: Notification.permission,
      })
      return
    }

    Notification.requestPermission()
      .then((permission) => {
        console.log('[QueueNotifications] Permission request resolved', { permission })
      })
      .catch((err) => {
        console.error('[QueueNotifications] Permission request failed', err)
      })
  }, [])

  const fetchNotifications = useCallback(async ({ showLoading = false } = {}) => {
    if (!user?.id || !queueEntry?.id) {
      setNotifications([])
      setPopup(null)
      previousLatestId.current = null
      
      return
    }

    try {
      if (showLoading) setLoading(true)
      setError('')

      const params = new URLSearchParams({
        queue_entry_id: queueEntry.id,
      })
      const response = await fetch(`${API_BASE}/api/queue-notifications/${user.id}?${params}`)
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Could not load queue notifications.')
      }

      const nextNotifications = Array.isArray(data.notifications)
        ? data.notifications
        : []

      if (nextNotifications.length === 0) {
        setNotifications([])
        setPopup(null)
        previousLatestId.current = null
        return
      }

      const latestNotification = nextNotifications[0]

      setNotifications(nextNotifications)

      if (latestNotification?.id) {
        const displayedIds = getDisplayedNotificationIds(queueEntry.id)
        const hasAlreadyDisplayed = displayedIds.has(latestNotification.id)

        if (
          latestNotification.id !== previousLatestId.current &&
          !hasAlreadyDisplayed
        ) {
          console.log('[QueueNotifications] New queue notification detected', {
            latestNotification,
            previousLatestId: previousLatestId.current,
          })

          setPopup(latestNotification)
          playNotificationSound()
          triggerBrowserNotification(latestNotification)
          markNotificationDisplayed(queueEntry.id, latestNotification.id)
        }

        previousLatestId.current = latestNotification.id
      }

      
    } catch (err) {
      setError(err.message || 'Could not load queue notifications.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [queueEntry?.id, user?.id])

  useEffect(() => {
    fetchNotifications({ showLoading: true })

    const intervalId = setInterval(() => {
      fetchNotifications()
    }, 5000)

    return () => clearInterval(intervalId)
  }, [fetchNotifications])

  useEffect(() => {
    if (!popup) return undefined

    const timeoutId = setTimeout(() => {
      setPopup(null)
    }, 5000)

    return () => clearTimeout(timeoutId)
  }, [popup])

  return (
    <section className="queue-notifications" aria-labelledby="queue-notifications-heading">
      <style>{styles}</style>
      <h2 id="queue-notifications-heading">Queue notifications</h2>

      {loading && <p>Loading notifications...</p>}
      {error && (
        <p role="alert">
          {error}
        </p>
      )}
      {!loading && !error && notifications.length === 0 && (
        <p>No queue notifications yet.</p>
      )}
      {!loading && !error && notifications.length > 0 && (
        <ul className="queue-notifications-list">
          {notifications.map((notification) => (
            <li className="queue-notification" key={notification.id}>
              <p className="queue-notification-message">
                {getNotificationMessage(notification.type)}
              </p>
              <time
                className="queue-notification-time"
                dateTime={notification.created_at}
              >
                {formatNotificationTime(notification.created_at)}
              </time>
            </li>
          ))}
        </ul>
      )}

      {popup && (
        <aside className="queue-notification-popup" role="status" aria-live="polite">
          <p>{getNotificationMessage(popup.type)}</p>
          <time dateTime={popup.created_at}>
            {formatNotificationTime(popup.created_at)}
          </time>
        </aside>
      )}
    </section>
  )
}
