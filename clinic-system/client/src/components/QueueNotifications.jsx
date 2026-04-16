import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import getApiBase from '../lib/getApiBase'

const API_BASE =  getApiBase()

const NOTIFICATION_MESSAGES = {
  POSITION_3: 'You are now 3rd in the queue.',
  POSITION_2: 'You are now 2nd in the queue.',
  POSITION_1: 'You are next in the queue.',
}

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
    bottom: 20px;
    box-shadow: 0 16px 36px rgba(17, 24, 39, 0.22);
    color: white;
    max-width: min(360px, calc(100vw - 32px));
    padding: 14px 16px;
    position: fixed;
    right: 16px;
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
  return NOTIFICATION_MESSAGES[type] || 'Queue update available.'
}

function formatNotificationTime(createdAt) {
  if (!createdAt) return 'Time unavailable'

  return new Date(createdAt).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function QueueNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [popup, setPopup] = useState(null)
  const previousLatestId = useRef(null)
  const hasLoaded = useRef(false)

  const fetchNotifications = useCallback(async ({ showLoading = false } = {}) => {
    if (!user?.id) {
      setNotifications([])
      previousLatestId.current = null
      hasLoaded.current = false
      return
    }

    try {
      if (showLoading) setLoading(true)
      setError('')

      const response = await fetch(`${API_BASE}/api/queue-notifications/${user.id}`)
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Could not load queue notifications.')
      }

      const nextNotifications = Array.isArray(data.notifications)
        ? data.notifications
        : []
      const latestNotification = nextNotifications[0]

      setNotifications(nextNotifications)

      if (
        hasLoaded.current &&
        latestNotification?.id &&
        latestNotification.id !== previousLatestId.current
      ) {
        setPopup(latestNotification)
      }

      previousLatestId.current = latestNotification?.id || null
      hasLoaded.current = true
    } catch (err) {
      setError(err.message || 'Could not load queue notifications.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [user?.id])

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
