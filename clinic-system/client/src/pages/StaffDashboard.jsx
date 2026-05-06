import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import getApiBase from '../lib/getApiBase'
import { useNavigate } from 'react-router-dom'



// The styles variable contains all the CSS styles for the StaffDashboard component, defined as a template literal string.
const styles = `
  .sd-page {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 24px;
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

  .sd-clinic-card {
  background: var(--uh-surface);
  border: 1px solid var(--uh-border);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: var(--uh-shadow);
}

.sd-clinic-card-label {
  font-size: 12px;
  color: var(--uh-muted);
  margin-bottom: 4px;
}

.sd-clinic-card-name {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--uh-text);
  margin: 0;
}

.sd-clinic-card-meta {
  font-size: 13px;
  color: var(--uh-muted);
  margin-top: 4px;
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
    .sd-table th:nth-child(1),
.sd-table td:nth-child(1) {
  width: 80px;
}

.sd-table th:nth-child(2),
.sd-table td:nth-child(2) {
  min-width: 150px;
}

.sd-table th:nth-child(3),
.sd-table td:nth-child(3) {
  min-width: 260px;
}

.sd-table th:nth-child(4),
.sd-table td:nth-child(4) {
  width: 130px;
}

.sd-table th:nth-child(5),
.sd-table td:nth-child(5) {
  min-width: 380px;
}

.sd-actions {
  flex-wrap: nowrap;
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

  .sd-availability-table {
  display: grid;
  gap: 10px;
  padding: 16px 20px 20px;
}

.sd-availability-table-header,
.sd-availability-row {
  display: grid;
  grid-template-columns: 160px 120px 1fr 1fr 90px;
  gap: 12px;
  align-items: center;
}

.sd-availability-table-header {
  padding: 0 12px;
  font-size: 11px;
  font-weight: 700;
  color: var(--uh-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.sd-availability-row {
  padding: 12px;
  border: 1px solid var(--uh-border);
  border-radius: 10px;
  background: var(--uh-bg);
}

.sd-availability-day {
  font-weight: 700;
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
  width: 100%;
  max-width: 130px;
  height: 40px;
  border: 1px solid var(--uh-border);
  border-radius: 8px;
  padding: 0 10px;
  font: inherit;
  background: white;
  color: var(--uh-text);
}

.sd-availability-status {
  font-size: 13px;
  color: var(--uh-muted);
}

.sd-availability-error {
  color: #B91C1C;
  font-size: 12px;
}

@media (max-width: 820px) {
  .sd-availability-table-header {
    display: none;
  }

  .sd-availability-row {
    grid-template-columns: 1fr;
  }

  .sd-availability-input {
    max-width: none;
  }
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

  .sd-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 20px;
  align-items: start;
}

.sd-sidebar {
  background: var(--uh-surface);
  border: 1px solid var(--uh-border);
  border-radius: 14px;
  box-shadow: var(--uh-shadow);
  padding: 12px;
  position: sticky;
  top: 20px;
}

.sd-sidebar-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--uh-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 8px 10px 12px;
}

.sd-nav-btn {
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 10px;
  padding: 11px 12px;
  text-align: left;
  font-size: 14px;
  font-weight: 700;
  color: var(--uh-text);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: inherit;
}

.sd-nav-btn:hover {
  background: var(--uh-bg);
}

.sd-nav-btn--active {
  background: #EFF6FF;
  color: #1D4ED8;
}

.sd-nav-count {
  font-size: 11px;
  background: var(--uh-bg);
  color: var(--uh-muted);
  padding: 2px 8px;
  border-radius: 999px;
}

.sd-nav-btn--active .sd-nav-count {
  background: #DBEAFE;
  color: #1D4ED8;
}

.sd-content {
  min-width: 0;
}

@media (max-width: 820px) {
  .sd-layout {
    grid-template-columns: 1fr;
  }

  .sd-sidebar {
    position: static;
  }
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

  .sd-slot-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 8px;
}

.sd-slot-btn {
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

.sd-slot-btn:hover {
  border-color: #2563EB;
  color: #2563EB;
  background: #EFF6FF;
}

.sd-slot-btn--selected {
  background: #2563EB;
  border-color: #2563EB;
  color: #fff;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
}

.sd-slot-empty {
  text-align: center;
  padding: 18px;
  color: var(--uh-muted);
  font-size: 13px;
  background: #F9FAFB;
  border-radius: 12px;
  border: 1.5px dashed var(--uh-border);
}

@media (max-width: 520px) {
  .sd-slot-grid {
    grid-template-columns: repeat(3, 1fr);
  }
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


// The DAYS constant defines an array of objects representing the days of the week, 
// each with a label and a corresponding value (0 for Monday through 6 for Sunday).
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

// The formatDisplayDate function takes a date string in the format 'YYYY-MM-DD' and returns a formatted date string in the format 'Weekday, Day Month Year'.
function formatDisplayDate(dateStr) {
  if (!dateStr) return ''

  const [year, month, day] = dateStr.split('-').map(Number)

  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
// The getClinicDayHours function retrieves the operating hours for a specific day of the week from the clinic's details. 
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

// The STATUS_SEQUENCE array defines the order of queue statuses for display purposes, while the BADGE_CLASS object maps each status to a corresponding CSS class for styling badges in the UI.
const STATUS_SEQUENCE = ['Waiting', 'In Consultation', 'Complete']

const BADGE_CLASS = {
  Waiting: 'sd-badge--waiting',
  Called: 'sd-badge--called',
  'In Consultation': 'sd-badge--consultation',
  Complete: 'sd-badge--complete',

  Confirmed: 'sd-badge--confirmed',
  Completed: 'sd-badge--complete',
  Cancelled: 'sd-badge--cancelled',
  'No-show': 'sd-badge--cancelled',
  
}

const CLINIC_TIME_ZONE = 'Africa/Johannesburg'

// The Toast component is a reusable component for displaying temporary notification messages to the user. 
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

// The formatTimeLabel function takes a time string in the format 'HH:MM' and converts it to a more user-friendly format with AM/PM notation, such as '2:30 PM'. 
function formatTimeLabel(timeStr) {
  if (!timeStr) return ''

  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12

  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function getLocalDateTimeParts(dateString) {
  if (!dateString) return { date: '', time: '' }

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return {
      date: typeof dateString === 'string' ? dateString.slice(0, 10) : '',
      time: typeof dateString === 'string' ? dateString.slice(11, 16) : '',
    }
  }

  const parts = new Intl.DateTimeFormat('en-ZA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const valueByType = Object.fromEntries(parts.map(part => [part.type, part.value]))

  return {
    date: `${valueByType.year}-${valueByType.month}-${valueByType.day}`,
    time: `${valueByType.hour}:${valueByType.minute}`,
  }
}

function getDisplayName(entry) {
  return entry.patient?.full_name || entry.patient_id
}

// The StaffDashboard component is the main component for the staff dashboard page, responsible for fetching and displaying clinic details, managing staff availability, and handling appointments and queue management. 
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

  const [rescheduleAppointmentLoading, setRescheduleAppointmentLoading] = useState(null)
  const [appointmentStatusLoading, setAppointmentStatusLoading] = useState(null)

  const [showReschedulePopup, setShowReschedulePopup] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduleError, setRescheduleError] = useState('')

  const [rescheduleSlots, setRescheduleSlots] = useState([])
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false)
  const [rescheduleSlotsError, setRescheduleSlotsError] = useState('')

  const [activeSection, setActiveSection] = useState('queue')


  const [showCancelAppointmentPopup, setShowCancelAppointmentPopup] = useState(false)
  const [appointmentToCancel, setAppointmentToCancel] = useState(null)
  const [cancelAppointmentLoading, setCancelAppointmentLoading] = useState(false)
  const [cancelAppointmentError, setCancelAppointmentError] = useState('')


  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, visible: true })
    setTimeout(() => {
      setToast(current => ({ ...current, visible: false }))
    }, 3000)
  }, [])

  const openCancelAppointmentPopup = appointment => {
  setAppointmentToCancel(appointment)
  setCancelAppointmentError('')
  setShowCancelAppointmentPopup(true)
}

const closeCancelAppointmentPopup = () => {
  if (cancelAppointmentLoading) return

  setShowCancelAppointmentPopup(false)
  setAppointmentToCancel(null)
  setCancelAppointmentError('')
}

const handleConfirmCancelAppointment = async () => {
  if (!appointmentToCancel) return

  setCancelAppointmentLoading(true)
  setCancelAppointmentError('')

  try {
    const res = await fetch(`${API_BASE}/api/appointments/${appointmentToCancel.id}/cancel`, {
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

    setAppointments(current =>
      current.filter(appointment => appointment.id !== appointmentToCancel.id)
    )

    setShowCancelAppointmentPopup(false)
    setAppointmentToCancel(null)
    showToast(data.message || 'Appointment cancelled successfully.', 'success')
  } catch (err) {
    setCancelAppointmentError(err.message || 'Could not cancel appointment.')
  } finally {
    setCancelAppointmentLoading(false)
  }
}

  
  // The validateAvailabilityRow function checks the validity of an availability entry for a specific day, 
  // ensuring that if the day is marked as available,
  // both start and end times are provided and that the start time is before the end time.
const validateAvailabilityRow = row => {
  if (!row.is_available) return ''

  const hasStart = Boolean(row.start_time)
  const hasEnd = Boolean(row.end_time)

  if (!hasStart && !hasEnd) {
    return ''
  }

  if (hasStart !== hasEnd) {
    return 'Both start and end time are required.'
  }

  if (row.start_time >= row.end_time) {
    return 'Start time must be before end time.'
  }

  return ''
}

// The fetchClinicDetails function is responsible for fetching the details of the clinic associated with the staff member. 
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


// The fetchAvailability function retrieves the staff member's availability for each day of the week from the server. 
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
          start_time: existing?.start_time?.slice(0, 5) || clinicHours.start_time,
          end_time: existing?.end_time?.slice(0, 5) || clinicHours.end_time,
          is_available: existing?.is_available ?? clinicIsOpen,
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

// The updateAvailabilityField function is used to update a specific field (such as start time, end time, or availability status) for a given day of the week in the staff member's availability.
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

  // The handleSaveAvailability function is responsible for validating the staff member's availability entries and sending the appropriate API requests to save any changes to the server.
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

  const rowsToSave = prepared.filter(row => {
    if (!row.is_available) return row.id
    return row.start_time && row.end_time
  })

  if (rowsToSave.length === 0) {
    showToast('No availability changes to save.', 'error')
    return
  }

  setAvailabilitySaving(true)
// The function iterates through the availability entries that need to be saved.
  try {
    for (const row of rowsToSave) {
      const payload = {
        start_time: row.start_time || null,
        end_time: row.end_time || null,
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
      } else if (row.is_available && row.start_time && row.end_time) {
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
            is_available: true,
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

    await fetchClinicDetails()
    await fetchAvailability()

    showToast('Availability saved successfully.', 'success')
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    setAvailabilitySaving(false)
  }
}
  
// The fetchAppointmentsByDate function retrieves the list of appointments for the clinic on a specific date, filtering out any past appointments or those with final statuses (Cancelled, Completed, No-show) to display only active future appointments.
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

    const finalStatuses = ['Cancelled', 'Completed', 'No-show']

    const activeFutureAppointments = (Array.isArray(data.appointments)
      ? data.appointments
      : []
    ).filter(appointment => {
      if (!appointment.slot_datetime) return false

      const appointmentDateTime = new Date(appointment.slot_datetime)
      const now = new Date()

      return (
        appointmentDateTime > now &&
        !finalStatuses.includes(appointment.status)
      )
    })

    setAppointments(activeFutureAppointments)

  } catch (err) {
    setAppointmentsError(err.message)
  } finally {
    setAppointmentsLoading(false)
  }
}, [authLoading, resolvedClinicId, appointmentDate, API_BASE])

// The fetchQueue function is responsible for fetching the current queue of patients for the clinic, handling loading and error states, and updating the queue state with the retrieved data.
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

// The fetchCompletedCount function retrieves the count of completed appointments for the clinic.
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
// The fetchPatients function retrieves the list of all patients from the server, handling loading and error states, and updating the allPatients state with the retrieved data.
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

// The useEffect hook is used to trigger the initial data fetching for the queue, completed count, patients, clinic details, and appointments when the component mounts or when any of the dependencies change.
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
      fetchPatients()
      fetchAppointmentsByDate()
    }, 30000)

    return () => clearInterval(interval)
  }, [
    fetchQueue,
    fetchCompletedCount,
    fetchPatients,
    fetchAppointmentsByDate,
  ])
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
  // The handleRemove function is responsible for removing a patient from the queue by sending a DELETE request to the server, updating the queue state, and handling loading and error states.
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

  // The handleAppointmentStatusUpdate function updates the status of a specific appointment by sending a PATCH request to the server, updating the appointments state, and handling loading and error states.
const handleAppointmentStatusUpdate = async (appointment, status) => {
  setAppointmentStatusLoading(`${appointment.id}-${status}`)

  try {
    const res = await fetch(`${API_BASE}/api/appointments/${appointment.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ status }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Could not update appointment status.')
    }

    setAppointments(current =>
      current.map(item =>
        item.id === appointment.id
          ? { ...item, status: data.appointment.status }
          : item
      )
    )

    showToast(data.message || `Appointment marked as ${status}.`, 'success')
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    setAppointmentStatusLoading(null)
  }
}


// The openReschedulePopup function is called when the user wants to reschedule an appointment. 

const openReschedulePopup = appointment => {
  const slotDate = getLocalDateTimeParts(appointment.slot_datetime).date || appointmentDate

  setSelectedAppointment(appointment)
  setRescheduleDate(slotDate)
  setRescheduleTime('')
  setRescheduleError('')
  setRescheduleSlots([])
  setRescheduleSlotsError('')
  setShowReschedulePopup(true)
}

const closeReschedulePopup = () => {
  if (rescheduleAppointmentLoading) return

  setShowReschedulePopup(false)
  setSelectedAppointment(null)
  setRescheduleDate('')
  setRescheduleTime('')
  setRescheduleError('')
  setRescheduleSlots([])
  setRescheduleSlotsError('')
}

const handleRescheduleDateChange = event => {
  setRescheduleDate(event.target.value)
  setRescheduleTime('')
  setRescheduleError('')
  setRescheduleSlotsError('')
}

// The useEffect hook is used to fetch available time slots for rescheduling an appointment whenever the reschedule popup is shown, the selected appointment changes, or the reschedule date changes. 
useEffect(() => {
  if (!showReschedulePopup || !selectedAppointment || !rescheduleDate) {
    setRescheduleSlots([])
    setRescheduleSlotsError('')
    return
  }

  async function fetchRescheduleSlots() {
    setRescheduleSlotsLoading(true)
    setRescheduleSlotsError('')

    try {
      const res = await fetch(
        `${API_BASE}/api/appointments/slots?clinic_id=${selectedAppointment.clinic_id}&date=${rescheduleDate}`,
        {
          headers: { Accept: 'application/json' },
        }
      )

      const data = await res.json().catch(() => [])

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load slots.')
      }

      const rawSlots = Array.isArray(data) ? data : []
      const currentAppointmentSlot = getLocalDateTimeParts(selectedAppointment.slot_datetime)

      const availableFutureSlots = rawSlots.filter(slot => {
        const slotDateTime = new Date(`${rescheduleDate}T${slot}:00`)
        const isCurrentAppointmentSlot =
          rescheduleDate === currentAppointmentSlot.date &&
          slot === currentAppointmentSlot.time

        return slotDateTime > new Date() && !isCurrentAppointmentSlot
      })

      setRescheduleSlots(availableFutureSlots)

      setRescheduleTime(currentTime =>
        availableFutureSlots.includes(currentTime) ? currentTime : ''
      )
    } catch (err) {
      setRescheduleSlots([])
      setRescheduleSlotsError(err.message || 'Failed to load available slots.')
    } finally {
      setRescheduleSlotsLoading(false)
    }
  }

  fetchRescheduleSlots()
}, [
  showReschedulePopup,
  selectedAppointment,
  rescheduleDate,
  API_BASE,
])

// The handleRescheduleAppointment function is responsible for validating the rescheduling inputs, sending a PATCH request to the server to update the appointment's date and time, and handling loading and error states.
const handleRescheduleAppointment = async () => {
  if (!selectedAppointment) return

  if (rescheduleAppointmentLoading === selectedAppointment.id) return

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

    const message = data.message || 'Appointment rescheduled successfully.'

    setShowReschedulePopup(false)
    setSelectedAppointment(null)
    setRescheduleDate('')
    setRescheduleTime('')
    setRescheduleSlots([])
    setRescheduleSlotsError('')
    setRescheduleError('')
    await fetchAppointmentsByDate()
    showToast(message, 'success')
  } catch (err) {
    setRescheduleError(err.message)
  } finally {
    setRescheduleAppointmentLoading(null)
  }
}
// The getAppointmentPatientName function retrieves the patient's name for a given appointment, checking multiple possible fields to accommodate different data structures.
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
  
// The handleAddNewPatient function validates the inputs for adding a new patient, sends a POST request to create the patient on the server, and updates the state accordingly while handling loading and error states. 
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
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        full_name: newPatientName.trim(),
        email: newPatientEmail.trim(),
        created_by: user.id,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Failed to create patient.')
    }

    const created = data.patient

    setShowAddPatientPopup(false)
    setNewPatientName('')
    setNewPatientEmail('')
    setSelectedPatientId(created.id)

    await Promise.all([
      fetchPatients(),
      fetchQueue(),
      fetchCompletedCount(),
      fetchAppointmentsByDate(),
    ])

    showToast(`${created.full_name} added as a new patient.`, 'success')
  } catch (err) {
    setAddPatientError(err.message)
  } finally {
    setAddingPatient(false)
  }
}


// The handleAddPatientToQueue function adds a selected patient to the queue by sending a POST request to the server, updating the queue and related states, and handling loading and error states.
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

    await Promise.all([
      fetchQueue(),
      fetchCompletedCount(),
      fetchPatients(),
      fetchAppointmentsByDate(),
    ])

    setSelectedPatientId('')
    showToast('Patient added to queue.', 'success')
  } catch (err) {
    showToast(err.message || 'Failed to add patient to queue', 'error')
  } finally {
    setAddPatientLoading(false)
  }
}

// The handleGoToBooking function checks if a clinic is linked to the staff account, fetches the clinic details, and navigates to the booking page with the clinic information and booking mode set to 'staff'. 
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

  const appointmentStats = {
    total: appointments.length,
    confirmed: appointments.filter(appointment => appointment.status === 'Confirmed').length,
    waiting: appointments.filter(appointment => appointment.status === 'Waiting').length,
    completed: appointments.filter(appointment =>
      ['Completed', 'Complete'].includes(appointment.status)
    ).length,
    cancelled: appointments.filter(appointment => appointment.status === 'Cancelled').length,
  }

  // The return statement of the StaffDashboard component renders the UI for the staff dashboard, including sections for clinic details, queue management, appointments, and availability settings, along with a toast component for notifications.
return (
  <>
    <style>{styles}</style>

    <section className="sd-page">
      <h1 className="sd-heading">Staff dashboard</h1>

      <section className="sd-layout">
        <aside className="sd-sidebar">
          <p className="sd-sidebar-title">Sections</p>

          <button
            type="button"
            className={`sd-nav-btn ${activeSection === 'clinic' ? 'sd-nav-btn--active' : ''}`}
            onClick={() => setActiveSection('clinic')}
          >
            Clinic
          </button>

          <button
            type="button"
            className={`sd-nav-btn ${activeSection === 'queue' ? 'sd-nav-btn--active' : ''}`}
            onClick={() => setActiveSection('queue')}
          >
            Queue
            <span className="sd-nav-count">{queue.length}</span>
          </button>

          <button
            type="button"
            className={`sd-nav-btn ${activeSection === 'appointments' ? 'sd-nav-btn--active' : ''}`}
            onClick={() => setActiveSection('appointments')}
          >
            Appointments
            <span className="sd-nav-count">{appointments.length}</span>
          </button>

          <button
            type="button"
            className={`sd-nav-btn ${activeSection === 'availability' ? 'sd-nav-btn--active' : ''}`}
            onClick={() => setActiveSection('availability')}
          >
            Availability
          </button>
        </aside>

        <section className="sd-content">
          {activeSection === 'clinic' && (
            <>
              {resolvedClinicId ? (
                <section className="sd-clinic-card">
                  <p className="sd-clinic-card-label">Assigned clinic</p>

                  <h2 className="sd-clinic-card-name">
                    {clinicDetails?.name || 'Loading clinic...'}
                  </h2>

                  {clinicDetails && (
                    <p className="sd-clinic-card-meta">
                      {[clinicDetails.facility_type, clinicDetails.municipality, clinicDetails.district]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  )}
                </section>
              ) : (
                <p className="sd-empty">No clinic is linked to this staff account.</p>
              )}
            </>
          )}

          {/* Queue Section * */}
          {activeSection === 'queue' && (
            <>
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
                  <section>
                    <h2 className="sd-panel-title">Clinic queue</h2>
                    <p className="sd-stat-label">
                      View, add, and manage walk-in patients currently waiting at the clinic.
                    </p>
                  </section>

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
                {/* The code above checks if the queue is currently being loaded (fetchLoading) and displays a loading message if it is. */}
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
                        {queue.map(entry => (
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
            </>
          )}

          {/* Appointments Section * */}
          {activeSection === 'appointments' && (
            <>
              <h2 className="sd-heading" style={{ marginTop: 0 }}>
                Clinic appointments for {formatDisplayDate(appointmentDate)} ({appointmentDate})
              </h2>

              <ul className="sd-stats" aria-label="Appointment summary">
                <li className="sd-stat">
                  <p className="sd-stat-label">Total appointments</p>
                  <p className="sd-stat-value sd-stat-value--black">{appointmentStats.total}</p>
                </li>

                <li className="sd-stat">
                  <p className="sd-stat-label">Confirmed</p>
                  <p className="sd-stat-value sd-stat-value--blue">{appointmentStats.confirmed}</p>
                </li>

                <li className="sd-stat">
                  <p className="sd-stat-label">Waiting</p>
                  <p className="sd-stat-value sd-stat-value--yellow">{appointmentStats.waiting}</p>
                </li>

                <li className="sd-stat">
                  <p className="sd-stat-label">Completed</p>
                  <p className="sd-stat-value sd-stat-value--green">{appointmentStats.completed}</p>
                </li>

                <li className="sd-stat">
                  <p className="sd-stat-label">Cancelled</p>
                  <p className="sd-stat-value" style={{ color: '#B91C1C' }}>
                    {appointmentStats.cancelled}
                  </p>
                </li>
              </ul>

              <section className="sd-panel">
                <header className="sd-panel-header">
                  <section>
                    <h2 className="sd-panel-title">Clinic appointments</h2>
                    <p className="sd-stat-label">
                      View, add, and reschedule upcoming appointments for the selected date.
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
                                {!['Cancelled', 'Completed', 'No-show'].includes(appointment.status) && (
                                  <>
                                    <li>
                                      <button
                                        type="button"
                                        className="sd-act-btn"
                                        onClick={() =>
                                          handleAppointmentStatusUpdate(appointment, 'Completed')
                                        }
                                        disabled={
                                          appointmentStatusLoading === `${appointment.id}-Completed`
                                        }
                                      >
                                        {appointmentStatusLoading === `${appointment.id}-Completed`
                                          ? 'Saving…'
                                          : 'Completed'}
                                      </button>
                                    </li>

                                    <li>
                                      <button
                                        type="button"
                                        className="sd-act-btn sd-act-btn--danger"
                                        onClick={() =>
                                          handleAppointmentStatusUpdate(appointment, 'No-show')
                                        }
                                        disabled={
                                          appointmentStatusLoading === `${appointment.id}-No-show`
                                        }
                                      >
                                        {appointmentStatusLoading === `${appointment.id}-No-show`
                                          ? 'Saving…'
                                          : 'No-show'}
                                      </button>
                                    </li>

                                        <li>
                                          <button
                                              type="button"
                                              className="sd-act-btn sd-act-btn--danger"
                                              onClick={() => openCancelAppointmentPopup(appointment)}
                                              disabled={cancelAppointmentLoading && appointmentToCancel?.id === appointment.id}
                                            >
                                              {cancelAppointmentLoading && appointmentToCancel?.id === appointment.id
                                                ? 'Cancelling…'
                                                : 'Cancel'}
                                            </button>
                                          </li>
                                    <li>
                                      <button
                                        type="button"
                                        className="sd-act-btn"
                                        onClick={() => openReschedulePopup(appointment)}
                                        disabled={rescheduleAppointmentLoading === appointment.id}
                                      >
                                        {rescheduleAppointmentLoading === appointment.id
                                          ? 'Saving…'
                                          : 'Reschedule'}
                                      </button>
                                    </li>
                                  </>
                                )}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}
              </section>
            </>
          )}

          {activeSection === 'availability' && resolvedClinicId && (
            <section className="sd-availability" style={{ marginTop: 0 }}>
              <header className="sd-availability-header">
                <h2 className="sd-panel-title">Availability</h2>
                <p className="sd-stat-label">
                  Set the days and times you are available for bookings.
                </p>
              </header>

              {availabilityLoading ? (
                <p className="sd-empty">Loading availability…</p>
              ) : (
                  <section className="sd-availability-table">
                  <section className="sd-availability-table-header">
                    <span>Day</span>
                    <span>Available</span>
                    <span>Start time</span>
                    <span>End time</span>
                    <span>Status</span>
                  </section>

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

                      <input
                        type="time"
                        className="sd-availability-input"
                        value={row.start_time}
                        disabled={!row.is_available}
                        aria-label={`${row.day_label} start time`}
                        onChange={e =>
                          updateAvailabilityField(row.day_of_week, 'start_time', e.target.value)
                        }
                      />

                      <input
                        type="time"
                        className="sd-availability-input"
                        value={row.end_time}
                        disabled={!row.is_available}
                        aria-label={`${row.day_label} end time`}
                        onChange={e =>
                          updateAvailabilityField(row.day_of_week, 'end_time', e.target.value)
                        }
                      />

                      <section className="sd-availability-status">
                        {row.error ? (
                          <p className="sd-availability-error">{row.error}</p>
                        ) : row.start_time && row.end_time ? (
                          <span>Ready</span>
                        ) : (
                          <span>Clinic closed</span>
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
            </section>
          )}
        </section>
      </section>
    </section>

    <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    
    {/* Add Patient Popup * */}
    {showAddPatientPopup && (
      <div
        className="sd-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-patient-title"
        onClick={e => {
          if (e.target === e.currentTarget) setShowAddPatientPopup(false)
        }}
      >
        <div className="sd-dialog">
          <div className="sd-dialog-icon">🧑‍⚕️</div>
          <h2 className="sd-dialog-title" id="add-patient-title">
            Add New Patient
          </h2>
          <p className="sd-dialog-subtitle">
            Enter the patient's details to create their record.
          </p>

          <div className="sd-dialog-field">
            <label className="sd-dialog-label" htmlFor="sd-new-patient-name">
              Full name
            </label>
            <input
              id="sd-new-patient-name"
              className={`sd-dialog-input ${
                newPatientNameError ? 'sd-dialog-input--error' : ''
              }`}
              type="text"
              placeholder="e.g. Amara Dlamini"
              value={newPatientName}
              onChange={e => {
                setNewPatientName(e.target.value)
                setNewPatientNameError('')
              }}
            />
            {newPatientNameError && (
              <span className="sd-dialog-error-text">{newPatientNameError}</span>
            )}
          </div>

          <div className="sd-dialog-field">
            <label className="sd-dialog-label" htmlFor="sd-new-patient-email">
              Email address
            </label>
            <input
              id="sd-new-patient-email"
              className={`sd-dialog-input ${
                newPatientEmailError ? 'sd-dialog-input--error' : ''
              }`}
              type="email"
              placeholder="e.g. amara@example.com"
              value={newPatientEmail}
              onChange={e => {
                setNewPatientEmail(e.target.value)
                setNewPatientEmailError('')
              }}
            />
            {newPatientEmailError && (
              <span className="sd-dialog-error-text">{newPatientEmailError}</span>
            )}
          </div>

          {addPatientError && (
            <div className="sd-dialog-submit-error" role="alert">
              ⚠ {addPatientError}
            </div>
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

    {showReschedulePopup && selectedAppointment && (
      <div
        className="sd-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-appointment-title"
        onClick={e => {
          if (e.target === e.currentTarget) {
            closeReschedulePopup()
          }
        }}
      >
        <div className="sd-dialog">
          <div className="sd-dialog-icon">📅</div>

          <h2 className="sd-dialog-title" id="reschedule-appointment-title">
            Reschedule Appointment
          </h2>

          <p className="sd-dialog-subtitle">
            Choose a new date and time for {getAppointmentPatientName(selectedAppointment)}.
          </p>

          <div className="sd-dialog-field">
            <label className="sd-dialog-label" htmlFor="reschedule-date">
              New date
            </label>
            <input
              id="reschedule-date"
              className="sd-dialog-input"
              type="date"
              value={rescheduleDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={handleRescheduleDateChange}
            />
          </div>

          <div className="sd-dialog-field">
            <label className="sd-dialog-label">New time</label>

            {!rescheduleDate ? (
              <div className="sd-slot-empty">Pick a date first.</div>
            ) : rescheduleSlotsLoading ? (
              <div className="sd-slot-empty">Loading slots…</div>
            ) : rescheduleSlotsError ? (
              <div className="sd-slot-empty" role="alert">
                {rescheduleSlotsError}
              </div>
            ) : rescheduleSlots.length === 0 ? (
              <div className="sd-slot-empty">No slots available for this date.</div>
            ) : (
              <div
                className="sd-slot-grid"
                role="group"
                aria-label="Available reschedule times"
              >
                {rescheduleSlots.map(slot => (
                  <button
                    key={slot}
                    type="button"
                    className={`sd-slot-btn ${
                      rescheduleTime === slot ? 'sd-slot-btn--selected' : ''
                    }`}
                    onClick={() => setRescheduleTime(slot)}
                    aria-pressed={rescheduleTime === slot}
                  >
                    {formatTimeLabel(slot)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {rescheduleError && (
            <div className="sd-dialog-submit-error" role="alert">
              ⚠ {rescheduleError}
            </div>
          )}

          <div className="sd-dialog-actions">
            <button
              type="button"
              className="sd-act-btn"
              onClick={closeReschedulePopup}
              disabled={rescheduleAppointmentLoading === selectedAppointment.id}
            >
              Cancel
            </button>

            <button
              type="button"
              className="sd-act-btn sd-act-btn--primary"
              onClick={handleRescheduleAppointment}
              disabled={
                rescheduleAppointmentLoading === selectedAppointment.id ||
                !rescheduleDate ||
                !rescheduleTime
              }
            >
              {rescheduleAppointmentLoading === selectedAppointment.id
                ? 'Saving…'
                : 'Confirm Reschedule'}
            </button>
          </div>
        </div>
      </div>
    )}

    {showCancelAppointmentPopup && appointmentToCancel && (
  <div
    className="sd-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cancel-appointment-title"
    onClick={e => {
      if (e.target === e.currentTarget) closeCancelAppointmentPopup()
    }}
  >
    <div className="sd-dialog">
      <div className="sd-dialog-icon">🗓️</div>

      <h2 className="sd-dialog-title" id="cancel-appointment-title">
        Cancel appointment?
      </h2>

      <p className="sd-dialog-subtitle">
        This action cannot be undone. Please confirm you want to cancel this appointment.
      </p>

      <section className="sd-slot-empty" style={{ textAlign: 'left' }}>
        <p>
          <strong>Patient:</strong> {getAppointmentPatientName(appointmentToCancel)}
        </p>
        <p>
          <strong>Date:</strong> {getLocalDateTimeParts(appointmentToCancel.slot_datetime).date}
        </p>
        <p>
          <strong>Time:</strong> {formatAppointmentTime(appointmentToCancel)}
        </p>
      </section>

      {cancelAppointmentError && (
        <div className="sd-dialog-submit-error" role="alert">
          ⚠ {cancelAppointmentError}
        </div>
      )}

      <div className="sd-dialog-actions">
        <button
          type="button"
          className="sd-act-btn"
          onClick={closeCancelAppointmentPopup}
          disabled={cancelAppointmentLoading}
        >
          Keep appointment
        </button>

        <button
          type="button"
          className="sd-act-btn sd-act-btn--danger"
          onClick={handleConfirmCancelAppointment}
          disabled={cancelAppointmentLoading}
        >
          {cancelAppointmentLoading ? 'Cancelling…' : 'Yes, cancel'}
        </button>
      </div>
    </div>
  </div>
)}
  </>
)

}
