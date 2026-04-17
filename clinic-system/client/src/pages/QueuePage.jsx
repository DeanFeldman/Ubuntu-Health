import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import QueueNotifications from '../components/QueueNotifications'
import getApiBase from '../lib/getApiBase'
// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = `
  .q-page {
    max-width: 680px;
    margin: 0 auto;
    padding: 0 0 60px;
  }

  .q-page-header {
    margin-bottom: 28px;
  }
  .q-page-header h1 {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--uh-text);
    margin-bottom: 4px;
  }
  .q-page-header p {
    color: var(--uh-muted);
    font-size: 14px;
  }

  .q-card {
    background: var(--uh-surface);
    border-radius: 20px;
    box-shadow: var(--uh-shadow);
    border: 1px solid var(--uh-border);
    padding: 28px;
    margin-bottom: 16px;
  }

  .q-status-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 22px;
  }
  .q-status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .q-status-dot.waiting  { background: #F59E0B; box-shadow: 0 0 0 3px rgba(245,158,11,0.2); }
  .q-status-dot.called   { background: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.2); animation: q-pulse 1.4s ease-in-out infinite; }
  .q-status-dot.served   { background: #10B981; box-shadow: 0 0 0 3px rgba(16,185,129,0.2); }
  .q-status-dot.skipped  { background: #EF4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.2); }

  @keyframes q-pulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(37,99,235,0.2); }
    50% { box-shadow: 0 0 0 6px rgba(37,99,235,0.1); }
  }

  .q-status-label {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--uh-muted);
  }

  .q-position-hero {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 22px 0;
    border-top: 1px solid var(--uh-border);
    border-bottom: 1px solid var(--uh-border);
    margin-bottom: 22px;
  }
  .q-position-number {
    font-size: 3.5rem;
    font-weight: 900;
    color: var(--uh-primary);
    line-height: 1;
    min-width: 80px;
    text-align: center;
  }
  .q-position-label {
    font-size: 13px;
    color: var(--uh-muted);
    font-weight: 500;
    text-align: center;
    margin-top: 4px;
  }
  .q-position-divider {
    width: 1px;
    height: 56px;
    background: var(--uh-border);
    flex-shrink: 0;
  }
  .q-position-info {
    flex: 1;
  }
  .q-position-info h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--uh-text);
    margin-bottom: 4px;
  }
  .q-position-info p {
    font-size: 13px;
    color: var(--uh-muted);
  }

  .q-detail-grid {
    display: grid;
    gap: 10px;
  }
  .q-detail-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    font-size: 14px;
  }
  .q-detail-key {
    color: var(--uh-muted);
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .q-detail-val {
    color: var(--uh-text);
    font-weight: 600;
    text-align: right;
  }

  .q-called-banner {
    background: #EFF6FF;
    border: 1px solid #BFDBFE;
    border-radius: 12px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 22px;
    font-size: 14px;
    color: #1D4ED8;
    font-weight: 600;
  }
  .q-called-icon {
    font-size: 1.4rem;
    flex-shrink: 0;
  }

  .q-empty-state {
    text-align: center;
    padding: 40px 24px;
  }
  .q-empty-icon {
    font-size: 2.8rem;
    margin-bottom: 14px;
  }
  .q-empty-state h2 {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--uh-text);
    margin-bottom: 6px;
  }
  .q-empty-state p {
    color: var(--uh-muted);
    font-size: 14px;
    max-width: 320px;
    margin: 0 auto 22px;
  }

  .q-btn {
    border: none;
    border-radius: 10px;
    padding: 11px 22px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    font-family: inherit;
    transition: background 0.15s;
  }
  .q-btn-primary { background: var(--uh-primary); color: #fff; }
  .q-btn-primary:hover { background: var(--uh-primary-dark); }
  .q-btn-ghost {
    background: var(--uh-bg);
    color: var(--uh-text);
    border: 1px solid var(--uh-border);
  }
  .q-btn-ghost:hover { background: #E5E7EB; }
  .q-btn-danger {
    background: #FEF2F2;
    color: #B91C1C;
    border: 1px solid #FECACA;
  }
  .q-btn-danger:hover { background: #FEE2E2; }
  .q-btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .q-loading {
    text-align: center;
    padding: 60px 24px;
    color: var(--uh-muted);
    font-size: 14px;
  }
  .q-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--uh-border);
    border-top-color: var(--uh-primary);
    border-radius: 50%;
    animation: q-spin 0.7s linear infinite;
    margin: 0 auto 14px;
  }
  @keyframes q-spin { to { transform: rotate(360deg); } }

  .q-alert {
    border-radius: 12px;
    padding: 13px 16px;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 16px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .q-alert-error   { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
  .q-alert-success { background: #F0FDF4; color: #166534; border: 1px solid #BBF7D0; }
  .q-alert-icon { flex-shrink: 0; }

  .q-overlay {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.45);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
    animation: q-fade-in 0.15s ease;
  }
  @keyframes q-fade-in { from { opacity: 0; } to { opacity: 1; } }

  .q-modal {
    background: var(--uh-surface);
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(17, 24, 39, 0.18);
    padding: 28px;
    width: 100%;
    max-width: 420px;
    animation: q-slide-up 0.18s ease;
  }
  @keyframes q-slide-up {
    from { transform: translateY(12px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }

  .q-modal-icon {
    width: 48px;
    height: 48px;
    background: #EFF6FF;
    border-radius: 14px;
    display: grid;
    place-items: center;
    font-size: 1.4rem;
    margin-bottom: 16px;
  }
  .q-modal h2 {
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--uh-text);
    margin-bottom: 6px;
  }
  .q-modal-subtitle {
    font-size: 14px;
    color: var(--uh-muted);
    margin-bottom: 20px;
    line-height: 1.6;
  }
  .q-modal-clinic {
    background: var(--uh-bg);
    border: 1px solid var(--uh-border);
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 22px;
  }
  .q-modal-clinic strong {
    display: block;
    font-size: 14px;
    font-weight: 700;
    color: var(--uh-text);
    margin-bottom: 3px;
  }
  .q-modal-clinic span {
    font-size: 13px;
    color: var(--uh-muted);
  }
  .q-modal-actions {
    display: flex;
    gap: 10px;
  }
  .q-modal-actions .q-btn {
    flex: 1;
  }

  .q-refresh-hint {
    text-align: center;
    font-size: 12px;
    color: var(--uh-muted);
    margin-top: 12px;
  }
`

const STATUS_DOT = {
  Waiting: 'waiting',
  Called: 'called',
  Served: 'served',
  Skipped: 'skipped',
}

const STATUS_LABEL = {
  Waiting: 'Waiting',
  Called: 'Called — please proceed',
  Served: 'Served',
  Skipped: 'Skipped',
}

export default function QueuePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  //const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
  const API_BASE = getApiBase()
  const [queueEntry, setQueueEntry] = useState(null)
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [pendingClinic, setPendingClinic] = useState(() => {
    try {
      return window.history.state?.usr?.clinic ?? null
    } catch {
      return null
    }
  })

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)

  const fetchQueue = useCallback(async () => {
    try {
      setLoadingQueue(true)
      setFetchError(null)

      const clinicId = pendingClinic?.id || localStorage.getItem('selectedClinicId')
      const patientId = user?.id

      if (!patientId || !clinicId) {
        setQueueEntry(null)
        return
      }

      const res = await fetch(
        `${API_BASE}/api/queue/${clinicId}/entry/${patientId}`,
        {
          headers: { Accept: 'application/json' },
        }
      )

      if (res.status === 404) {
        setFetchError(null)
        setActionError(null)
        setQueueEntry(null)
        return
      }

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        if (res.status === 409) {
          setActionError(data?.error ?? 'Patient already has an active queue entry')
          setPendingClinic(null)
        } else if (res.status === 400) {
          setActionError(data?.error ?? 'Invalid queue join request')
        } else {
          throw new Error(data?.error ?? `Failed to join queue (HTTP ${res.status})`)
        }
        return
      }

      const entry = data?.entry ?? null

      if (entry && !entry.clinic_name) {
        try {
          const clinicRes = await fetch(`${API_BASE}/api/clinics/${clinicId}`, {
            headers: { Accept: 'application/json' },
          })
          if (clinicRes.ok) {
            const clinicData = await clinicRes.json().catch(() => null)
            entry.clinic_name = clinicData?.name ?? clinicData?.clinic?.name ?? null
          }
        } catch {
          // Non-fatal — clinic name just won't show
        }
      }

      setQueueEntry(entry)
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setLoadingQueue(false)
    }
  }, [API_BASE, pendingClinic?.id, user?.id])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  useEffect(() => {
    const id = setInterval(fetchQueue, 30000)
    return () => clearInterval(id)
  }, [fetchQueue])

  const handleConfirmJoin = async () => {
    const clinicId = pendingClinic?.id
    const clinicName = pendingClinic?.name
    const userId = user?.id

    if (!clinicId || !userId) {
      setActionError('Missing clinic or user ID')
      return
    }

    if (!API_BASE) {
      setActionError('VITE_API_BASE_URL is missing')
      return
    }

    try {
      setActionLoading(true)
      setActionError(null)
      setActionSuccess(null)

      const res = await fetch(`${API_BASE}/api/queue/${clinicId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: userId,
          confirmed: true,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        if (res.status === 409) {
          setActionError(data?.error ?? 'Patient already has an active queue entry')
        } else if (res.status === 400) {
          setActionError(data?.error ?? 'Invalid queue join request')
        } else {
          throw new Error(data?.error ?? `Failed to join queue (HTTP ${res.status})`)
        }
        return
      }

      localStorage.setItem('selectedClinicId', clinicId)

      setQueueEntry({
        ...(data?.entry ?? {}),
        clinic_name: clinicName,
      })

      setActionSuccess(`You have joined the queue at ${clinicName}.`)
      setPendingClinic(null)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }


  const handleCancelJoin = () => {
    setPendingClinic(null)
    setActionError(null)
  }

  const handleLeaveQueue = async () => {
    const clinicId = localStorage.getItem('selectedClinicId')
    const entryId = queueEntry?.id

    if (!clinicId || !entryId) {
      setActionError('Could not find your queue entry.')
      return
    }

    try {
      setActionLoading(true)
      setActionError(null)
      setActionSuccess(null)

      const res = await fetch(`${API_BASE}/api/queue/${clinicId}/entry/${entryId}`, {
        method: 'DELETE',
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error ?? `Failed to leave queue (HTTP ${res.status})`)
      }

      localStorage.removeItem('selectedClinicId')
      setQueueEntry(null)
      setActionSuccess('You have been removed from the queue.')
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <style>{styles}</style>

      <main className="q-page">
        <header className="q-page-header">
          <h1>My Queue</h1>
          <p>Track your position and status at your selected clinic.</p>
        </header>

        {actionError && (
          <p className="q-alert q-alert-error" role="alert">
            <span className="q-alert-icon">⚠</span>
            {actionError}
          </p>
        )}

        {actionSuccess && (
          <p className="q-alert q-alert-success" role="status">
            <span className="q-alert-icon">✓</span>
            {actionSuccess}
          </p>
        )}

        {loadingQueue && (
          <section className="q-loading" aria-live="polite">
            <span className="q-spinner" role="status" aria-label="Loading queue" />
            Loading your queue…
          </section>
        )}

        {!loadingQueue && fetchError && (
          <p className="q-alert q-alert-error" role="alert">
            <span className="q-alert-icon">⚠</span>
            {fetchError}
          </p>
        )}

        {!loadingQueue && !fetchError && !queueEntry && (
          <article className="q-card">
            <section className="q-empty-state">
              <p className="q-empty-icon" aria-hidden="true">🏥</p>
              <h2>Queue is empty</h2>
              <p>Browse available clinics and tap <strong>Join Queue</strong> to get started.</p>
              <button
                className="q-btn q-btn-primary"
                onClick={() => navigate('/clinic')}
              >
                Browse clinics
              </button>
            </section>
          </article>
        )}

        {!loadingQueue && !fetchError && queueEntry && (
          <article className="q-card">
            {queueEntry.status === 'Called' && (
              <aside className="q-called-banner" role="alert">
                <span className="q-called-icon">🔔</span>
                <span>It's your turn! Please proceed to the reception desk.</span>
              </aside>
            )}

            <header className="q-status-row">
              <span
                className={`q-status-dot ${STATUS_DOT[queueEntry.status] ?? 'waiting'}`}
                aria-hidden="true"
              />
              <span className="q-status-label">
                {STATUS_LABEL[queueEntry.status] ?? queueEntry.status}
              </span>
            </header>

            {['Waiting', 'Called'].includes(queueEntry.status) && (
              <section className="q-position-hero">
                <figure style={{ margin: 0 }}>
                  <p className="q-position-number" aria-label={`Queue position ${queueEntry.position}`}>
                    {queueEntry.position}
                  </p>
                  <figcaption className="q-position-label">Position</figcaption>
                </figure>
                <hr className="q-position-divider" aria-hidden="true" />
                <address className="q-position-info">
                  <h2>{queueEntry.clinic_name ?? 'Clinic'}</h2>
                </address>
              </section>
            )}

            {['Served', 'Skipped'].includes(queueEntry.status) && (
              <section className="q-position-hero">
                <address className="q-position-info">
                  <h2>{queueEntry.clinic_name ?? 'Clinic'}</h2>
                </address>
              </section>
            )}

            <dl className="q-detail-grid" aria-label="Queue details">
              <span className="q-detail-row">
                <dt className="q-detail-key">Joined at</dt>
                <dd className="q-detail-val">
                  {queueEntry.joined_at
                    ? new Date(queueEntry.joined_at + 'Z').toLocaleTimeString('en-ZA', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Africa/Johannesburg',
                      })
                    : '—'}
                </dd>
              </span>

              {queueEntry.people_ahead > 0 && (
                <span className="q-detail-row">
                  <dt className="q-detail-key">People ahead</dt>
                  <dd className="q-detail-val">{queueEntry.people_ahead}</dd>
                </span>
              )}

              {queueEntry.estimated_wait_minutes != null && (
                <span className="q-detail-row">
                  <dt className="q-detail-key">Estimated wait</dt>
                  <dd className="q-detail-val">{queueEntry.estimated_wait_minutes} min</dd>
                </span>
              )}
            </dl>
          </article>
        )}

        {!loadingQueue && queueEntry && ['Waiting', 'Called'].includes(queueEntry.status) && (
          <p className="q-refresh-hint">Updates automatically every 30 seconds.</p>
        )}

        <QueueNotifications />

        {!loadingQueue && !fetchError && queueEntry && ['Waiting', 'Called'].includes(queueEntry.status) && (
      <div style={{ marginTop: '12px', textAlign: 'center' }}>
        <button
          className="q-btn q-btn-danger"
          onClick={handleLeaveQueue}
          disabled={actionLoading}
        >
          {actionLoading ? 'Leaving…' : 'Leave Queue'}
        </button>
      </div>
    )}
      </main>

    {pendingClinic && !queueEntry && !loadingQueue && (
        <aside
          className="q-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="q-modal-title"
          aria-describedby="q-modal-desc"
        >
          <article className="q-modal">
            <span className="q-modal-icon" aria-hidden="true">🏥</span>

            <h2 id="q-modal-title">Join virtual queue?</h2>
            <p className="q-modal-subtitle" id="q-modal-desc">
              You are about to join the queue at the following clinic. You can leave the queue at any time.
            </p>

            {actionError && (
              <p className="q-alert q-alert-error" role="alert">
                <span className="q-alert-icon">⚠</span>
                {actionError}
              </p>
            )}

            <address className="q-modal-clinic">
              <strong>{pendingClinic.name}</strong>
              <span>{pendingClinic.municipality}, {pendingClinic.district}</span>
            </address>

            <footer className="q-modal-actions">
              <button
                className="q-btn q-btn-ghost"
                onClick={handleCancelJoin}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="q-btn q-btn-primary"
                onClick={handleConfirmJoin}
                disabled={actionLoading}
                autoFocus
              >
                {actionLoading ? 'Joining…' : 'Confirm'}
              </button>
            </footer>
          </article>
        </aside>
      )}
    </>
  )
}
