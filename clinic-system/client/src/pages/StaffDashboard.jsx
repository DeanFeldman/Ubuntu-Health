import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import getApiBase from '../lib/getApiBase'
import { useNavigate } from 'react-router-dom'

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
  .sd-availability {
    margin-top: 24px;
    background: var(--uh-surface);
    border: 1px solid var(--uh-border);
    border-radius: 12px;
    box-shadow: var(--uh-shadow);
    overflow: hidden;
  }

  .sd-availability-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--uh-border);
  }

  .sd-availability-grid {
    display: grid;
    gap: 12px;
    padding: 16px 20px 20px;
  }

  .sd-availability-row {
    display: grid;
    grid-template-columns: 140px 120px 1fr 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 12px;
    border: 1px solid var(--uh-border);
    border-radius: 10px;
    background: var(--uh-bg);
  }

  .sd-availability-day {
    font-weight: 600;
    color: var(--uh-text);
  }

  .sd-availability-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--uh-text);
  }

  .sd-availability-input {
    height: 40px;
    border: 1px solid var(--uh-border);
    border-radius: 8px;
    padding: 0 10px;
    font: inherit;
    background: white;
    color: var(--uh-text);
  }

  .sd-availability-error {
    color: #B91C1C;
    font-size: 12px;
    margin-top: 4px;
  }

  @media (max-width: 820px) {
    .sd-availability-row {
      grid-template-columns: 1fr;
    }
  }
  .sd-toast--visible { opacity: 1; }
  .sd-toast--success { border-left: 3px solid #15803D; color: #15803D; }
  .sd-toast--error   { border-left: 3px solid #B91C1C; color: #B91C1C; }

  /* ── Add new patient popup ── */
  .sd-overlay {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.45);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 24px;
  }
  .sd-dialog {
    background: var(--uh-surface);
    border-radius: 22px;
    box-shadow: 0 24px 64px rgba(17, 24, 39, 0.18);
    padding: 32px;
    width: 100%;
    max-width: 440px;
    animation: sd-pop 0.18s ease;
  }
  @keyframes sd-pop {
    from { opacity: 0; transform: scale(0.94) translateY(8px); }
    to   { opacity: 1; transform: scale(1)    translateY(0); }
  }
  .sd-dialog-icon {
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
  .sd-dialog-title {
    font-size: 1.1rem;
    font-weight: 800;
    margin: 0 0 4px;
    color: var(--uh-text);
  }
  .sd-dialog-subtitle {
    font-size: 13px;
    color: var(--uh-muted);
    margin: 0 0 20px;
  }
  .sd-dialog-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 14px;
  }
  .sd-dialog-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--uh-muted);
  }
  .sd-dialog-input {
    height: 44px;
    border: 1.5px solid var(--uh-border);
    border-radius: 10px;
    padding: 0 13px;
    font-size: 14px;
    font-family: inherit;
    color: var(--uh-text);
    background: var(--uh-surface);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .sd-dialog-input:focus {
    border-color: #2563EB;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }
  .sd-dialog-input--error { border-color: #DC2626 !important; }
  .sd-dialog-error-text { font-size: 12px; color: #DC2626; }
  .sd-dialog-submit-error {
    background: #FEF2F2;
    border: 1px solid #FECACA;
    border-radius: 10px;
    padding: 10px 14px;
    color: #DC2626;
    font-size: 13px;
    font-weight: 500;
    margin-top: 14px;
  }
  .sd-dialog-actions {
    display: flex;
    gap: 10px;
    margin-top: 24px;
  }
  .sd-dialog-actions .sd-act-btn {
    flex: 1;
    text-align: center;
    padding: 10px 16px;
    font-size: 13px;
  }
  .sd-act-btn--primary {
    background: #023474;
    color: #fff;
    border-color: #023474;
  }
  .sd-act-btn--primary:hover:not(:disabled) {
    background: #012a5e;
    border-color: #012a5e;
  }
  .sd-act-btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .sd-badge--confirmed { background: #DBEAFE; color: #1E40AF; }
  .sd-badge--cancelled { background: #FEE2E2; color: #991B1B; }
`
const DAYS = [
  { label: 'Monday', value: 0 },
  { label: 'Tuesday', value: 1 },
  { label: 'Wednesday', value: 2 },
  { label: 'Thursday', value: 3 },
  { label: 'Friday', value: 4 },
  { label: 'Saturday', value: 5 },
  { label: 'Sunday', value: 6 },
]

function createDefaultAvailability() {
  return DAYS.map(day => ({
    day_of_week: day.value,
    day_label: day.label,
    id: null,
    start_time: '',
    end_time: '',
    is_available: false,
    error: '',
  }))
}

  function getClinicDayHours(clinic, dayLabel) {
    if (!clinic) return { start_time: '', end_time: '' }

    const day = dayLabel.toLowerCase()
    const hours = clinic.operating_hours || clinic.hours || {}

    const dayHours =
      hours[day] ||
      hours[dayLabel] ||
      hours[dayLabel.toUpperCase()] ||
      hours[dayLabel.slice(0, 3).toLowerCase()] ||
      null

    if (!dayHours) return { start_time: '', end_time: '' }

    const open =
      dayHours.open ||
      dayHours.start ||
      dayHours.start_time ||
      dayHours.opening_time ||
      ''

    const close =
      dayHours.close ||
      dayHours.end ||
      dayHours.end_time ||
      dayHours.closing_time ||
      ''

    return {
      start_time: open ? String(open).slice(0, 5) : '',
      end_time: close ? String(close).slice(0, 5) : '',
    }
  }

const STATUS_SEQUENCE = ['Waiting', 'In Consultation', 'Complete']

const BADGE_CLASS = {
  Waiting: 'sd-badge--waiting',
  Called: 'sd-badge--called',
  'In Consultation': 'sd-badge--consultation',
  Complete: 'sd-badge--complete',

  Confirmed: 'sd-badge--confirmed',
  Completed: 'sd-badge--complete',
  Cancelled: 'sd-badge--cancelled',
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
  const API_BASE = getApiBase()
  const navigate = useNavigate()

  const [queue, setQueue] = useState([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [statusLoading, setStatusLoading] = useState(null)
  const [removeLoading, setRemoveLoading] = useState(null)
  const [toast, setToast] = useState({ message: '', type: '', visible: false })
  const [completedCount, setCompletedCount] = useState(0)


  const [allPatients, setAllPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [addPatientLoading, setAddPatientLoading] = useState(false)

  // ── Add new patient popup ──
  const [showAddPatientPopup, setShowAddPatientPopup] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientEmail, setNewPatientEmail] = useState('')
  const [newPatientNameError, setNewPatientNameError] = useState('')
  const [newPatientEmailError, setNewPatientEmailError] = useState('')
  const [addingPatient, setAddingPatient] = useState(false)
  const [addPatientError, setAddPatientError] = useState('')


  const [availability, setAvailability] = useState(createDefaultAvailability())
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilitySaving, setAvailabilitySaving] = useState(false)

  const [clinicDetails, setClinicDetails] = useState(null)


  const [appointmentDate, setAppointmentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [appointments, setAppointments] = useState([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
  const [appointmentsError, setAppointmentsError] = useState(null)

  const [cancelAppointmentLoading, setCancelAppointmentLoading] = useState(null)
  const [rescheduleAppointmentLoading, setRescheduleAppointmentLoading] = useState(null)

  const [showReschedulePopup, setShowReschedulePopup] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduleError, setRescheduleError] = useState('')

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, visible: true })
    setTimeout(() => {
      setToast(current => ({ ...current, visible: false }))
    }, 3000)
  }, [])

    const validateAvailabilityRow = row => {
    if (!row.is_available) return ''

    if (!row.start_time || !row.end_time) {
      return 'Start and end time are required.'
    }

    if (row.start_time >= row.end_time) {
      return 'Start time must be before end time.'
    }

    return ''
  }

  const fetchClinicDetails = useCallback(async () => {
  if (authLoading || !resolvedClinicId) return

  try {
    const res = await fetch(`${API_BASE}/api/clinics/${resolvedClinicId}`, {
      headers: { Accept: 'application/json' },
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load clinic details.')
    }

    setClinicDetails(data.clinic)
  } catch (err) {
    showToast(err.message, 'error')
  }
}, [authLoading, resolvedClinicId, API_BASE, showToast])


  const fetchAvailability = useCallback(async () => {
  if (authLoading || !user?.id || !clinicDetails) return

  setAvailabilityLoading(true)

  try {
    const res = await fetch(`${API_BASE}/api/staff/${user.id}/availability`, {
      headers: { Accept: 'application/json' },
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load availability.')
    }

    const byDay = new Map((data.availability || []).map(item => [item.day_of_week, item]))

    setAvailability(
      DAYS.map(day => {
        const existing = byDay.get(day.value)
        const clinicHours = getClinicDayHours(clinicDetails, day.label)
        const clinicIsOpen = Boolean(clinicHours.start_time && clinicHours.end_time)

        return {
          day_of_week: day.value,
          day_label: day.label,
          id: existing?.id || null,
          start_time: clinicHours.start_time,
          end_time: clinicHours.end_time,
          is_available: clinicIsOpen,
          error: '',
        }
      })
    )
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    setAvailabilityLoading(false)
  }
}, [authLoading, user?.id, API_BASE, showToast, clinicDetails])



  useEffect(() => {
  if (clinicDetails) {
    fetchAvailability()
  }
}, [clinicDetails, fetchAvailability])

  const updateAvailabilityField = (dayOfWeek, field, value) => {
    setAvailability(current =>
      current.map(row => {
        if (row.day_of_week !== dayOfWeek) return row

        let updated = {
          ...row,
          [field]: value,
        }

        if (field === 'is_available' && value === true) {
          const clinicHours = getClinicDayHours(clinicDetails, row.day_label)

          updated = {
            ...updated,
            start_time: updated.start_time || clinicHours.start_time,
            end_time: updated.end_time || clinicHours.end_time,
          }
        }

        return {
          ...updated,
          error: validateAvailabilityRow(updated),
        }
      })
    )
  }

  const handleSaveAvailability = async () => {
    if (!user?.id) return

    const prepared = availability.map(row => ({
      ...row,
      error: validateAvailabilityRow(row),
    }))

    setAvailability(prepared)

    if (prepared.some(row => row.error)) {
      showToast('Please fix availability errors first.', 'error')
      return
    }

    setAvailabilitySaving(true)

    try {
      for (const row of prepared) {
        const payload = {
          start_time: row.start_time,
          end_time: row.end_time,
          is_available: row.is_available,
        }

        if (row.id) {
          const res = await fetch(
            `${API_BASE}/api/staff/${user.id}/availability/${row.id}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify(payload),
            }
          )

          const body = await res.json().catch(() => ({}))

          if (!res.ok) {
            throw new Error(body.error || `Failed to update ${row.day_label}.`)
          }
        } else {
          const res = await fetch(`${API_BASE}/api/staff/${user.id}/availability`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              day_of_week: row.day_of_week,
              start_time: row.start_time,
              end_time: row.end_time,
              is_available: row.is_available,
            }),
          })

          const body = await res.json().catch(() => ({}))

          if (!res.ok) {
            if (body.error?.includes('already exists')) {
              continue
            }
            throw new Error(body.error || `Failed to create ${row.day_label}.`)
          }
        }
      }

      await fetchAvailability()
      showToast('Availability saved successfully.', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setAvailabilitySaving(false)
    }
  }

  
const fetchAppointmentsByDate = useCallback(async () => {
  if (authLoading || !resolvedClinicId || !appointmentDate) return

  setAppointmentsLoading(true)
  setAppointmentsError(null)

  try {
    const res = await fetch(
      `${API_BASE}/api/appointments/clinic/${resolvedClinicId}?date=${appointmentDate}`,
      {
        headers: { Accept: 'application/json' },
      }
    )

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load appointments.')
    }

    setAppointments(Array.isArray(data.appointments) ? data.appointments : [])
  } catch (err) {
    setAppointmentsError(err.message)
  } finally {
    setAppointmentsLoading(false)
  }
}, [authLoading, resolvedClinicId, appointmentDate, API_BASE])


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
      // console.log('FIRST ENTRY PATIENT:', data.queue[0]?.patient)
      // console.log('FIRST ENTRY NAME:', data.queue[0]?.patient?.full_name)
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setFetchLoading(false)
    }
  }, [authLoading, resolvedClinicId])

const fetchCompletedCount = useCallback(async () => {
  if (authLoading || !resolvedClinicId) return

  try {
    const res = await fetch(`${API_BASE}/api/queue/${resolvedClinicId}/completed-count`, {
      headers: { Accept: 'application/json' },
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load completed count.')
    }

    setCompletedCount(data.completedCount || 0)
  } catch (err) {
    console.error('Failed to fetch completed count:', err.message)
  }
}, [authLoading, resolvedClinicId, API_BASE])

const fetchPatients = useCallback(async () => {
  if (authLoading) return

  try {
    const res = await fetch(`${API_BASE}/api/users`, {
      headers: { Accept: 'application/json' },
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load patients.')
    }

    setAllPatients(Array.isArray(data.users) ? data.users : [])
  } catch (err) {
    console.error('Failed to fetch patients:', err.message)
  }
}, [authLoading, API_BASE])


useEffect(() => {
  fetchQueue()
  fetchCompletedCount()
  fetchPatients()
  fetchClinicDetails()
  fetchAppointmentsByDate()
}, [
  fetchQueue,
  fetchCompletedCount,
  fetchPatients,
  fetchClinicDetails,
  fetchAppointmentsByDate,
])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchQueue()
      fetchCompletedCount()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchQueue, fetchCompletedCount])

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
        current.map(item =>
          item.id === entry.id
            ? {
                ...item,
                ...data.entry,
                patient: data.entry.patient || item.patient,
              }
            : item
        )
      )
      await fetchQueue()
      await fetchCompletedCount()
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
      await fetchQueue()
      await fetchCompletedCount()
      showToast(`${getDisplayName(entry)} removed from the queue.`, 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setRemoveLoading(null)
    }
  }


  const handleCancelAppointment = async appointment => {
  setCancelAppointmentLoading(appointment.id)

  try {
    const res = await fetch(`${API_BASE}/api/appointments/${appointment.id}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Could not cancel appointment.')
    }

    await fetchAppointmentsByDate()
    showToast('Appointment cancelled successfully.', 'success')
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    setCancelAppointmentLoading(null)
  }
}

const openReschedulePopup = appointment => {
  const slotDate = appointment.slot_datetime?.slice(0, 10) || appointmentDate
  const slotTime = appointment.slot_datetime?.slice(11, 16) || ''

  setSelectedAppointment(appointment)
  setRescheduleDate(slotDate)
  setRescheduleTime(slotTime)
  setRescheduleError('')
  setShowReschedulePopup(true)
}

const handleRescheduleAppointment = async () => {
  if (!selectedAppointment) return

  setRescheduleError('')

  if (!rescheduleDate || !rescheduleTime) {
    setRescheduleError('Date and time are required.')
    return
  }

  setRescheduleAppointmentLoading(selectedAppointment.id)

  try {
    const res = await fetch(`${API_BASE}/api/appointments/${selectedAppointment.id}/reschedule`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        date: rescheduleDate,
        time: rescheduleTime,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Could not reschedule appointment.')
    }

    setShowReschedulePopup(false)
    setSelectedAppointment(null)
    await fetchAppointmentsByDate()
    showToast('Appointment rescheduled successfully.', 'success')
  } catch (err) {
    setRescheduleError(err.message)
  } finally {
    setRescheduleAppointmentLoading(null)
  }
}

const getAppointmentPatientName = appointment => {
  return appointment.patient?.full_name || appointment.patient_name || appointment.patient_id
}

const getAppointmentPatientEmail = appointment => {
  return appointment.patient?.email || appointment.patient_email || '—'
}

const formatAppointmentTime = appointment => {
  if (!appointment.slot_datetime) return appointment.time || '—'
  return appointment.slot_datetime.slice(11, 16)
}
  
const handleAddPatientToQueue = async () => {
  if (!resolvedClinicId || !selectedPatientId) return

  setAddPatientLoading(true)

  try {
    const response = await fetch(`${API_BASE}/api/queue/${resolvedClinicId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        patient_id: selectedPatientId,
        confirmed: true,
      }),
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(body.error || 'Failed to add patient to queue')
    }

    await fetchQueue()
    await fetchCompletedCount()
    setSelectedPatientId('')
    showToast('Patient added to queue.', 'success')
  } catch (err) {
    showToast(err.message || 'Failed to add patient to queue', 'error')
  } finally {
    setAddPatientLoading(false)
  }
}  

const handleAddNewPatient = async () => {
  let valid = true
  setNewPatientNameError('')
  setNewPatientEmailError('')
  setAddPatientError('')

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
  if (!valid) return

  setAddingPatient(true)
  try {
    const res = await fetch(`${API_BASE}/api/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        full_name: newPatientName.trim(),
        email: newPatientEmail.trim(),
        created_by: user.id,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Failed to create patient.')

    const created = data.patient
    setAllPatients(prev => [...prev, created])
    setSelectedPatientId(created.id)
    setShowAddPatientPopup(false)
    setNewPatientName('')
    setNewPatientEmail('')
    showToast(`${created.full_name} added as a new patient.`, 'success')
  } catch (err) {
    setAddPatientError(err.message)
  } finally {
    setAddingPatient(false)
  }
}

const handleGoToBooking = async () => {
  if (!resolvedClinicId) {
    showToast('No clinic is linked to this staff account.', 'error')
    return
  }

  try {
    const res = await fetch(`${API_BASE}/api/clinics`, {
      headers: { Accept: 'application/json' },
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load clinic.')
    }

    const clinic = (data.clinics || []).find(c => c.id === resolvedClinicId)

    if (!clinic) {
      throw new Error('Assigned clinic not found.')
    }

    navigate('/booking', {
  state: {
    clinic,
    bookingMode: 'staff',
  },
})
  } catch (err) {
    showToast(err.message, 'error')
  }
}
  const stats = {
    total: queue.length,
    waiting: queue.filter(entry => entry.status === 'Waiting').length,
    consultation: queue.filter(entry => entry.status === 'In Consultation').length,
    complete: completedCount,  
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
            <p className="sd-stat-value sd-stat-value--yellow">{stats.consultation}</p>
          </li>
          <li className="sd-stat">
            <p className="sd-stat-label">Complete</p>
            <p className="sd-stat-value sd-stat-value--green">{stats.complete}</p>
          </li>
        </ul>

        <section className="sd-panel">
          <header className="sd-panel-header">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>

              <button
                className="sd-act-btn"
                type="button"
                onClick={() => {
                  setNewPatientName('')
                  setNewPatientEmail('')
                  setNewPatientNameError('')
                  setNewPatientEmailError('')
                  setAddPatientError('')
                  setShowAddPatientPopup(true)
                }}
              >
                + Add new patient
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault()
                handleAddPatientToQueue()
              }}
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <label htmlFor="patientSelect" className="sr-only">
                Select patient
              </label>

              <select
                id="patientSelect"
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                className="sd-act-btn"
                style={{ minWidth: '240px', background: 'white' }}
              >
                <option value="">Select a patient</option>
                {allPatients.map(patient => (
                  <option key={patient.id} value={patient.id}>
                    {patient.full_name} ({patient.role})
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="sd-act-btn"
                disabled={addPatientLoading || !selectedPatientId}
              >
                {addPatientLoading ? 'Adding…' : 'Add to queue'}
              </button>
            </form>
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
                    <th>Patient Email</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((entry, index) => (
                    <tr key={entry.id}>
                      <td className="sd-pos">
                        {entry.status === 'In Consultation'
                          ? 0
                          : queue.filter(
                              item =>
                                item.status !== 'In Consultation' &&
                                (item.position ?? 999999) < (entry.position ?? 999999)
                            ).length + 1}
                      </td>
                      <td>{getDisplayName(entry)}</td>
                      <td>{entry.patient?.email}</td>
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

        <section className="sd-panel" style={{ marginTop: 24 }}>
          <header className="sd-panel-header">
            <section>
              <h2 className="sd-panel-title">Clinic appointments</h2>
              <p className="sd-stat-label">
                View, add, cancel, and reschedule appointments for the selected date.
              </p>
            </section>

            <form
              onSubmit={e => {
                e.preventDefault()
                fetchAppointmentsByDate()
              }}
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <label htmlFor="appointmentDate" className="sr-only">
                Appointment date
              </label>

              <input
                id="appointmentDate"
                type="date"
                className="sd-act-btn"
                style={{ background: 'white' }}
                value={appointmentDate}
                onChange={e => setAppointmentDate(e.target.value)}
              />

              <button type="submit" className="sd-act-btn">
                View
              </button>

              <button
                type="button"
                className="sd-act-btn sd-act-btn--primary"
                onClick={handleGoToBooking}
              >
                Add appointment
              </button>
            </form>
          </header>

          {appointmentsLoading && <p className="sd-empty">Loading appointments…</p>}

          {appointmentsError && !appointmentsLoading && (
            <p className="sd-empty" style={{ color: '#B91C1C' }}>
              {appointmentsError}
              <button
                className="sd-act-btn"
                style={{ display: 'inline', marginLeft: 8 }}
                onClick={fetchAppointmentsByDate}
              >
                Retry
              </button>
            </p>
          )}

          {!appointmentsLoading && !appointmentsError && appointments.length === 0 && (
            <p className="sd-empty">No appointments found for this date.</p>
          )}

          {!appointmentsLoading && !appointmentsError && appointments.length > 0 && (
            <section className="sd-table-wrap">
              <table className="sd-table" aria-label="Clinic appointments">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Patient</th>
                    <th>Patient Email</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {appointments.map(appointment => (
                    <tr key={appointment.id}>
                      <td>{formatAppointmentTime(appointment)}</td>
                      <td>{getAppointmentPatientName(appointment)}</td>
                      <td>{getAppointmentPatientEmail(appointment)}</td>
                      <td>
                        <span className={`sd-badge ${BADGE_CLASS[appointment.status] ?? ''}`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td>
                        <ul className="sd-actions">
                          <li>
                            <button
                              type="button"
                              className="sd-act-btn"
                              onClick={() => openReschedulePopup(appointment)}
                              disabled={
                                appointment.status === 'Cancelled' ||
                                rescheduleAppointmentLoading === appointment.id
                              }
                            >
                              {rescheduleAppointmentLoading === appointment.id
                                ? 'Saving…'
                                : 'Reschedule'}
                            </button>
                          </li>

                          <li>
                            <button
                              type="button"
                              className="sd-act-btn sd-act-btn--danger"
                              onClick={() => handleCancelAppointment(appointment)}
                              disabled={
                                appointment.status === 'Cancelled' ||
                                cancelAppointmentLoading === appointment.id
                              }
                            >
                              {cancelAppointmentLoading === appointment.id
                                ? 'Cancelling…'
                                : 'Cancel'}
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
      
          
        {resolvedClinicId && (
        <section className="sd-availability">

        <header className="sd-availability-header">
          <h2 className="sd-panel-title">Availability</h2>
          <p className="sd-stat-label">Set the days and times you are available for bookings.</p>
        </header>

        {availabilityLoading ? (
          <p className="sd-empty">Loading availability…</p>
        ) : (
          <section className="sd-availability-grid">
            {availability.map(row => (
              <section key={row.day_of_week} className="sd-availability-row">
                <span className="sd-availability-day">{row.day_label}</span>

                <label className="sd-availability-toggle">
                  <input
                    type="checkbox"
                    checked={row.is_available}
                    onChange={e =>
                      updateAvailabilityField(row.day_of_week, 'is_available', e.target.checked)
                    }
                  />
                  Available
                </label>

                <label>
                  <span className="sr-only">{row.day_label} start time</span>
                  <input
                    type="time"
                    className="sd-availability-input"
                    value={row.start_time}
                    disabled={!row.is_available}
                    onChange={e =>
                      updateAvailabilityField(row.day_of_week, 'start_time', e.target.value)
                    }
                  />
                </label>

                <label>
                  <span className="sr-only">{row.day_label} end time</span>
                  <input
                    type="time"
                    className="sd-availability-input"
                    value={row.end_time}
                    disabled={!row.is_available}
                    onChange={e =>
                      updateAvailabilityField(row.day_of_week, 'end_time', e.target.value)
                    }
                  />
                </label>

                <section>
                  {row.error ? (
                    <p className="sd-availability-error">{row.error}</p>
                  ) : row.start_time && row.end_time ? (
                    <span className="sd-stat-label">Ready</span>
                  ) : (
                    <span className="sd-stat-label">Clinic closed</span>
                  )}
                </section>
              </section>
            ))}

            <button
              type="button"
              className="sd-act-btn"
              onClick={handleSaveAvailability}
              disabled={availabilitySaving}
            >
              {availabilitySaving ? 'Saving…' : 'Save availability'}
            </button> 
          </section>
        )}
      </section>)}


      </section>
      
      
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

      {/* ── Add new patient popup ── */}
      {showAddPatientPopup && (
        <div
          className="sd-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-patient-title"
          onClick={e => { if (e.target === e.currentTarget) setShowAddPatientPopup(false) }}
        >
          <div className="sd-dialog">
            <div className="sd-dialog-icon">🧑‍⚕️</div>
            <h2 className="sd-dialog-title" id="add-patient-title">Add New Patient</h2>
            <p className="sd-dialog-subtitle">Enter the patient's details to create their record.</p>

            <div className="sd-dialog-field">
              <label className="sd-dialog-label" htmlFor="sd-new-patient-name">Full name</label>
              <input
                id="sd-new-patient-name"
                className={`sd-dialog-input ${newPatientNameError ? 'sd-dialog-input--error' : ''}`}
                type="text"
                placeholder="e.g. Amara Dlamini"
                value={newPatientName}
                onChange={e => { setNewPatientName(e.target.value); setNewPatientNameError('') }}
              />
              {newPatientNameError && <span className="sd-dialog-error-text">{newPatientNameError}</span>}
            </div>

            <div className="sd-dialog-field">
              <label className="sd-dialog-label" htmlFor="sd-new-patient-email">Email address</label>
              <input
                id="sd-new-patient-email"
                className={`sd-dialog-input ${newPatientEmailError ? 'sd-dialog-input--error' : ''}`}
                type="email"
                placeholder="e.g. amara@example.com"
                value={newPatientEmail}
                onChange={e => { setNewPatientEmail(e.target.value); setNewPatientEmailError('') }}
              />
              {newPatientEmailError && <span className="sd-dialog-error-text">{newPatientEmailError}</span>}
            </div>

            {addPatientError && (
              <div className="sd-dialog-submit-error" role="alert">⚠ {addPatientError}</div>
            )}

            <div className="sd-dialog-actions">
              <button
                className="sd-act-btn"
                onClick={() => setShowAddPatientPopup(false)}
                disabled={addingPatient}
              >
                Cancel
              </button>
              <button
                className="sd-act-btn sd-act-btn--primary"
                onClick={handleAddNewPatient}
                disabled={addingPatient}
              >
                {addingPatient ? 'Saving…' : 'Add Patient'}
              </button>
            </div>
          </div>
        </div>
      )}



      
    </>
  )
}