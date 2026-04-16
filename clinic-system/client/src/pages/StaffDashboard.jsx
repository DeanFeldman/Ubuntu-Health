import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

const styles = `
  .sd-page {
    max-width: 1100px;
    margin: 0 auto;
  }

  .sd-heading {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--uh-text);
    margin-bottom: 20px;
  }

  .sd-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
    list-style: none;
    padding: 0;
  }

  .sd-stat {
    background: var(--uh-surface);
    border: 1px solid var(--uh-border);
    border-radius: 12px;
    padding: 16px;
  }

  .sd-stat-label {
    font-size: 12px;
    color: var(--uh-muted);
    margin-bottom: 4px;
  }

  .sd-stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--uh-text);
  }

  .sd-stat-value--black { color: #040404; }
  .sd-stat-value--yellow { color: #eff30c; }
  .sd-stat-value--blue { color: #59bcd7; }
  .sd-stat-value--green { color: #15803D; }

  .sd-panel {
    background: var(--uh-surface);
    border: 1px solid var(--uh-border);
    border-radius: 12px;
    box-shadow: var(--uh-shadow);
    overflow: hidden;
  }

  .sd-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--uh-border);
    gap: 12px;
    flex-wrap: wrap;
  }

  .sd-panel-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--uh-text);
  }

  .sd-table-wrap {
    overflow-x: auto;
  }

  .sd-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .sd-table th {
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--uh-muted);
    padding: 10px 16px;
    border-bottom: 1px solid var(--uh-border);
    background: var(--uh-bg);
    white-space: nowrap;
  }

  .sd-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--uh-border);
    color: var(--uh-text);
    vertical-align: middle;
  }

  .sd-table tbody tr:last-child td {
    border-bottom: none;
  }

  .sd-table tbody tr:hover td {
    background: var(--uh-bg);
  }

  .sd-pos {
    font-weight: 600;
    color: var(--uh-muted);
    width: 40px;
  }

  .sd-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 99px;
    white-space: nowrap;
  }

  .sd-badge--waiting { background: #FEF3C7; color: #92400E; }
  .sd-badge--called  { background: #DBEAFE; color: #1E40AF; }
  .sd-badge--consultation { background: #EDE9FE; color: #6D28D9; }
  .sd-badge--complete { background: #D1FAE5; color: #065F46; }

  .sd-actions {
    display: flex;
    gap: 6px;
    list-style: none;
    padding: 0;
    margin: 0;
    flex-wrap: wrap;
  }

  .sd-act-btn {
    border: 1px solid var(--uh-border);
    background: transparent;
    border-radius: 8px;
    padding: 5px 11px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    color: var(--uh-text);
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .sd-act-btn:hover {
    background: var(--uh-bg);
    border-color: #D1D5DB;
  }

  .sd-act-btn--danger {
    color: #B91C1C;
    border-color: #FECACA;
  }

  .sd-act-btn--danger:hover {
    background: #FEF2F2;
  }

  .sd-empty {
    padding: 3rem 1.5rem;
    text-align: center;
    color: var(--uh-muted);
    font-size: 14px;
  }

  .sd-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--uh-surface);
    border: 1px solid var(--uh-border);
    border-radius: 10px;
    padding: 12px 20px;
    font-size: 13px;
    font-weight: 500;
    color: var(--uh-text);
    z-index: 200;
    box-shadow: 0 4px 20px rgba(17,24,39,0.1);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .sd-toast--visible { opacity: 1; }
  .sd-toast--success { border-left: 3px solid #15803D; color: #15803D; }
  .sd-toast--error   { border-left: 3px solid #B91C1C; color: #B91C1C; }
`

const STATUS_SEQUENCE = ['Waiting', 'Called', 'In Consultation', 'Complete']

const BADGE_CLASS = {
  Waiting: 'sd-badge--waiting',
  Called: 'sd-badge--called',
  'In Consultation': 'sd-badge--consultation',
  Complete: 'sd-badge--complete',
}

function Toast({ message, type, visible }) {
  return (
    <aside
      role="alert"
      aria-live="polite"
      className={`sd-toast${visible ? ' sd-toast--visible' : ''}${type ? ` sd-toast--${type}` : ''}`}
    >
      {message}
    </aside>
  )
}

function getDisplayName(entry) {
  return entry.patient?.full_name || entry.patient_id
}
export default function StaffDashboard() {
  const { user, clinicId, loading: authLoading } = useAuth()
  const resolvedClinicId = clinicId || user?.clinic_id || null
  const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

  const [queue, setQueue] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [statusLoading, setStatusLoading] = useState(null)
  const [removeLoading, setRemoveLoading] = useState(null)
  const [toast, setToast] = useState({ message: '', type: '', visible: false })

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, visible: true })
    setTimeout(() => {
      setToast(current => ({ ...current, visible: false }))
    }, 3000)
  }, [])

  const fetchQueue = useCallback(async () => {
    if (authLoading) return

    if (!resolvedClinicId) {
      setFetchError('No clinic is linked to this staff account.')
      setFetchLoading(false)
      return
    }

    setFetchLoading(true)
    setFetchError(null)

    try {
      const res = await fetch(`${API_BASE}/api/queue/${resolvedClinicId}`, {
        headers: { Accept: 'application/json' },
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load queue.')
      }

      setQueue(Array.isArray(data.queue) ? data.queue : [])
      console.log('FIRST ENTRY PATIENT:', data.queue[0]?.patient)
      console.log('FIRST ENTRY NAME:', data.queue[0]?.patient?.full_name)
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setFetchLoading(false)
    }
  }, [authLoading, resolvedClinicId])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const handleStatusUpdate = async entry => {
    const currentIndex = STATUS_SEQUENCE.indexOf(entry.status)
    const nextStatus =
      currentIndex >= 0 && currentIndex < STATUS_SEQUENCE.length - 1
        ? STATUS_SEQUENCE[currentIndex + 1]
        : null

    if (!nextStatus) {
      showToast('This queue entry cannot move to another status.', 'error')
      return
    }

    setStatusLoading(entry.id)

    try {
      const res = await fetch(`${API_BASE}/api/queue/${resolvedClinicId}/entry/${entry.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Could not update status.')
      }

      setQueue(current =>
        current.map(item => (item.id === entry.id ? data.entry : item))
      )

      showToast(`${getDisplayName(entry)} marked as ${nextStatus}.`, 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setStatusLoading(null)
    }
  }

  const handleRemove = async entry => {
    setRemoveLoading(entry.id)

    try {
      const res = await fetch(`${API_BASE}/api/queue/${resolvedClinicId}/entry/${entry.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Could not remove patient.')
      }

      setQueue(current => current.filter(item => item.id !== entry.id))
      showToast(`${getDisplayName(entry)} removed from the queue.`, 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setRemoveLoading(null)
    }
  }

  const stats = {
    total: queue.length,
    waiting: queue.filter(entry => entry.status === 'Waiting').length,
    called: queue.filter(entry => entry.status === 'Called').length,
    complete: queue.filter(entry => entry.status === 'Complete').length,
  }

  return (
    <>
      <style>{styles}</style>

      <section className="sd-page">
        <h1 className="sd-heading">Clinic queue</h1>

        <ul className="sd-stats" aria-label="Queue summary">
          <li className="sd-stat">
            <p className="sd-stat-label">Waiting</p>
            <p className="sd-stat-value sd-stat-value--blue">{stats.waiting}</p>
          </li>
          <li className="sd-stat">
            <p className="sd-stat-label">In Consultation</p>
            <p className="sd-stat-value sd-stat-value--yellow">{stats.called}</p>
          </li>
          <li className="sd-stat">
            <p className="sd-stat-label">Complete</p>
            <p className="sd-stat-value sd-stat-value--green">{stats.complete}</p>
          </li>
        </ul>

        <section className="sd-panel">
          <header className="sd-panel-header">
            <h2 className="sd-panel-title">Patients</h2>
          </header>

          {fetchLoading && <p className="sd-empty">Loading queue…</p>}

          {fetchError && !fetchLoading && (
            <p className="sd-empty" style={{ color: '#B91C1C' }}>
              {fetchError}
              <button
                className="sd-act-btn"
                style={{ display: 'inline', marginLeft: 8 }}
                onClick={fetchQueue}
              >
                Retry
              </button>
            </p>
          )}

          {!fetchLoading && !fetchError && queue.length === 0 && (
            <p className="sd-empty">No patients in queue right now.</p>
          )}

          {!fetchLoading && !fetchError && queue.length > 0 && (
            <section className="sd-table-wrap">
              <table className="sd-table" aria-label="Patient queue">
                <thead>
                  <tr>
                    <th className="sd-pos">#</th>
                    <th>Patient</th>
                    <th>Patient ID</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((entry, index) => (
                    <tr key={entry.id}>
                      <td className="sd-pos">{entry.position ?? index + 1}</td>
                      <td>{getDisplayName(entry)}</td>
                      <td>{entry.patient_id}</td>
                      <td>
                        <span className={`sd-badge ${BADGE_CLASS[entry.status] ?? ''}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td>
                        <ul className="sd-actions">
                          {entry.status !== 'Complete' && (
                            <li>
                              <button
                                className="sd-act-btn"
                                onClick={() => handleStatusUpdate(entry)}
                                disabled={statusLoading === entry.id}
                              >
                                {statusLoading === entry.id ? 'Saving…' : 'Next status'}
                              </button>
                            </li>
                          )}
                          <li>
                            <button
                              className="sd-act-btn sd-act-btn--danger"
                              onClick={() => handleRemove(entry)}
                              disabled={removeLoading === entry.id}
                            >
                              {removeLoading === entry.id ? 'Removing…' : 'Remove'}
                            </button>
                          </li>
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </section>
      </section>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </>
  )
}