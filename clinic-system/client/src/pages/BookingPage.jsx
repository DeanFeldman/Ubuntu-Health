import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import getApiBase from '../lib/getApiBase'

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate appointment slots for a given date.
 * Slots run from 08:00–17:00 in 30-minute increments.
 * In a real system these would come from /api/appointments/slots.
 */
function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Minimum bookable date = today */
function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = `
  :root {
    --uh-primary: #2563EB;
    --uh-primary-dark: #1D4ED8;
    --uh-bg: #F3F4F6;
    --uh-surface: #FFFFFF;
    --uh-text: #111827;
    --uh-muted: #6B7280;
    --uh-border: #E5E7EB;
    --uh-shadow: 0 8px 24px rgba(17, 24, 39, 0.07);
    --uh-accent: #023474;
    --uh-success: #16A34A;
    --uh-error: #DC2626;
  }

  .bp-page {
    max-width: 760px;
    margin: 0 auto;
    padding: 32px 24px 64px;
    font-family: Inter, Arial, sans-serif;
    color: var(--uh-text);
  }

  /* ── Header ── */
  .bp-header {
    margin-bottom: 28px;
  }
  .bp-clinic-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #EFF6FF;
    color: var(--uh-primary);
    border: 1px solid #BFDBFE;
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .bp-title {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--uh-text);
    margin: 0 0 4px;
    line-height: 1.2;
  }
  .bp-subtitle {
    color: var(--uh-muted);
    font-size: 14px;
    margin: 0;
  }

  /* ── Cards ── */
  .bp-card {
    background: var(--uh-surface);
    border-radius: 18px;
    border: 1px solid var(--uh-border);
    box-shadow: var(--uh-shadow);
    padding: 24px;
    margin-bottom: 20px;
  }
  .bp-card-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--uh-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 16px;
  }

  /* ── Date picker ── */
  .bp-date-input {
    width: 100%;
    height: 48px;
    border: 1.5px solid var(--uh-border);
    border-radius: 12px;
    padding: 0 16px;
    font-size: 15px;
    font-family: inherit;
    color: var(--uh-text);
    background: var(--uh-surface);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
  }
  .bp-date-input:focus {
    border-color: var(--uh-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  /* ── Slot grid ── */
  .bp-slots-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  @media (max-width: 520px) {
    .bp-slots-grid { grid-template-columns: repeat(3, 1fr); }
  }

  .bp-slot {
    padding: 10px 6px;
    border-radius: 10px;
    border: 1.5px solid var(--uh-border);
    background: var(--uh-surface);
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    color: var(--uh-muted);
    cursor: pointer;
    text-align: center;
    transition: all 0.12s;
  }
  .bp-slot:hover {
    border-color: var(--uh-primary);
    color: var(--uh-primary);
    background: #EFF6FF;
  }
  .bp-slot.selected {
    background: var(--uh-primary);
    border-color: var(--uh-primary);
    color: #fff;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
  }

  .bp-no-slots {
    text-align: center;
    padding: 32px;
    color: var(--uh-muted);
    font-size: 14px;
    background: #F9FAFB;
    border-radius: 12px;
    border: 1.5px dashed var(--uh-border);
  }
  .bp-no-slots strong {
    display: block;
    font-size: 15px;
    color: var(--uh-text);
    margin-bottom: 4px;
  }

  /* ── Staff patient section ── */
  .bp-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
  }
  .bp-field:last-child { margin-bottom: 0; }
  .bp-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--uh-muted);
  }
  .bp-select,
  .bp-input {
    height: 46px;
    border: 1.5px solid var(--uh-border);
    border-radius: 12px;
    padding: 0 14px;
    font-size: 14px;
    font-family: inherit;
    color: var(--uh-text);
    background: var(--uh-surface);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .bp-select:focus,
  .bp-input:focus {
    border-color: var(--uh-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }
  .bp-input-error {
    border-color: var(--uh-error) !important;
  }
  .bp-error-text {
    font-size: 12px;
    color: var(--uh-error);
    margin-top: 2px;
  }

  /* ── New patient sub-form ── */
  .bp-new-patient-form {
    background: #F9FAFB;
    border: 1.5px solid var(--uh-border);
    border-radius: 12px;
    padding: 16px;
    margin-top: 12px;
  }
  .bp-new-patient-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--uh-text);
    margin: 0 0 14px;
  }

  /* ── Toggle link ── */
  .bp-toggle-link {
    background: none;
    border: none;
    padding: 0;
    color: var(--uh-primary);
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    text-decoration: underline;
    margin-top: 10px;
    display: inline-block;
  }
  .bp-toggle-link:hover { color: var(--uh-primary-dark); }

  /* ── Action row ── */
  .bp-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .bp-btn {
    border: none;
    border-radius: 12px;
    padding: 12px 24px;
    cursor: pointer;
    font-weight: 700;
    font-size: 14px;
    font-family: inherit;
    transition: background 0.15s, opacity 0.15s;
    white-space: nowrap;
  }
  .bp-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .bp-btn-primary {
    background: var(--uh-accent);
    color: #fff;
  }
  .bp-btn-primary:hover:not(:disabled) { background: #012a5e; }
  .bp-btn-secondary {
    background: #E5E7EB;
    color: var(--uh-text);
  }
  .bp-btn-secondary:hover:not(:disabled) { background: #D1D5DB; }

  /* ── Confirmation popup overlay ── */
  .bp-overlay {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.45);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 24px;
  }
  .bp-dialog {
    background: var(--uh-surface);
    border-radius: 22px;
    box-shadow: 0 24px 64px rgba(17, 24, 39, 0.18);
    padding: 32px;
    width: 100%;
    max-width: 440px;
    animation: bp-pop 0.18s ease;
  }
  @keyframes bp-pop {
    from { opacity: 0; transform: scale(0.94) translateY(8px); }
    to   { opacity: 1; transform: scale(1)    translateY(0); }
  }
  .bp-dialog-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: #EFF6FF;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    font-size: 22px;
  }
  .bp-dialog-title {
    font-size: 1.15rem;
    font-weight: 800;
    margin: 0 0 4px;
  }
  .bp-dialog-subtitle {
    font-size: 13px;
    color: var(--uh-muted);
    margin: 0 0 24px;
  }
  .bp-confirm-detail {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--uh-border);
    font-size: 14px;
  }
  .bp-confirm-detail:last-of-type { border-bottom: none; }
  .bp-confirm-label {
    color: var(--uh-muted);
    font-weight: 500;
  }
  .bp-confirm-value {
    font-weight: 700;
    color: var(--uh-text);
    text-align: right;
  }
  .bp-dialog-actions {
    display: flex;
    gap: 10px;
    margin-top: 24px;
  }
  .bp-dialog-actions .bp-btn {
    flex: 1;
    text-align: center;
  }

  /* ── Success state ── */
  .bp-success {
    text-align: center;
    padding: 48px 24px;
  }
  .bp-success-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  .bp-success-title {
    font-size: 1.4rem;
    font-weight: 800;
    margin: 0 0 8px;
  }
  .bp-success-body {
    color: var(--uh-muted);
    font-size: 14px;
    margin: 0 0 28px;
    line-height: 1.6;
  }

  /* ── Submission error ── */
  .bp-submit-error {
    background: #FEF2F2;
    border: 1px solid #FECACA;
    border-radius: 12px;
    padding: 12px 16px;
    color: var(--uh-error);
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 16px;
  }

  /* ── Loading spinner ── */
  .bp-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    color: var(--uh-muted);
    font-size: 14px;
    gap: 10px;
  }
  .bp-spinner::before {
    content: '';
    width: 18px;
    height: 18px;
    border: 2.5px solid var(--uh-border);
    border-top-color: var(--uh-primary);
    border-radius: 50%;
    animation: bp-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes bp-spin { to { transform: rotate(360deg); } }

  .bp-toast {
    position: fixed;
    top: 20px;
    right: 20px;
    min-width: 240px;
    max-width: 360px;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.98);
    border: 1px solid var(--uh-border);
    box-shadow: 0 12px 30px rgba(17, 24, 39, 0.14);
    font-size: 13px;
    font-weight: 600;
    opacity: 0;
    transform: translateY(-8px);
    pointer-events: none;
    transition: opacity 0.18s ease, transform 0.18s ease;
    z-index: 120;
  }
  .bp-toast--visible {
    opacity: 1;
    transform: translateY(0);
  }
  .bp-toast--success {
    border-left: 3px solid #15803D;
    color: #15803D;
  }
  .bp-toast--error {
    border-left: 3px solid #B91C1C;
    color: #B91C1C;
  }
`

// ─── Main Component ───────────────────────────────────────────────────────────

function Toast({ message, type, visible }) {
  return (
    <div
      className={`bp-toast${visible ? ' bp-toast--visible' : ''}${type ? ` bp-toast--${type}` : ''}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}

export default function BookingPage() {
  const API_BASE_URL = getApiBase()
  const { user, role } = useAuth()
  const currentUser = user
  const navigate = useNavigate()
  const location = useLocation()

  //const isStaff = role === 'Staff' || role === 'Admin'

  // Clinic passed via navigation state from PatientDashboard or StaffPage
  const clinic = location.state?.clinic ?? null
  const bookingMode = location.state?.bookingMode || 'patient'
  const isStaff = bookingMode === 'staff'

  // ── Date & slot selection ──
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')

  // ── Staff-only patient selection ──
  const [patients, setPatients] = useState([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [showNewPatient, setShowNewPatient] = useState(false)

  // ── New patient form (staff) ──
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientEmail, setNewPatientEmail] = useState('')
  const [newPatientNameError, setNewPatientNameError] = useState('')
  const [newPatientEmailError, setNewPatientEmailError] = useState('')

  // ── UI state ──
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [booked, setBooked] = useState(false)
  const [bookedDetails, setBookedDetails] = useState(null)
  const [toast, setToast] = useState({ message: '', type: '', visible: false })

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, visible: true })
    window.clearTimeout(showToast.timeoutId)
    showToast.timeoutId = window.setTimeout(() => {
      setToast((current) => ({ ...current, visible: false }))
    }, 2600)
  }, [])

  // ── Fetch patients list for staff dropdown ──
  useEffect(() => {
    if (!isStaff) return
    setPatientsLoading(true)
    fetch(`${API_BASE_URL}/api/users`)
      .then((r) => r.json())
      .then((data) => {
        const patientList = (data.users || []).filter((u) => u.role === 'Patient')
        setPatients(patientList)
      })
      .catch(() => {})
      .finally(() => setPatientsLoading(false))
  }, [isStaff])

  // ── Generated slots for the selected date ──
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState('')
  

  useEffect(() => {
    if (!selectedDate || !clinic?.id) {
      setSlots([])
      setSlotsError('')
      return
    }

    async function fetchSlots() {
      setSlotsLoading(true)
      setSlotsError('')

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/appointments/slots?clinic_id=${clinic.id}&date=${selectedDate}`
        )

        const data = await res.json()

        if (!res.ok) throw new Error(data.error || 'Failed to load slots')

        setSlots(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)

        setSlots([])
        setSlotsError(err.message || 'Failed to load available appointment slots.')
      } finally {
        setSlotsLoading(false)
      }
    }

    fetchSlots()
  }, [selectedDate, clinic?.id])
  // Reset slot when date changes
  useEffect(() => {
    setSelectedSlot('')
  }, [selectedDate])

  // ── Derived: who is the booking for? ──
  const bookingPatientId = isStaff ? selectedPatientId : user?.id

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) ?? null,
    [patients, selectedPatientId]
  )

  // ── Validation ──
  function validateNewPatient() {
    let valid = true
    setNewPatientNameError('')
    setNewPatientEmailError('')

    if (!newPatientName.trim()) {
      setNewPatientNameError('Name is required.')
      valid = false
    }
    if (!newPatientEmail.trim()) {
      setNewPatientEmailError('Email is required.')
      valid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newPatientEmail.trim())) {
      setNewPatientEmailError('Enter a valid email address.')
      valid = false
    }
    return valid
  }

  const canProceed = useMemo(() => {
    if (!clinic?.id) return false
    if (!selectedDate || !selectedSlot) return false
    if (isStaff) {
      if (showNewPatient) {
        return (
          !!newPatientName.trim() &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newPatientEmail.trim())
        )
      }
      return !!bookingPatientId
    }
    return !!bookingPatientId
  }, [
    selectedDate,
    selectedSlot,
    clinic?.id,
    isStaff,
    showNewPatient,
    newPatientName,
    newPatientEmail,
    bookingPatientId,
  ])

  // ── Open confirmation popup ──
  function handleReviewBooking() {
    if (isStaff && showNewPatient && !validateNewPatient()) return
    setSubmitError('')
    setShowConfirm(true)
  }

  // ── Final booking submission ──
  async function handleConfirmBooking() {
    if (isSubmitting) {
      return
    }

    if (!selectedSlot) {
      setSubmitError('Please select a time slot')
      showToast('Please select a time slot', 'error')
      return
    }

    if (!selectedDate) {
      setSubmitError('Invalid booking details')
      showToast('Invalid booking details', 'error')
      return
    }

    if (!clinic?.id) {
      setSubmitError('Invalid booking details')
      showToast('Invalid booking details', 'error')
      return
    }

    if (new Date(`${selectedDate}T${selectedSlot}`) < new Date()) {
      setSubmitError('Cannot book a past time slot')
      showToast('Cannot book a past time slot', 'error')
      return
    }

    if (isStaff && showNewPatient) {
      if (!validateNewPatient()) {
        setSubmitError('Missing patient information')
        showToast('Missing patient information', 'error')
        return
      }
    } else if (!bookingPatientId) {
      setSubmitError('Missing patient information')
      showToast('Missing patient information', 'error')
      return
    }

    setSubmitting(true)
    setIsSubmitting(true)
    setSubmitError('')

    try {
      let resolvedBookingPatientId = bookingPatientId

      // If staff is creating a new patient, create them first
      if (isStaff && showNewPatient) {
      const res = await fetch(`${API_BASE_URL}/api/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: newPatientName.trim(),
            email: newPatientEmail.trim(),
            created_by: currentUser.id,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Booking failed. Please try again.')
        resolvedBookingPatientId = data.patient?.id
        if (!resolvedBookingPatientId) {
          throw new Error('Missing patient information')
        }
      }

      // Book the appointment slot
      const res = await fetch(`${API_BASE_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinic.id,
          patient_id: resolvedBookingPatientId,
          date: selectedDate,
          time: selectedSlot,
          booked_by: currentUser.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Booking failed. Please try again.')

      setBookedDetails({
        clinicName: clinic.name,
        date: selectedDate,
        time: selectedSlot,
      })
      setSubmitError('')
      setShowConfirm(false)
      setBooked(true)
      showToast('Appointment booked successfully', 'success')
    } catch (err) {
      const message = err?.message || 'Booking failed. Please try again.'
      setSubmitError(message)
      showToast(message, 'error')
    } finally {
      setSubmitting(false)
      setIsSubmitting(false)
    }
  }

  // ── Back navigation ──
  function handleBack() {
    if (isStaff) {
      navigate('/clinic')
    } 
  }

  // ── Redirect if no clinic context ──
  if (!clinic) {
    return (
      <>
        <style>{styles}</style>
        <div className="bp-page">
          <div className="bp-no-slots" style={{ marginTop: 40 }}>
            <strong>No clinic selected</strong>
            Please go back and select a clinic before booking.
          </div>
          <div className="bp-actions" style={{ marginTop: 20 }}>
            <button className="bp-btn bp-btn-secondary" onClick={handleBack}>
              ← Back
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Success screen ──
  if (booked && bookedDetails) {
    return (
      <>
        <style>{styles}</style>
        <Toast message={toast.message} type={toast.type} visible={toast.visible} />
        <div className="bp-page">
          <div className="bp-card bp-success">
            <div className="bp-success-icon">🎉</div>
            <h2 className="bp-success-title">Appointment Booked!</h2>
            <p className="bp-success-body">
              Your appointment at <strong>{bookedDetails.clinicName}</strong> has been confirmed
              for <strong>{formatDate(bookedDetails.date)}</strong> at{' '}
              <strong>{formatTime(bookedDetails.time)}</strong>.
            </p>
            <div className="bp-actions" style={{ justifyContent: 'center' }}>
              <button className="bp-btn bp-btn-secondary" onClick={handleBack}>
                ← Back to {isStaff ? 'Staff' : 'Clinics'}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{styles}</style>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      <div className="bp-page">

        {/* ── Header ── */}
        <header className="bp-header">
          <button
            className="bp-btn bp-btn-secondary"
            style={{ marginBottom: 16, padding: '8px 16px', fontSize: 13 }}
            onClick={handleBack}
          >
            ← Back
          </button>
          <div className="bp-clinic-badge">
            🏥 {clinic.name}
          </div>
          <h1 className="bp-title">Book an Appointment</h1>
          <p className="bp-subtitle">
            {clinic.municipality}, {clinic.district} · {clinic.facility_type}
          </p>
        </header>

        {/* ── Staff: patient selection ── */}
        {isStaff && (
          <section className="bp-card">
            <p className="bp-card-title">Patient</p>

            {!showNewPatient && (
              <>
                <div className="bp-field">
                  <label className="bp-label" htmlFor="patient-select">
                    Select existing patient
                  </label>
                  {patientsLoading ? (
                    <div className="bp-spinner">Loading patients…</div>
                  ) : (
                    <select
                      id="patient-select"
                      className="bp-select"
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                    >
                      <option value="">Select a patient</option>
                        {patients.map((patient) => (
                          <option key={patient.id} value={patient.id}>
                            {patient.full_name} ({patient.role})
                          </option>
                        ))}
                    </select>
                  )}
                </div>
                <button
                  type="button"
                  className="bp-toggle-link"
                  onClick={() => {
                    setShowNewPatient(true)
                    setSelectedPatientId('')
                    setSubmitError('')
                  }}
                >
                  + Add new patient instead
                </button>
              </>
            )}

            {showNewPatient && (
              <>
                <div className="bp-new-patient-form">
                  <p className="bp-new-patient-title">New Patient Details</p>

                  <div className="bp-field">
                    <label className="bp-label" htmlFor="new-patient-name">Full name</label>
                    <input
                      id="new-patient-name"
                      className={`bp-input ${newPatientNameError ? 'bp-input-error' : ''}`}
                      type="text"
                      placeholder="e.g. Amara Dlamini"
                      value={newPatientName}
                      onChange={(e) => { setNewPatientName(e.target.value); setNewPatientNameError('') }}
                    />
                    {newPatientNameError && (
                      <span className="bp-error-text">{newPatientNameError}</span>
                    )}
                  </div>

                  <div className="bp-field">
                    <label className="bp-label" htmlFor="new-patient-email">Email address</label>
                    <input
                      id="new-patient-email"
                      className={`bp-input ${newPatientEmailError ? 'bp-input-error' : ''}`}
                      type="email"
                      placeholder="e.g. amara@example.com"
                      value={newPatientEmail}
                      onChange={(e) => { setNewPatientEmail(e.target.value); setNewPatientEmailError('') }}
                    />
                    {newPatientEmailError && (
                      <span className="bp-error-text">{newPatientEmailError}</span>
                    )}
                  </div>
                </div>

                <button
                  className="bp-toggle-link"
                  onClick={() => { setShowNewPatient(false); setNewPatientName(''); setNewPatientEmail(''); setNewPatientNameError(''); setNewPatientEmailError('') }}
                >
                  ← Select existing patient instead
                </button>
              </>
            )}
          </section>
        )}

        {/* ── Date selection ── */}
        <section className="bp-card">
          <p className="bp-card-title">Select a Date</p>
          <input
            className="bp-date-input"
            type="date"
            lang = "en-GB"
            min={todayStr()}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            aria-label="Appointment date"
          />
        </section>

        {/* ── Slot selection ── */}
        <section className="bp-card">
          <p className="bp-card-title">Select a Time</p>

          {!selectedDate ? (
            <div className="bp-no-slots">
              <strong>Pick a date first</strong>
              Available slots will appear here once you choose a date.
            </div>
          ) : slotsError ? (
            <div className="bp-no-slots" role="alert">
              <strong>Unable to load slots</strong>
              {slotsError}
            </div>
          ) : slots.length === 0 ? (
            <div className="bp-no-slots">
              <strong>No slots available</strong>
              There are no available appointment slots for this date. Please try another day.
            </div>
          ) : (
            <div className="bp-slots-grid" role="group" aria-label="Available time slots">
              {slots.map((slot) => (
                <button
                  key={slot}
                  className={`bp-slot ${selectedSlot === slot ? 'selected' : ''}`}
                  onClick={() => setSelectedSlot(slot)}
                  aria-pressed={selectedSlot === slot}
                >
                  {formatTime(slot)}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Submit error ── */}
        {submitError && (
          <div className="bp-submit-error" role="alert">
            ⚠ {submitError}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="bp-actions">
          <button className="bp-btn bp-btn-secondary" onClick={handleBack}>
            Cancel
          </button>
          <button
            className="bp-btn bp-btn-primary"
            disabled={!canProceed}
            onClick={handleReviewBooking}
          >
            Review Booking →
          </button>
        </div>

      </div>

      {/* ── Confirmation popup ── */}
      {showConfirm && (
        <div
          className="bp-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false) }}
        >
          <div className="bp-dialog">
            <div className="bp-dialog-icon">📋</div>
            <h2 className="bp-dialog-title" id="confirm-title">Confirm Appointment</h2>
            <p className="bp-dialog-subtitle">Please review the details below before confirming.</p>

            <div role="list">
              <div className="bp-confirm-detail" role="listitem">
                <span className="bp-confirm-label">Clinic</span>
                <span className="bp-confirm-value">{clinic.name}</span>
              </div>
              <div className="bp-confirm-detail" role="listitem">
                <span className="bp-confirm-label">Date</span>
                <span className="bp-confirm-value">{formatDate(selectedDate)}</span>
              </div>
              <div className="bp-confirm-detail" role="listitem">
                <span className="bp-confirm-label">Time</span>
                <span className="bp-confirm-value">{formatTime(selectedSlot)}</span>
              </div>
              {isStaff && (
                <div className="bp-confirm-detail" role="listitem">
                  <span className="bp-confirm-label">Patient</span>
                  <span className="bp-confirm-value">
                    {showNewPatient ? newPatientName.trim() : selectedPatient?.full_name ?? '—'}
                  </span>
                </div>
              )}
            </div>

            {submitError && (
              <div className="bp-submit-error" role="alert" style={{ marginTop: 16, marginBottom: 0 }}>
                ⚠ {submitError}
              </div>
            )}

            <div className="bp-dialog-actions">
              <button
                className="bp-btn bp-btn-secondary"
                onClick={() => setShowConfirm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="bp-btn bp-btn-primary"
                onClick={handleConfirmBooking}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Booking…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
