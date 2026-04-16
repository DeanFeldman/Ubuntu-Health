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

  /* ── Stats ─────────────────────────────────────────── */
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
  
  .sd-stat-value--black {color: #040404;}
  .sd-stat-value--yellow  { color: #eff30c; }
  .sd-stat-value--blue { color: #59bcd7; }
  .sd-stat-value--green { color: #15803D; }

  /* ── Panel ──────────────────────────────────────────── */
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

  /* ── Table ──────────────────────────────────────────── */
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

  /* ── Badges ─────────────────────────────────────────── */
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
  .sd-badge--seen    { background: #D1FAE5; color: #065F46; }

  /* ── Action buttons ─────────────────────────────────── */
  .sd-actions {
    display: flex;
    gap: 6px;
    list-style: none;
    padding: 0;
    margin: 0;
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

  /* ── Empty state ────────────────────────────────────── */
  .sd-empty {
    padding: 3rem 1.5rem;
    text-align: center;
    color: var(--uh-muted);
    font-size: 14px;
  }

  /* ── Toast ──────────────────────────────────────────── */
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

  /* ── Modal ──────────────────────────────────────────── */
  .sd-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.4);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .sd-modal {
    background: var(--uh-surface);
    border: 1px solid var(--uh-border);
    border-radius: 14px;
    padding: 24px;
    width: 100%;
    max-width: 400px;
    box-shadow: var(--uh-shadow);
  }

  .sd-modal-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--uh-text);
    margin-bottom: 6px;
  }

  .sd-modal-desc {
    font-size: 13px;
    color: var(--uh-muted);
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .sd-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 14px;
  }

  .sd-field label {
    font-size: 12px;
    font-weight: 600;
    color: var(--uh-muted);
  }

  .sd-field input {
    padding: 9px 12px;
    border: 1px solid var(--uh-border);
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    color: var(--uh-text);
    background: var(--uh-surface);
    transition: border-color 0.15s;
    outline: none;
  }

  .sd-field input:focus {
    border-color: var(--uh-primary);
  }

  .sd-field-error {
    font-size: 12px;
    color: #B91C1C;
    margin-top: 2px;
  }

  .sd-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }

  @media (max-width: 600px) {
    .sd-table th:nth-child(3),
    .sd-table td:nth-child(3) { display: none; }
  }
`

const STATUSES = ['Waiting', 'Called', 'Seen']

const BADGE_CLASS = {
  Waiting: 'sd-badge--waiting',
  Called:  'sd-badge--called',
  Seen:    'sd-badge--seen',
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

function AddPatientModal({ onConfirm, onCancel, loading }) {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')

  const handleConfirm = () => {
    if (!name.trim()) {
      setNameError('Patient name is required.')
      return
    }
    onConfirm({ name: name.trim() })
  }

  return (
    <section
      className="sd-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-modal-title"
    >
      <article className="sd-modal">
        <h2 id="add-modal-title" className="sd-modal-title">Add patient to queue</h2>
        <p className="sd-modal-desc">Enter the patient's name to add them to the clinic queue.</p>

        <section className="sd-field">
          <label htmlFor="pt-name">Full name</label>
          <input
            id="pt-name"
            type="text"
            placeholder="e.g. Amara Nkosi"
            value={name}
            onChange={e => { setName(e.target.value); setNameError('') }}
            autoFocus
          />
          {nameError && <p className="sd-field-error">{nameError}</p>}
        </section>

        <footer className="sd-modal-actions">
          <button className="uh-btn uh-btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="uh-btn uh-btn-primary" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Adding…' : 'Add to queue'}
          </button>
        </footer>
      </article>
    </section>
  )
}

function RemoveModal({ patientName, onConfirm, onCancel, loading }) {
  return (
    <section
      className="sd-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-modal-title"
    >
      <article className="sd-modal">
        <h2 id="remove-modal-title" className="sd-modal-title">Remove patient</h2>
        <p className="sd-modal-desc">
          Remove <strong>{patientName}</strong> from the clinic queue? This cannot be undone.
        </p>
        <footer className="sd-modal-actions">
          <button className="uh-btn uh-btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className="uh-btn"
            style={{ background: '#B91C1C', color: '#fff' }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Removing…' : 'Remove'}
          </button>
        </footer>
      </article>
    </section>
  )
}

export default function StaffDashboard() {
  const { user } = useAuth()

  const [queue, setQueue]           = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [showAddModal, setShowAddModal]       = useState(false)
  const [addLoading, setAddLoading]           = useState(false)

  const [removeTarget, setRemoveTarget]       = useState(null) // { id, name }
  const [removeLoading, setRemoveLoading]     = useState(false)

  const [statusLoading, setStatusLoading]     = useState(null) // entry id being updated

  const [toast, setToast] = useState({ message: '', type: '', visible: false })

  // ── Toast helper ────────────────────────────────────────
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000)
  }, [])

  // ── Fetch queue ──────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    setFetchLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/queue', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load queue.')
      const data = await res.json()
      setQueue(data)
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setFetchLoading(false)
    }
  }, [])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  // ── Add patient ──────────────────────────────────────────
  const handleAdd = async ({ name }) => {
    setAddLoading(true)
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Could not add patient.')
      }
      const entry = await res.json()
      setQueue(q => [...q, entry])
      setShowAddModal(false)
      showToast(`${name} added to the queue.`, 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setAddLoading(false)
    }
  }

  // ── Update status ────────────────────────────────────────
  const handleStatusUpdate = async (entry) => {
    const nextStatus = STATUSES[(STATUSES.indexOf(entry.status) + 1) % STATUSES.length]
    setStatusLoading(entry.id)
    try {
      const res = await fetch(`/api/queue/${entry.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Could not update status.')
      }
      setQueue(q => q.map(e => e.id === entry.id ? { ...e, status: nextStatus } : e))
      showToast(`${entry.name} marked as ${nextStatus}.`, 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setStatusLoading(null)
    }
  }

  // ── Remove patient ───────────────────────────────────────
  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoveLoading(true)
    try {
      const res = await fetch(`/api/queue/${removeTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Could not remove patient.')
      }
      setQueue(q => q.filter(e => e.id !== removeTarget.id))
      showToast(`${removeTarget.name} removed from the queue.`, 'success')
      setRemoveTarget(null)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setRemoveLoading(false)
    }
  }

  // ── Derived stats ────────────────────────────────────────
  const stats = {
    total:   queue.length,
    waiting: queue.filter(e => e.status === 'Waiting').length,
    called:  queue.filter(e => e.status === 'Called').length,
    seen:    queue.filter(e => e.status === 'Seen').length,
  }

  return (
    <>
      <style>{styles}</style>

      <section className="sd-page">
        <h1 className="sd-heading">Clinic queue</h1>

        {/* Stats */}
        <ul className="sd-stats" aria-label="Queue summary">
          <li className="sd-stat">
            <p className="sd-stat-label">In queue</p>
            <p className="sd-stat-value sd-stat-value--black">{stats.total}</p>
          </li>
          <li className="sd-stat">
            <p className="sd-stat-label">Waiting</p>
            <p className="sd-stat-value sd-stat-value--blue">{stats.waiting}</p>
          </li>
          <li className="sd-stat">
            <p className="sd-stat-label">Called</p>
            <p className="sd-stat-value sd-stat-value--yellow">{stats.called}</p>
          </li>
          <li className="sd-stat">
            <p className="sd-stat-label">Seen</p>
            <p className="sd-stat-value sd-stat-value--green">{stats.seen}</p>
          </li>
        </ul>

        {/* Queue panel */}
        <section className="sd-panel">
          <header className="sd-panel-header">
            <h2 className="sd-panel-title">Patients</h2>
            <button
              className="uh-btn uh-btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              + Add patient
            </button>
          </header>

          {fetchLoading && (
            <p className="sd-empty">Loading queue…</p>
          )}

          {fetchError && !fetchLoading && (
            <p className="sd-empty" style={{ color: '#B91C1C' }}>
              {fetchError}{' '}
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
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((entry, i) => (
                    <tr key={entry.id}>
                      <td className="sd-pos">{i + 1}</td>
                      <td>{entry.name}</td>
                      <td>
                        <span className={`sd-badge ${BADGE_CLASS[entry.status] ?? ''}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td>
                        <ul className="sd-actions">
                          <li>
                            <button
                              className="sd-act-btn"
                              onClick={() => handleStatusUpdate(entry)}
                              disabled={statusLoading === entry.id}
                              aria-label={`Update status for ${entry.name}`}
                            >
                              {statusLoading === entry.id ? 'Saving…' : 'Update status'}
                            </button>
                          </li>
                          <li>
                            <button
                              className="sd-act-btn sd-act-btn--danger"
                              onClick={() => setRemoveTarget({ id: entry.id, name: entry.name })}
                              disabled={statusLoading === entry.id}
                              aria-label={`Remove ${entry.name} from queue`}
                            >
                              Remove
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

      {/* Modals */}
      {showAddModal && (
        <AddPatientModal
          onConfirm={handleAdd}
          onCancel={() => setShowAddModal(false)}
          loading={addLoading}
        />
      )}

      {removeTarget && (
        <RemoveModal
          patientName={removeTarget.name}
          onConfirm={handleRemove}
          onCancel={() => setRemoveTarget(null)}
          loading={removeLoading}
        />
      )}

      {/* Toast */}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </>
  )
}