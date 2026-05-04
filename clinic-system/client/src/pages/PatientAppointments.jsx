import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import getApiBase from '../lib/getApiBase'
import { useAuth } from '../context/AuthContext'

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

  .q-card-footer {
    margin-top: 20px;
    padding-top: 18px;
    border-top: 1px solid var(--uh-border);
    display: flex;
    justify-content: flex-end;
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

  /* ── Cancel confirmation modal ── */
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
    background: #FEF2F2;
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
  .q-modal-details {
    background: var(--uh-bg);
    border: 1px solid var(--uh-border);
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 22px;
    display: grid;
    gap: 8px;
  }
  .q-modal-detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }
  .q-modal-detail-key {
    color: var(--uh-muted);
    font-weight: 500;
  }
  .q-modal-detail-val {
    color: var(--uh-text);
    font-weight: 700;
    text-align: right;
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
  Confirmed: 'served',
  Waiting: 'waiting',
  Completed: 'served',
  Cancelled: 'skipped',
}

export default function PatientAppointments() {
  const { user, dbUser } = useAuth()
  const navigate = useNavigate()
  const API_BASE = getApiBase()

  const patientId = dbUser?.id || user?.id

  const [appointments, setAppointments] = useState([])
  const [loadingAppointments, setLoadingAppointments] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // ── Cancellation state ──
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [appointmentToCancel, setAppointmentToCancel] = useState(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  const fetchAppointments = useCallback(async () => {
    try {
      setLoadingAppointments(true)
      setFetchError(null)

      if (!patientId) {
        setAppointments([])
        return
      }

      const res = await fetch(`${API_BASE}/api/appointments/patient/${patientId}`, {
        headers: { Accept: 'application/json' },
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load appointments')
      }

      setAppointments(Array.isArray(data?.appointments) ? data.appointments : [])
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setLoadingAppointments(false)
    }
  }, [API_BASE, patientId])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // ── Open cancel modal ──
  function openCancelModal(appointment) {
    setAppointmentToCancel(appointment)
    setCancelError(null)
    setShowCancelModal(true)
  }

  // ── Dismiss cancel modal ──
  function dismissCancelModal() {
    setShowCancelModal(false)
    setAppointmentToCancel(null)
    setCancelError(null)
  }

  // ── Confirm cancellation ──
  async function handleConfirmCancel() {
    if (!appointmentToCancel) return

    try {
      setCancelLoading(true)
      setCancelError(null)

      const res = await fetch(`${API_BASE}/api/appointments/${appointmentToCancel.id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Could not cancel appointment.')
      }

      setShowCancelModal(false)
      setAppointmentToCancel(null)
      await fetchAppointments()
    } catch (err) {
      setCancelError(err.message)
    } finally {
      setCancelLoading(false)
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-ZA', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  function formatTime(dateString) {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      <style>{styles}</style>

      <main className="q-page">
        <header className="q-page-header">
          <h1>My Appointments</h1>
          <p>View your upcoming bookings and appointment statuses.</p>
        </header>

        {loadingAppointments && (
          <section className="q-loading" aria-live="polite">
            <span className="q-spinner" role="status" aria-label="Loading appointments" />
            Loading your appointments…
          </section>
        )}

        {!loadingAppointments && fetchError && (
          <p className="q-alert q-alert-error" role="alert">
            <span className="q-alert-icon">⚠</span>
            {fetchError}
          </p>
        )}

        {!loadingAppointments && !fetchError && appointments.length === 0 && (
          <article className="q-card">
            <section className="q-empty-state">
              <p className="q-empty-icon" aria-hidden="true">📅</p>
              <h2>No upcoming appointments</h2>
              <p>Book an appointment at a clinic to see it listed here.</p>
              <button
                className="q-btn q-btn-primary"
                onClick={() => navigate('/clinic')}
              >
                Browse clinics
              </button>
            </section>
          </article>
        )}

        {!loadingAppointments && !fetchError && appointments.map((appointment) => (
          <article className="q-card" key={appointment.id}>
            <header className="q-status-row">
              <span
                className={`q-status-dot ${STATUS_DOT[appointment.status] ?? 'called'}`}
                aria-hidden="true"
              />
              <span className="q-status-label">
                {appointment.status || 'Confirmed'}
              </span>
            </header>

            <section className="q-position-hero">
              <figure style={{ margin: 0 }}>
                <p className="q-position-number">
                  {formatTime(appointment.slot_datetime)}
                </p>
                <figcaption className="q-position-label">Time</figcaption>
              </figure>

              <hr className="q-position-divider" aria-hidden="true" />

              <address className="q-position-info">
                <h2>{appointment.clinic_name || 'Clinic'}</h2>
                <p>{formatDate(appointment.slot_datetime)}</p>
              </address>
            </section>

            <dl className="q-detail-grid" aria-label="Appointment details">
              <span className="q-detail-row">
                <dt className="q-detail-key">Clinic</dt>
                <dd className="q-detail-val">{appointment.clinic_name || 'Clinic'}</dd>
              </span>
              <span className="q-detail-row">
                <dt className="q-detail-key">Date</dt>
                <dd className="q-detail-val">{formatDate(appointment.slot_datetime)}</dd>
              </span>
              <span className="q-detail-row">
                <dt className="q-detail-key">Time</dt>
                <dd className="q-detail-val">{formatTime(appointment.slot_datetime)}</dd>
              </span>
              <span className="q-detail-row">
                <dt className="q-detail-key">Status</dt>
                <dd className="q-detail-val">{appointment.status || 'Confirmed'}</dd>
              </span>
            </dl>

            {/* ── Cancel button ── */}
            {appointment.status !== 'Cancelled' && appointment.status !== 'Completed' && (
              <footer className="q-card-footer">
                <button
                  type="button"
                  className="q-btn q-btn-danger"
                  onClick={() => openCancelModal(appointment)}
                >
                  Cancel appointment
                </button>
              </footer>
            )}
          </article>
        ))}
      </main>

      {/* ── Cancel confirmation modal ── */}
      {showCancelModal && appointmentToCancel && (
        <aside
          className="q-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
          aria-describedby="cancel-modal-desc"
          onClick={(e) => { if (e.target === e.currentTarget) dismissCancelModal() }}
        >
          <article className="q-modal">
            <div className="q-modal-icon" aria-hidden="true">🗓️</div>

            <h2 id="cancel-modal-title">Cancel appointment?</h2>
            <p className="q-modal-subtitle" id="cancel-modal-desc">
              This action cannot be undone. Please confirm you want to cancel the following appointment.
            </p>

            <div className="q-modal-details" aria-label="Appointment to cancel">
              <div className="q-modal-detail-row">
                <span className="q-modal-detail-key">Clinic</span>
                <span className="q-modal-detail-val">{appointmentToCancel.clinic_name || 'Clinic'}</span>
              </div>
              <div className="q-modal-detail-row">
                <span className="q-modal-detail-key">Date</span>
                <span className="q-modal-detail-val">{formatDate(appointmentToCancel.slot_datetime)}</span>
              </div>
              <div className="q-modal-detail-row">
                <span className="q-modal-detail-key">Time</span>
                <span className="q-modal-detail-val">{formatTime(appointmentToCancel.slot_datetime)}</span>
              </div>
            </div>

            {cancelError && (
              <p className="q-alert q-alert-error" role="alert" style={{ marginBottom: 16 }}>
                <span className="q-alert-icon">⚠</span>
                {cancelError}
              </p>
            )}

            <footer className="q-modal-actions">
              <button
                type="button"
                className="q-btn q-btn-ghost"
                onClick={dismissCancelModal}
                disabled={cancelLoading}
              >
                Keep appointment
              </button>
              <button
                type="button"
                className="q-btn q-btn-danger"
                onClick={handleConfirmCancel}
                disabled={cancelLoading}
                autoFocus
              >
                {cancelLoading ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </footer>
          </article>
        </aside>
      )}
    </>
  )
}