import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import getApiBase from '../lib/getApiBase'

// Define constants for days of the week and facility types`
const WEEK_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

// These are example facility types in our database
const FACILITY_TYPE_OPTIONS = [
  'Clinic',
  'Community Health Centre',
  'Hospital',
  'Mobile Clinic',
  'Day Hospital',
  'Primary Health Care Clinic',
]

// This is the initial shape of the clinic form when no clinic is selected
const EMPTY_CLINIC_FORM = {
  name: '',
  facility_type: '',
  province: '',
  district: '',
  municipality: '',
  services: '',
  appointment_duration_minutes: '',
}

// This function creates an operating hours object with all days set to closed and no times
function createEmptyOperatingHours() {
  return WEEK_DAYS.reduce((hours, day) => {
    hours[day] = {
      open: '',
      close: '',
      closed: true,
    }
    return hours
  }, {})
}


// This function creates a default operating hours object with weekdays open from 07:30 to 16:30 and weekends closed 
// This is mirrored in the DB
function createDefaultOperatingHours() {
  return WEEK_DAYS.reduce((hours, day) => {
    const isWeekday = !['saturday', 'sunday'].includes(day)

    hours[day] = {
      open: isWeekday ? '07:30' : '',
      close: isWeekday ? '16:30' : '',
      closed: !isWeekday,
    }

    return hours
  }, {})
}

// This is the CSS for the admin dashboard, included here as a template literal for simplicity.
const styles = `
  .admin-header {
    margin-bottom: 24px;
  }

  .admin-header h1 {
    margin-bottom: 8px;
  }

  .admin-header p {
    color: var(--uh-muted);
    font-size: 13px;
  }

  .admin-overview {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .admin-overview-card {
    background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92));
    border: 1px solid var(--uh-border);
    border-radius: 14px;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
    padding: 18px;
  }

  .admin-overview-card span {
    color: var(--uh-muted);
    display: block;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  .admin-overview-card strong {
    color: var(--uh-text);
    display: block;
    font-size: 1.9rem;
    line-height: 1.1;
    margin-bottom: 6px;
  }

  .admin-overview-card p {
    color: var(--uh-muted);
    font-size: 13px;
    margin: 0;
  }

  .admin-stack {
    display: grid;
    gap: 24px;
  }

  .admin-panel {
    background: var(--uh-surface);
    border: 1px solid var(--uh-border);
    border-radius: 16px;
    box-shadow: 0 16px 32px rgba(15, 23, 42, 0.05);
    overflow: hidden;
  }

  .admin-panel-header {
    align-items: center;
    border-bottom: 1px solid var(--uh-border);
    display: flex;
    gap: 16px;
    justify-content: space-between;
    padding: 18px 20px;
  }

  .admin-panel-header h2 {
    font-size: 1.1rem;
    margin: 0;
  }

  .admin-panel-header span {
    color: var(--uh-muted);
    font-size: 13px;
  }

  .admin-section-intro {
    color: var(--uh-muted);
    font-size: 13px;
    margin: 4px 0 0;
  }

  .admin-message {
    padding: 16px 20px;
    font-size: 14px;
  }

  .admin-message label {
    display: inline-block;
    font-weight: 400;
    margin-top: 4px;
  }

  .admin-message input,
  .admin-message select,
  .admin-message textarea {
    border: 1px solid var(--uh-border);
    border-radius: 8px;
    font: inherit;
    margin-top: 6px;
    max-width: none;
    padding: 10px 12px;
    width: 100%;
  }

  .admin-message textarea {
    min-height: 88px;
    resize: vertical;
  }

  .admin-hint {
    color: var(--uh-muted);
    font-size: 12px;
    margin: 6px 0 0;
  }

  .admin-error {
    color: #DC2626;
  }

  .admin-feedback {
    color: var(--uh-muted);
  }

  .admin-empty {
    color: var(--uh-muted);
    padding: 28px 20px;
    text-align: center;
  }

  .admin-empty strong {
    color: var(--uh-text);
    display: block;
    font-size: 1rem;
    margin-bottom: 6px;
  }
  .operating-hours-header {
  display: grid;
  grid-template-columns: 140px 110px 1fr 1fr;
  gap: 12px;
  align-items: center;
  padding: 0 12px;
  color: var(--uh-muted);
  font-size: 12px;
  font-weight: 700;
}

.operating-hours-header span {
  display: block;
  white-space: nowrap;
}

  .admin-selected-banner {
    align-items: center;
    background: linear-gradient(135deg, #F8FAFC, #EFF6FF);
    border: 1px solid var(--uh-border);
    border-radius: 12px;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    margin-top: 18px;
    padding: 14px 16px;
  }

  .admin-selected-banner strong {
    display: block;
    margin-bottom: 4px;
  }

  .admin-selected-banner p {
    color: var(--uh-muted);
    font-size: 13px;
    margin: 0;
  }

  .admin-table-wrap {
    overflow-x: auto;
  }

  .admin-table {
    border-collapse: collapse;
    min-width: 720px;
    width: 100%;
  }

  .admin-table th,
  .admin-table td {
    border-bottom: 1px solid var(--uh-border);
    font-size: 14px;
    padding: 14px 16px;
    text-align: left;
    vertical-align: middle;
  }

  .admin-table th {
    color: var(--uh-muted);
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .admin-table tbody tr:last-child td {
    border-bottom: none;
  }

  .admin-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .admin-btn {
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    padding: 8px 12px;
  }

  .admin-btn:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .admin-btn-approve {
    background: #16A34A;
    color: white;
  }

  .admin-btn-reject {
    background: #DC2626;
    color: white;
  }

  .admin-btn-secondary {
    background: #F8FAFC;
    border: 1px solid var(--uh-border);
    color: var(--uh-text);
  }

  .admin-subsection {
    border-top: 1px solid var(--uh-border);
    margin-top: 32px;
    padding-top: 24px;
  }

  .admin-subsection-header {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .admin-subsection-header h3 {
    margin: 0;
  }

  .admin-subsection-copy {
    color: var(--uh-muted);
    font-size: 13px;
    margin: 0 0 16px;
  }

  .clinic-details-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    margin-top: 16px;
  }

  .clinic-detail-card {
    background: var(--uh-surface);
    border: 1px solid var(--uh-border);
    border-radius: 8px;
    padding: 14px 16px;
  }

  .clinic-detail-card h4 {
    color: var(--uh-muted);
    font-size: 0.85rem;
    margin: 0 0 8px 0;
    text-transform: uppercase;
  }

  .clinic-detail-card p {
    font-size: 14px;
    margin: 0;
    word-break: break-word;
  }

  .edit-clinic-container {
    width: 100%;
    max-width: none;
  }

  .edit-clinic-name {
    width: 100%;
    margin-bottom: 24px;
  }

  .edit-clinic-name input {
    font-size: 16px;
    font-weight: 700;
    text-align: center;
  }
  
  .edit-clinic-grid {
    display: grid;
    gap: 20px;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    width: 100%;
  }

  .edit-field {
    display: flex;
    flex-direction: column;
  }

  .admin-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 20px;
  align-items: start;
}

.admin-sidebar {
  background: var(--uh-surface);
  border: 1px solid var(--uh-border);
  border-radius: 14px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
  padding: 12px;
  position: sticky;
  top: 20px;
}

.admin-sidebar-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--uh-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 8px 10px 12px;
  margin: 0;
}

.admin-nav-btn {
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

.admin-nav-btn:hover {
  background: var(--uh-bg);
}

.admin-nav-btn--active {
  background: #EFF6FF;
  color: #1D4ED8;
}

.admin-nav-count {
  font-size: 11px;
  background: var(--uh-bg);
  color: var(--uh-muted);
  padding: 2px 8px;
  border-radius: 999px;
}

.admin-nav-btn--active .admin-nav-count {
  background: #DBEAFE;
  color: #1D4ED8;
}

.admin-content {
  min-width: 0;
}

@media (max-width: 820px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }

  .admin-sidebar {
    position: static;
  }
}

  .operating-hours-grid {
    display: grid;
    gap: 12px;
    margin-top: 12px;
  }

  .operating-hours-row {
    align-items: center;
    background: #F8FAFC;
    border: 1px solid var(--uh-border);
    border-radius: 10px;
    display: grid;
    gap: 12px;
    grid-template-columns: 140px 110px 1fr 1fr;
    padding: 12px;
  }

  .operating-hours-day {
    font-weight: 700;
  }

  .operating-hours-row label {
    align-items: center;
    display: flex;
    gap: 8px;
    margin: 0;
  }

  .operating-hours-row input[type='checkbox'] {
    margin: 0;
    max-width: none;
    width: auto;
  }

  .operating-hours-row input[type='time'] {
    max-width: none;
    width: 100%;
  }

  @media (max-width: 900px) {
    .operating-hours-row {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 700px) {
    .edit-clinic-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .admin-panel-header,
    .admin-selected-banner,
    .admin-subsection-header {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`
/*
This function reads the text from an API response and tries to parse it as JSON. 
If the response is empty, it returns an empty object. 
If parsing fails, it checks if the text looks like HTML (which might indicate a 404 page) and throws an appropriate error message.
*/

async function readApiResponse(response) {
  const text = await response.text()

  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(text.includes('<html') ? 'API route not found' : 'Server did not return valid JSON')
  }
}

// This function takes the operating hours data from the clinic and formats it for display in the clinic details section.
function formatClinicOperatingHours(operatingHours) {
  if (!operatingHours) {
    return <p>Not available</p>
  }

  if (typeof operatingHours !== 'object') {
    return <p>{operatingHours}</p>
  }

  return Object.entries(operatingHours).map(([day, hours]) => (
    <p key={day}>
      <strong>{day.charAt(0).toUpperCase() + day.slice(1)}:</strong>{' '}
      {typeof hours === 'string'
        ? hours
        : hours?.open && hours?.close
        ? `${hours.open} - ${hours.close}`
        : 'Closed'}
    </p>
  ))
}

// This function takes the operating hours data from the clinic and formats it for display in the clinic details section.
function normaliseOperatingHours(operatingHours) {
  const editableHours = createDefaultOperatingHours()

  if (!operatingHours || typeof operatingHours !== 'object') {
    return editableHours
  }

  WEEK_DAYS.forEach((day) => {
    const dayHours = operatingHours[day]

    if (!dayHours) {
      return
    }

    if (typeof dayHours === 'string') {
      const value = dayHours.trim().toLowerCase()
      if (value === 'closed') {
        editableHours[day] = { open: '', close: '', closed: true }
        return
      }

      const [open = '', close = ''] = dayHours.split('-').map((item) => item.trim())
      editableHours[day] = {
        open,
        close,
        closed: !open || !close,
      }
      return
    }

    editableHours[day] = {
      open: dayHours.open || '',
      close: dayHours.close || '',
      closed: !(dayHours.open && dayHours.close),
    }
  })

  return editableHours
}

// This function takes the operating hours data from the clinic form and formats it for sending to the API.
function buildOperatingHoursPayload(operatingHoursForm) {
  return WEEK_DAYS.reduce((hours, day) => {
    const currentDay = operatingHoursForm[day]

    if (!currentDay || currentDay.closed || !currentDay.open || !currentDay.close) {
      hours[day] = {
        open: '',
        close: '',
      }
      return hours
    }

    hours[day] = {
      open: currentDay.open,
      close: currentDay.close,
    }

    return hours
  }, {})
}

// This function builds the query string for the no-show report API call based on the selected filters.
function buildNoShowReportUrl(apiBase, clinicId, startDate, endDate) {
  const params = new URLSearchParams()
  if (clinicId) params.set('clinic_id', clinicId)
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  const qs = params.toString()
  return `${apiBase}/api/reports/no-shows${qs ? `?${qs}` : ''}`
}

// This function generates and triggers a CSV download from the no-show report data.
function exportNoShowCsv(report) {
  const { filters, summary } = report
  const rows = [
    ['No-Show Report'],
    ['Clinic', filters.clinic_name || 'All clinics'],
    ['Date range', filters.date_range_label || 'All time'],
    [],
    ['Metric', 'Value'],
    ['Total scheduled appointments', summary.scheduled_appointments ?? ''],
    ['Total completed appointments', summary.completed_appointments ?? ''],
    ['Total cancelled appointments', summary.cancelled_appointments ?? ''],
    ['Total no-show appointments', summary.no_show_appointments ?? ''],
    ['No-show rate', `${summary.no_show_rate_percent ?? 0}%`],
  ]
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'no-show-report.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// This function generates and triggers a plain-text PDF-style download from the no-show report data using the browser print dialog.
function exportNoShowPdf(report) {
  const { filters, summary } = report
  const clinicLabel = filters.clinic_name || 'All clinics'
  const dateLabel = filters.date_range_label || 'All time'
  const html = `
    <html>
      <head>
        <title>No-Show Report</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #111; }
          h1 { font-size: 1.4rem; margin-bottom: 4px; }
          .meta { color: #666; font-size: 0.9rem; margin-bottom: 24px; }
          table { border-collapse: collapse; width: 100%; max-width: 480px; }
          th, td { border: 1px solid #ddd; padding: 10px 14px; text-align: left; font-size: 0.9rem; }
          th { background: #f5f5f5; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>No-Show Report</h1>
        <p class="meta">Clinic: ${clinicLabel} &nbsp;|&nbsp; Date range: ${dateLabel}</p>
        <table>
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Total scheduled appointments</td><td>${summary.scheduled_appointments ?? ''}</td></tr>
            <tr><td>Total completed appointments</td><td>${summary.completed_appointments ?? ''}</td></tr>
            <tr><td>Total cancelled appointments</td><td>${summary.cancelled_appointments ?? ''}</td></tr>
            <tr><td>Total no-show appointments</td><td>${summary.no_show_appointments ?? ''}</td></tr>
            <tr><td>No-show rate</td><td>${summary.no_show_rate_percent ?? 0}%</td></tr>
          </tbody>
        </table>
      </body>
    </html>`
  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.print()
}

// This function formats a raw minutes value into a human-readable string (e.g. "1h 23m" or "45m").
function formatWaitMinutes(minutes) {
  if (minutes === null || minutes === undefined) return 'N/A'
  const mins = Math.round(minutes)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// This function builds the query string for the average wait time API call based on the selected filters.
function buildWaitTimeReportUrl(apiBase, clinicId, startDate, endDate) {
  const params = new URLSearchParams()
  if (clinicId) params.set('clinic_id', clinicId)
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  const qs = params.toString()
  return `${apiBase}/api/reports/average-wait-time${qs ? `?${qs}` : ''}`
}

// This function generates and triggers a CSV download from the average wait time report data.
function exportWaitTimeCsv(report) {
  const { filters, summary, by_clinic, by_time_of_day } = report
  const rows = [
    ['Average Wait Time Report'],
    ['Clinic', filters.clinic_name || 'All clinics'],
    ['Date range', filters.date_range_label || 'All time'],
    [],
    ['Summary'],
    ['Overall average wait time', formatWaitMinutes(summary.overall_average_wait_time_minutes)],
    ['Queue records used', summary.queue_records_used ?? ''],
    [],
    ['By clinic'],
    ['Clinic', 'Average wait time', 'Queue records used'],
    ...(by_clinic || []).map((c) => [c.clinic_name, formatWaitMinutes(c.average_wait_time_minutes), c.queue_records_used]),
    [],
    ['By time of day'],
    ['Time of day', 'Average wait time', 'Queue records used'],
    ...(by_time_of_day || []).map((t) => [t.time_of_day, formatWaitMinutes(t.average_wait_time_minutes), t.queue_records_used]),
  ]
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'average-wait-time-report.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// This function generates and triggers a PDF-style download from the average wait time report data using the browser print dialog.
function exportWaitTimePdf(report) {
  const { filters, summary, by_clinic, by_time_of_day } = report
  const clinicLabel = filters.clinic_name || 'All clinics'
  const dateLabel = filters.date_range_label || 'All time'

  const clinicRows = (by_clinic || [])
    .map((c) => `<tr><td>${c.clinic_name}</td><td>${formatWaitMinutes(c.average_wait_time_minutes)}</td><td>${c.queue_records_used}</td></tr>`)
    .join('')

  const timeRows = (by_time_of_day || [])
    .map((t) => `<tr><td>${t.time_of_day}</td><td>${formatWaitMinutes(t.average_wait_time_minutes)}</td><td>${t.queue_records_used}</td></tr>`)
    .join('')

  const html = `
    <html>
      <head>
        <title>Average Wait Time Report</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #111; }
          h1 { font-size: 1.4rem; margin-bottom: 4px; }
          h2 { font-size: 1rem; margin: 24px 0 8px; }
          .meta { color: #666; font-size: 0.9rem; margin-bottom: 24px; }
          table { border-collapse: collapse; width: 100%; max-width: 560px; margin-bottom: 24px; }
          th, td { border: 1px solid #ddd; padding: 10px 14px; text-align: left; font-size: 0.9rem; }
          th { background: #f5f5f5; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>Average Wait Time Report</h1>
        <p class="meta">Clinic: ${clinicLabel} &nbsp;|&nbsp; Date range: ${dateLabel}</p>
        <h2>Summary</h2>
        <table>
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Overall average wait time</td><td>${formatWaitMinutes(summary.overall_average_wait_time_minutes)}</td></tr>
            <tr><td>Queue records used</td><td>${summary.queue_records_used ?? ''}</td></tr>
          </tbody>
        </table>
        <h2>By clinic</h2>
        <table>
          <thead><tr><th>Clinic</th><th>Average wait time</th><th>Records used</th></tr></thead>
          <tbody>${clinicRows}</tbody>
        </table>
        <h2>By time of day</h2>
        <table>
          <thead><tr><th>Time of day</th><th>Average wait time</th><th>Records used</th></tr></thead>
          <tbody>${timeRows}</tbody>
        </table>
      </body>
    </html>`
  const win2 = window.open('', '_blank')
  win2.document.write(html)
  win2.document.close()
  win2.print()
}


export default function AdminDashboard() {
  // Get the current user from the authentication context and the API base URL from our config helper
  const { user } = useAuth()
  const API_BASE_URL = getApiBase()

  // Define all the state variables we need to manage the data and UI state of the dashboard
  const [roleRequests, setRoleRequests] = useState([])
  const [loadingRoleRequests, setLoadingRoleRequests] = useState(true)
  const [processingRoleRequestId, setProcessingRoleRequestId] = useState('')
  const [roleFeedback, setRoleFeedback] = useState('')
  const [roleError, setRoleError] = useState('')
  const [clinics, setClinics] = useState([])
  const [selectedClinic, setSelectedClinic] = useState(null)
  const [staffUsers, setStaffUsers] = useState([])
  const [loadingAssignmentData, setLoadingAssignmentData] = useState(true)
  const [selectedClinicId, setSelectedClinicId] = useState('')
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [assignmentFeedback, setAssignmentFeedback] = useState('')
  const [assignmentError, setAssignmentError] = useState('')
  const [assigningStaff, setAssigningStaff] = useState(false)
  const [clinicForm, setClinicForm] = useState(EMPTY_CLINIC_FORM)
  const [operatingHoursForm, setOperatingHoursForm] = useState(createEmptyOperatingHours())
  const [savingClinic, setSavingClinic] = useState(false)
  const [clinicEditFeedback, setClinicEditFeedback] = useState('')
  const [clinicEditError, setClinicEditError] = useState('')

  const [activeSection, setActiveSection] = useState('overview')

  // No-show report state
  const [noShowClinicId, setNoShowClinicId] = useState('')
  const [noShowStartDate, setNoShowStartDate] = useState('')
  const [noShowEndDate, setNoShowEndDate] = useState('')
  const [noShowReport, setNoShowReport] = useState(null)
  const [loadingNoShow, setLoadingNoShow] = useState(false)
  const [noShowError, setNoShowError] = useState('')

  // Average wait time report state
  const [waitTimeClinicId, setWaitTimeClinicId] = useState('')
  const [waitTimeStartDate, setWaitTimeStartDate] = useState('')
  const [waitTimeEndDate, setWaitTimeEndDate] = useState('')
  const [waitTimeReport, setWaitTimeReport] = useState(null)
  const [loadingWaitTime, setLoadingWaitTime] = useState(false)
  const [waitTimeError, setWaitTimeError] = useState('')

  const selectedClinicStaff = staffUsers.filter((staffUser) => staffUser.clinic_id === selectedClinicId)
  const unassignedStaffUsers = staffUsers.filter((staffUser) => !staffUser.clinic_id)

  // This effect fetches the no-show report whenever the analytics section is active and filters change.
  useEffect(() => {
    if (activeSection !== 'analytics') return

    async function fetchNoShowReport() {
      try {
        setLoadingNoShow(true)
        setNoShowError('')

        const url = buildNoShowReportUrl(API_BASE_URL, noShowClinicId, noShowStartDate, noShowEndDate)
        const response = await fetch(url, { headers: { Accept: 'application/json' } })
        const body = await readApiResponse(response)

        if (!response.ok) {
          throw new Error(body.error || 'Failed to load no-show report')
        }

        setNoShowReport(body)
      } catch (err) {
        setNoShowError(err.message || 'Failed to load no-show report')
        setNoShowReport(null)
      } finally {
        setLoadingNoShow(false)
      }
    }

    fetchNoShowReport()
  }, [activeSection, API_BASE_URL, noShowClinicId, noShowStartDate, noShowEndDate])

  // This effect fetches the average wait time report whenever the analytics section is active and filters change.
  useEffect(() => {
    if (activeSection !== 'analytics') return

    async function fetchWaitTimeReport() {
      try {
        setLoadingWaitTime(true)
        setWaitTimeError('')

        const url = buildWaitTimeReportUrl(API_BASE_URL, waitTimeClinicId, waitTimeStartDate, waitTimeEndDate)
        const response = await fetch(url, { headers: { Accept: 'application/json' } })
        const body = await readApiResponse(response)

        if (!response.ok) {
          throw new Error(body.error || 'Failed to load average wait time report')
        }

        setWaitTimeReport(body)
      } catch (err) {
        setWaitTimeError(err.message || 'Failed to load average wait time report')
        setWaitTimeReport(null)
      } finally {
        setLoadingWaitTime(false)
      }
    }

    fetchWaitTimeReport()
  }, [activeSection, API_BASE_URL, waitTimeClinicId, waitTimeStartDate, waitTimeEndDate])

  // This effect runs when the component mounts and whenever the user's ID changes.
  useEffect(() => {
    async function loadRoleRequests() {
      if (!user?.id) return

      try {
        setLoadingRoleRequests(true)
        setRoleError('')

        const response = await fetch(
          `${API_BASE_URL}/api/role-requests?admin_id=${encodeURIComponent(user.id)}&status=pending`,
          {
            headers: {
              Accept: 'application/json',
            },
          }
        )

        const body = await readApiResponse(response)

        if (!response.ok) {
          throw new Error(body.error || 'Failed to load role requests')
        }

        setRoleRequests(body.requests || [])
      } catch (err) {
        setRoleError(err.message || 'Failed to load role requests')
      } finally {
        setLoadingRoleRequests(false)
      }
    }

    // This function loads the clinics and staff users from the API so we can manage staff assignments and clinic details.
    async function loadAssignmentData() {
      if (!user?.id) return

      try {
        setLoadingAssignmentData(true)
        setAssignmentError('')

        const [clinicsResponse, usersResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/clinics`, {
            headers: { Accept: 'application/json' },
          }),
          fetch(`${API_BASE_URL}/api/users`, {
            headers: { Accept: 'application/json' },
          }),
        ])

        const clinicsBody = await readApiResponse(clinicsResponse)
        const usersBody = await readApiResponse(usersResponse)

        if (!clinicsResponse.ok) {
          throw new Error(clinicsBody.error || 'Failed to load clinics')
        }

        if (!usersResponse.ok) {
          throw new Error(usersBody.error || 'Failed to load users')
        }

        setClinics(clinicsBody.clinics || [])
        setStaffUsers(
          (usersBody.users || []).filter((currentUser) => {
            const role = currentUser.role?.trim().toLowerCase()
            return role === 'staff'
          })
        )
      } catch (err) {
        setAssignmentError(err.message || 'Failed to load assignment data')
      } finally {
        setLoadingAssignmentData(false)
      }
    }

    loadRoleRequests()
    loadAssignmentData()
  }, [API_BASE_URL, user?.id])

  // This effect runs whenever the selected clinic changes. 
  // It updates the clinic form and operating hours form with the data from the selected clinic, or resets them if no clinic is selected.  
  useEffect(() => {
    if (!selectedClinic) {
      setClinicForm(EMPTY_CLINIC_FORM)
      setOperatingHoursForm(createEmptyOperatingHours())
      return
    }

    setClinicForm({
      name: selectedClinic.name || '',
      facility_type: selectedClinic.facility_type || '',
      province: selectedClinic.province || '',
      district: selectedClinic.district || '',
      municipality: selectedClinic.municipality || '',
      appointment_duration_minutes:
        selectedClinic.appointment_duration_minutes == null
          ? ''
          : String(selectedClinic.appointment_duration_minutes),
      services: Array.isArray(selectedClinic.services)
        ? selectedClinic.services.join(', ')
        : selectedClinic.services || '',
    })

    setOperatingHoursForm(normaliseOperatingHours(selectedClinic.operating_hours))
  }, [selectedClinic])

  // This function handles changes to the clinic form inputs and updates the clinicForm state accordingly.
  function handleClinicFormChange(event) {
    const { name, value } = event.target

    setClinicForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  // This function is called when a clinic is selected from the list. 
  // It updates the selected clinic ID and resets any related state for staff selection and feedback messages. 
  // It also finds the selected clinic's data and sets it in the state for display and editing.
  function handleClinicSelect(clinicId) {
    setSelectedClinicId(clinicId)
    setSelectedStaffId('')
    setAssignmentError('')
    setAssignmentFeedback('')
    setClinicEditError('')
    setClinicEditFeedback('')

    const clinic = clinics.find((currentClinic) => currentClinic.id === clinicId) || null
    setSelectedClinic(clinic)
  }

  // This function handles changes to the operating hours form inputs and updates the operatingHoursForm state accordingly.
  function handleOperatingHoursChange(day, field, value) {
    setOperatingHoursForm((currentForm) => ({
      ...currentForm,
      [day]: {
        ...currentForm[day],
        [field]: value,
      },
    }))
  }

  // This function handles toggling the closed status for a specific day in the operating hours form.
  function handleClosedToggle(day, checked) {
    setOperatingHoursForm((currentForm) => ({
      ...currentForm,
      [day]: {
        open: checked ? '' : currentForm[day].open,
        close: checked ? '' : currentForm[day].close,
        closed: checked,
      },
    }))
  }

  // This function is called when the admin clicks the "Approve" button for a role request.
  async function approveRoleRequest(request) {
    setProcessingRoleRequestId(request.id)
    setRoleFeedback('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/role-requests/${request.id}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          admin_id: user.id,
        }),
      })

      const body = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(body.error || 'Failed to approve role request')
      }

      setRoleRequests((currentRequests) =>
        currentRequests.filter((currentRequest) => currentRequest.id !== request.id)
      )
      setRoleFeedback('Role request approved.')
      window.dispatchEvent(new Event('clinics-updated'))
    } catch (err) {
      setRoleFeedback(err.message || 'Failed to approve role request')
    } finally {
      setProcessingRoleRequestId('')
    }
  }

  // This function is called when the admin clicks the "Reject" button for a role request.
  async function rejectRoleRequest(request) {
    setProcessingRoleRequestId(request.id)
    setRoleFeedback('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/role-requests/${request.id}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          admin_id: user.id,
        }),
      })

      const body = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(body.error || 'Failed to reject role request')
      }

      setRoleRequests((currentRequests) =>
        currentRequests.filter((currentRequest) => currentRequest.id !== request.id)
      )
      setRoleFeedback('Role request rejected.')
      window.dispatchEvent(new Event('clinics-updated'))
    } catch (err) {
      setRoleFeedback(err.message || 'Failed to reject role request')
    } finally {
      setProcessingRoleRequestId('')
    }
  }

  // This function is called when the admin clicks the "Save changes" button after editing clinic details.
  async function saveClinicChanges() {
    if (!selectedClinicId) {
      setClinicEditError('Please select a clinic first.')
      return
    }

    setSavingClinic(true)
    setClinicEditError('')
    setClinicEditFeedback('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/clinics/${selectedClinicId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          admin_id: user.id,
          ...clinicForm,
          appointment_duration_minutes:
            clinicForm.appointment_duration_minutes === ''
              ? null
              : Number(clinicForm.appointment_duration_minutes),
          operating_hours: buildOperatingHoursPayload(operatingHoursForm),
          services: clinicForm.services
            .split(/[\n,]+/)
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      })

      const body = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(body.error || 'Failed to update clinic')
      }

      setClinics((currentClinics) =>
        currentClinics.map((clinic) =>
          clinic.id === selectedClinicId
            ? { ...clinic, ...body.clinic }
            : clinic
        )
      )
      setSelectedClinic(body.clinic)
      setClinicEditFeedback('Clinic updated successfully.')
      window.dispatchEvent(new Event('clinics-updated'))
    } catch (err) {
      setClinicEditError(err.message || 'Failed to update clinic')
    } finally {
      setSavingClinic(false)
    }
  }

  // This function is called when the admin clicks the "Assign" button to link a staff member to a clinic.
  async function assignStaffToClinic() {
    if (!selectedClinicId || !selectedStaffId) {
      setAssignmentError('Please select both a clinic and a staff member.')
      return
    }

    setAssigningStaff(true)
    setAssignmentError('')
    setAssignmentFeedback('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/${selectedStaffId}/assign-clinic`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            admin_id: user.id,
            clinic_id: selectedClinicId,
          }),
        }
      )

      const body = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(body.error || 'Failed to assign staff to clinic')
      }

      setAssignmentFeedback(body.message || 'Staff assigned successfully.')

      setStaffUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === selectedStaffId
            ? { ...currentUser, clinic_id: selectedClinicId }
            : currentUser
        )
      )

      setSelectedStaffId('')
    } catch (err) {
      setAssignmentError(err.message || 'Failed to assign staff to clinic')
    } finally {
      setAssigningStaff(false)
    }
  }

  // This function is called when the admin clicks the "Unassign" button to unlink a staff member from their clinic.
  async function unassignStaffFromClinic(staffUserId) {
    setAssignmentError('')
    setAssignmentFeedback('')
    setAssigningStaff(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/${staffUserId}/unassign-clinic`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            admin_id: user.id,
          }),
        }
      )

      const body = await readApiResponse(response)

      if (!response.ok) {
        throw new Error(body.error || 'Failed to unassign staff from clinic')
      }

      setAssignmentFeedback(body.message || 'Staff unassigned successfully.')

      setStaffUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === staffUserId
            ? { ...currentUser, clinic_id: null }
            : currentUser
        )
      )
    } catch (err) {
      setAssignmentError(err.message || 'Failed to unassign staff from clinic')
    } finally {
      setAssigningStaff(false)
    }
  }

  // The return statement contains the JSX for rendering the admin dashboard UI, including the header, sidebar navigation, and main content area with conditional rendering based on the active section.
  return (
  <section>
    <style>{styles}</style>

    {/* The header section of the admin dashboard, with a title and description. */}
    <header className="admin-header">
      <h1>Admin Dashboard</h1>
      <p>Manage role approvals, staff placement, and clinic details from one place.</p>
    </header>

    {/* The main layout of the admin dashboard, with a sidebar for navigation and a content area that changes based on the selected section. */}
    <section className="admin-layout">
      <aside className="admin-sidebar">
        <p className="admin-sidebar-title">Sections</p>

        <button
          type="button"
          className={`admin-nav-btn ${
            activeSection === 'overview' ? 'admin-nav-btn--active' : ''
          }`}
          onClick={() => setActiveSection('overview')}
        >
          Overview
        </button>

        <button
          type="button"
          className={`admin-nav-btn ${
            activeSection === 'roles' ? 'admin-nav-btn--active' : ''
          }`}
          onClick={() => setActiveSection('roles')}
        >
          Role requests
          <span className="admin-nav-count">{roleRequests.length}</span>
        </button>

        <button
          type="button"
          className={`admin-nav-btn ${
            activeSection === 'clinics' ? 'admin-nav-btn--active' : ''
          }`}
          onClick={() => setActiveSection('clinics')}
        >
          Clinic details
          <span className="admin-nav-count">{clinics.length}</span>
        </button>

        <button
          type="button"
          className={`admin-nav-btn ${
            activeSection === 'analytics' ? 'admin-nav-btn--active' : ''
          }`}
          onClick={() => setActiveSection('analytics')}
        >
          Analytics
        </button>
      </aside>

      {/* The content area of the admin dashboard, which conditionally renders different sections based on the activeSection state. */}
      <section className="admin-content">
        {activeSection === 'overview' && (
          <section className="admin-overview" aria-label="Admin overview">
            <article className="admin-overview-card">
              <span>Pending requests</span>
              <strong>{roleRequests.length}</strong>
              <p>Role changes waiting for a decision.</p>
            </article>

            <article className="admin-overview-card">
              <span>Unassigned staff</span>
              <strong>{unassignedStaffUsers.length}</strong>
              <p>Team members ready to be linked to a clinic.</p>
            </article>
          </section>
        )}

        {/* The section for managing role requests, which includes a table of pending requests and actions to approve or reject each one. */}
        {activeSection === 'roles' && (
          <section className="admin-stack">
            <section className="admin-panel" aria-labelledby="role-requests-heading">
              <header className="admin-panel-header">
                <section>
                  <h2 id="role-requests-heading">Pending role requests</h2>
                  <p className="admin-section-intro">
                    Review each request and approve only the roles you want active.
                  </p>
                </section>
                <span>{roleRequests.length} pending</span>
              </header>

              {roleError && (
                <p className="admin-message admin-error" role="alert">
                  {roleError}
                </p>
              )}

              {roleFeedback && (
                <p className="admin-message admin-feedback" role="status">
                  {roleFeedback}
                </p>
              )}

              {/* Conditional rendering for the role requests table, showing a loading message, an empty state, or the table of requests depending on the current state. */}
              {loadingRoleRequests ? (
                <p className="admin-message">Loading role requests...</p>
              ) : roleRequests.length === 0 ? (
                <section className="admin-empty">
                  <strong>No pending role requests.</strong>
                  <p>Everything is up to date for now.</p>
                </section>
              ) : (
                <section className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Current role</th>
                        <th>Requested role</th>
                        <th>Requested</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {roleRequests.map((request) => (
                        <tr key={request.id}>
                          <td>{request.users?.full_name || 'Unknown user'}</td>
                          <td>{request.users?.email || 'No email'}</td>
                          <td>{request.users?.role || 'Unknown'}</td>
                          <td>{request.requested_role}</td>
                          <td>
                            {new Date(request.created_at).toLocaleDateString('en-GB')}
                          </td>
                          <td>
                            <menu className="admin-actions">
                              <li>
                                <button
                                  className="admin-btn admin-btn-approve"
                                  disabled={processingRoleRequestId === request.id}
                                  onClick={() => approveRoleRequest(request)}
                                  type="button"
                                >
                                  Approve
                                </button>
                              </li>

                              <li>
                                <button
                                  className="admin-btn admin-btn-reject"
                                  disabled={processingRoleRequestId === request.id}
                                  onClick={() => rejectRoleRequest(request)}
                                  type="button"
                                >
                                  Reject
                                </button>
                              </li>
                            </menu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </section>
          </section>
        )}

        {/* The section for managing clinic details, which includes selecting a clinic, viewing and editing its details, and managing staff assignments. */}
        {activeSection === 'analytics' && (
          <section className="admin-stack" aria-labelledby="analytics-heading">
            <header className="admin-panel-header" style={{ border: 'none', paddingLeft: 0, paddingRight: 0 }}>
              <section>
                <h2 id="analytics-heading">Analytics</h2>
                <p className="admin-section-intro">
                  View reports and export data across all clinics.
                </p>
              </section>
            </header>

            {/* No-show report panel */}
            <section className="admin-panel" aria-labelledby="no-show-heading">
              <header className="admin-panel-header">
                <section>
                  <h2 id="no-show-heading">No-show report</h2>
                  <p className="admin-section-intro">
                    Review appointment attendance across clinics and date ranges.
                  </p>
                </section>

                {noShowReport && (
                  <section style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => exportNoShowCsv(noShowReport)}
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => exportNoShowPdf(noShowReport)}
                    >
                      Export PDF
                    </button>
                  </section>
                )}
              </header>

              {/* Filters */}
              <section className="admin-message" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
                  Clinic
                  <select
                    value={noShowClinicId}
                    onChange={(e) => setNoShowClinicId(e.target.value)}
                  >
                    <option value="">All clinics</option>
                    {clinics.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  Start date
                  <input
                    type="date"
                    value={noShowStartDate}
                    onChange={(e) => setNoShowStartDate(e.target.value)}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  End date
                  <input
                    type="date"
                    value={noShowEndDate}
                    onChange={(e) => setNoShowEndDate(e.target.value)}
                  />
                </label>
              </section>

              {/* Loading state */}
              {loadingNoShow && (
                <p className="admin-message">Loading no-show report...</p>
              )}

              {/* Error state */}
              {!loadingNoShow && noShowError && (
                <p className="admin-message admin-error" role="alert">{noShowError}</p>
              )}

              {/* Empty state */}
              {!loadingNoShow && !noShowError && noShowReport && noShowReport.summary?.scheduled_appointments === 0 && (
                <section className="admin-empty">
                  <strong>No data found.</strong>
                  <p>No appointments match the selected clinic and date range.</p>
                </section>
              )}

              {/* Report results */}
              {!loadingNoShow && !noShowError && noShowReport && noShowReport.summary?.scheduled_appointments > 0 && (
                <section className="admin-message">
                  {/* Selected filters summary */}
                  <section className="admin-selected-banner" style={{ marginTop: 0, marginBottom: '20px' }}>
                    <section>
                      <strong>Clinic</strong>
                      <p>{noShowReport.filters?.clinic_name || 'All clinics'}</p>
                    </section>
                    <section>
                      <strong>Date range</strong>
                      <p>{noShowReport.filters?.date_range_label || 'All time'}</p>
                    </section>
                  </section>

                  {/* Stats grid */}
                  <section className="admin-overview" style={{ marginBottom: 0 }}>
                    <article className="admin-overview-card">
                      <span>Scheduled</span>
                      <strong>{noShowReport.summary.scheduled_appointments}</strong>
                      <p>Total appointments scheduled.</p>
                    </article>
                    <article className="admin-overview-card">
                      <span>Completed</span>
                      <strong>{noShowReport.summary.completed_appointments}</strong>
                      <p>Appointments attended.</p>
                    </article>
                    {noShowReport.summary.cancelled_appointments > 0 && (
                      <article className="admin-overview-card">
                        <span>Cancelled</span>
                        <strong>{noShowReport.summary.cancelled_appointments}</strong>
                        <p>Appointments cancelled.</p>
                      </article>
                    )}
                    <article className="admin-overview-card">
                      <span>No-shows</span>
                      <strong>{noShowReport.summary.no_show_appointments}</strong>
                      <p>Patients who did not attend.</p>
                    </article>
                    <article className="admin-overview-card">
                      <span>No-show rate</span>
                      <strong>{noShowReport.summary.no_show_rate_percent}%</strong>
                      <p>Percentage of no-shows.</p>
                    </article>
                  </section>
                </section>
              )}
            </section>

            {/* Average wait time report panel */}
            <section className="admin-panel" aria-labelledby="wait-time-heading">
              <header className="admin-panel-header">
                <section>
                  <h2 id="wait-time-heading">Average wait time report</h2>
                  <p className="admin-section-intro">
                    Review patient queue wait times across clinics and date ranges.
                  </p>
                </section>

                {waitTimeReport && (
                  <section style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => exportWaitTimeCsv(waitTimeReport)}
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => exportWaitTimePdf(waitTimeReport)}
                    >
                      Export PDF
                    </button>
                  </section>
                )}
              </header>

              {/* Filters */}
              <section className="admin-message" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
                  Clinic
                  <select
                    value={waitTimeClinicId}
                    onChange={(e) => setWaitTimeClinicId(e.target.value)}
                  >
                    <option value="">All clinics</option>
                    {clinics.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  Start date
                  <input
                    type="date"
                    value={waitTimeStartDate}
                    onChange={(e) => setWaitTimeStartDate(e.target.value)}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  End date
                  <input
                    type="date"
                    value={waitTimeEndDate}
                    onChange={(e) => setWaitTimeEndDate(e.target.value)}
                  />
                </label>
              </section>

              {/* Loading state */}
              {loadingWaitTime && (
                <p className="admin-message">Loading average wait time report...</p>
              )}

              {/* Error state */}
              {!loadingWaitTime && waitTimeError && (
                <p className="admin-message admin-error" role="alert">{waitTimeError}</p>
              )}

              {/* Empty state */}
              {!loadingWaitTime && !waitTimeError && waitTimeReport && waitTimeReport.summary?.queue_records_used === 0 && (
                <section className="admin-empty">
                  <strong>No data found.</strong>
                  <p>No queue records match the selected clinic and date range.</p>
                </section>
              )}

              {/* Report results */}
              {!loadingWaitTime && !waitTimeError && waitTimeReport && waitTimeReport.summary?.queue_records_used > 0 && (
                <section className="admin-message">
                  {/* Selected filters summary */}
                  <section className="admin-selected-banner" style={{ marginTop: 0, marginBottom: '20px' }}>
                    <section>
                      <strong>Clinic</strong>
                      <p>{waitTimeReport.filters?.clinic_name || 'All clinics'}</p>
                    </section>
                    <section>
                      <strong>Date range</strong>
                      <p>{waitTimeReport.filters?.date_range_label || 'All time'}</p>
                    </section>
                  </section>

                  {/* Summary stats */}
                  <section className="admin-overview" style={{ marginBottom: '24px' }}>
                    <article className="admin-overview-card">
                      <span>Overall average wait time</span>
                      <strong>{formatWaitMinutes(waitTimeReport.summary.overall_average_wait_time_minutes)}</strong>
                      <p>Across all selected records.</p>
                    </article>
                    <article className="admin-overview-card">
                      <span>Queue records used</span>
                      <strong>{waitTimeReport.summary.queue_records_used}</strong>
                      <p>Records included in this calculation.</p>
                    </article>
                  </section>

                  {/* By clinic table */}
                  {waitTimeReport.by_clinic?.length > 0 && (
                    <section style={{ marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>By clinic</h3>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Clinic</th>
                            <th>Average wait time</th>
                            <th>Records used</th>
                          </tr>
                        </thead>
                        <tbody>
                          {waitTimeReport.by_clinic.map((c) => (
                            <tr key={c.clinic_id}>
                              <td>{c.clinic_name}</td>
                              <td>{formatWaitMinutes(c.average_wait_time_minutes)}</td>
                              <td>{c.queue_records_used}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}

                  {/* By time of day table */}
                  {waitTimeReport.by_time_of_day?.length > 0 && (
                    <section>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>By time of day</h3>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Time of day</th>
                            <th>Average wait time</th>
                            <th>Records used</th>
                          </tr>
                        </thead>
                        <tbody>
                          {waitTimeReport.by_time_of_day.map((t) => (
                            <tr key={t.time_of_day}>
                              <td>{t.time_of_day}</td>
                              <td>{formatWaitMinutes(t.average_wait_time_minutes)}</td>
                              <td>{t.queue_records_used}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}
                </section>
              )}
            </section>
          </section>
        )}

        {activeSection === 'clinics' && (
          <section className="admin-stack">
            <section className="admin-panel" aria-labelledby="staff-assignment-heading">
              <header className="admin-panel-header">
                <section>
                  <h2 id="staff-assignment-heading">Clinic details</h2>
                  <p className="admin-section-intro">
                    Search for a clinic by name, then manage staff and edit the clinic profile.
                  </p>
                </section>
                <span>{selectedClinic ? selectedClinic.name : 'No clinic selected'}</span>
              </header>

              {assignmentError && (
                <p className="admin-message admin-error" role="alert">
                  {assignmentError}
                </p>
              )}

              {assignmentFeedback && (
                <p className="admin-message admin-feedback" role="status">
                  {assignmentFeedback}
                </p>
              )}

              {/* Conditional rendering for the clinic details and staff assignment section, showing a loading message or the form to manage staff and edit clinic details depending on the current state. */}
              {loadingAssignmentData ? (
                <p className="admin-message">Loading clinics and staff...</p>
              ) : (
                <form
                  className="admin-message"
                  onSubmit={(event) => {
                    event.preventDefault()
                    assignStaffToClinic()
                  }}
                >
                  <label htmlFor="clinic-select">Choose a clinic</label>
                  <select
                    id="clinic-select"
                    value={selectedClinicId}
                    onChange={(event) => handleClinicSelect(event.target.value)}
                  >
                    <option value="">Select clinic</option>
                    {clinics.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.name}
                      </option>
                    ))}
                  </select>

                  {!selectedClinicId && (
                    <section className="admin-empty">
                      <strong>Select a clinic to get started</strong>
                      <p>
                        You will be able to view assigned staff, update facility type,
                        services, and edit each day&apos;s operating hours.
                      </p>
                    </section>
                  )}

                  {/* When a clinic is selected, show the details and staff management sections. */}
                  {selectedClinicId && (
                    <>
                      <section className="admin-selected-banner" aria-live="polite">
                        <section>
                          <strong>{selectedClinic?.name}</strong>
                          <p>
                            {selectedClinic?.municipality || 'Municipality not set'}
                            {' - '}
                            {selectedClinic?.district || 'District not set'}
                          </p>
                        </section>
                        <span>Edit the fields just below.</span>
                      </section>

                      <section className="admin-subsection">
                        <header className="admin-subsection-header">
                          <h3>Clinic staff</h3>
                        </header>

                        <p className="admin-subsection-copy">
                          Manage the team currently assigned to this clinic and add available staff below.
                        </p>

                        <section className="admin-table-wrap">
                          <table className="admin-table">
                            <tbody>
                              {selectedClinicStaff.length === 0 ? (
                                <tr>
                                  <td colSpan="4">No staff assigned yet.</td>
                                </tr>
                              ) : (
                                selectedClinicStaff.map((staffUser) => (
                                  <tr key={staffUser.id}>
                                    <td>{staffUser.full_name}</td>
                                    <td>{staffUser.role}</td>
                                    <td>{selectedClinic?.name}</td>
                                    <td>
                                      <button
                                        className="admin-btn admin-btn-reject"
                                        type="button"
                                        onClick={() => unassignStaffFromClinic(staffUser.id)}
                                      >
                                        Unassign
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </section>

                        <br />
                        {/* The form to assign a new staff member to the selected clinic, which includes a dropdown of unassigned staff and a button to confirm the assignment. */}
                        <label htmlFor="staff-select">Add staff member</label>
                        <select
                          id="staff-select"
                          value={selectedStaffId}
                          onChange={(event) => setSelectedStaffId(event.target.value)}
                        >
                          <option value="">Select staff</option>
                          {unassignedStaffUsers.map((staffUser) => (
                            <option key={staffUser.id} value={staffUser.id}>
                              {staffUser.full_name}
                            </option>
                          ))}
                        </select>

                        <br />
                        <br />

                        <button
                          className="admin-btn admin-btn-approve"
                          type="button"
                          onClick={assignStaffToClinic}
                          disabled={assigningStaff || !selectedStaffId}
                        >
                          {assigningStaff ? 'Adding...' : 'Add staff'}
                        </button>
                      </section>

                      <section className="admin-subsection">
                        <header className="admin-subsection-header">
                          <h3>Edit clinic</h3>
                        </header>

                        <p className="admin-subsection-copy">
                          Update facility type, services, and operating hours below, then save your changes.
                        </p>

                        <section className="edit-clinic-container">
                          <label className="edit-clinic-name" htmlFor="clinic-name">
                            Name
                            <input
                              id="clinic-name"
                              name="name"
                              value={clinicForm.name}
                              onChange={handleClinicFormChange}
                            />
                          </label>

                          {/* The grid section for editing clinic details, including facility type, location, services, and appointment duration. */}
                          <section className="edit-clinic-grid">
                            <label className="edit-field" htmlFor="facility-type">
                              Facility type
                              <input
                                id="facility-type"
                                list="facility-type-options"
                                name="facility_type"
                                value={clinicForm.facility_type}
                                onChange={handleClinicFormChange}
                              />
                              <datalist id="facility-type-options">
                                {FACILITY_TYPE_OPTIONS.map((facilityType) => (
                                  <option key={facilityType} value={facilityType} />
                                ))}
                              </datalist>
                            </label>

                            <label className="edit-field" htmlFor="province">
                              Province
                              <input
                                id="province"
                                name="province"
                                value={clinicForm.province}
                                onChange={handleClinicFormChange}
                              />
                            </label>

                            <label className="edit-field" htmlFor="district">
                              District
                              <input
                                id="district"
                                name="district"
                                value={clinicForm.district}
                                onChange={handleClinicFormChange}
                              />
                            </label>

                            <label className="edit-field" htmlFor="municipality">
                              Municipality
                              <input
                                id="municipality"
                                name="municipality"
                                value={clinicForm.municipality}
                                onChange={handleClinicFormChange}
                              />
                            </label>
                                
                            <label className="edit-field" htmlFor="services">
                              Services
                              <textarea
                                id="services"
                                name="services"
                                value={clinicForm.services}
                                onChange={handleClinicFormChange}
                                placeholder="Separate services with commas or new lines"
                              />
                              <p className="admin-hint">
                                Example: HIV testing, Immunisation, Family planning
                              </p>
                            </label>

                            <label className="edit-field" htmlFor="appointment-duration">
                              Appointment duration minutes
                              <input
                                id="appointment-duration"
                                min="1"
                                max="240"
                                name="appointment_duration_minutes"
                                type="number"
                                value={clinicForm.appointment_duration_minutes}
                                onChange={handleClinicFormChange}
                                placeholder="Default: 15"
                              />
                              <p className="admin-hint">
                                Leave empty to use the backend default of 15 minutes.
                              </p>
                            </label>
                          </section>

                          {/* The section for editing operating hours, which includes a grid with inputs for opening and closing times for each day of the week, as well as a checkbox to mark the day as closed. */}
                          <section className="admin-subsection">
                            <header className="admin-subsection-header">
                              <h3>Operating hours</h3>
                            </header>

                            <p className="admin-subsection-copy">
                              Set opening and closing times for each day, or mark the day as closed.
                            </p>

                            <section className="operating-hours-grid">
                              <section className="operating-hours-header">
                                <span>Day</span>
                                <span>Closed</span>
                                <span>Opening time</span>
                                <span>Closing time</span>
                              </section>

                              {WEEK_DAYS.map((day) => (
                                <section className="operating-hours-row" key={day}>
                                  <span className="operating-hours-day">
                                    {day.charAt(0).toUpperCase() + day.slice(1)}
                                  </span>

                                  <label htmlFor={`${day}-closed`}>
                                    <input
                                      id={`${day}-closed`}
                                      type="checkbox"
                                      checked={operatingHoursForm[day]?.closed ?? true}
                                      onChange={(event) =>
                                        handleClosedToggle(day, event.target.checked)
                                      }
                                    />
                                    Closed
                                  </label>

                                  <input
                                    aria-label={`${day} opening time`}
                                    type="time"
                                    value={operatingHoursForm[day]?.open ?? ''}
                                    disabled={operatingHoursForm[day]?.closed}
                                    onChange={(event) =>
                                      handleOperatingHoursChange(
                                        day,
                                        'open',
                                        event.target.value
                                      )
                                    }
                                  />

                                  <input
                                    aria-label={`${day} closing time`}
                                    type="time"
                                    value={operatingHoursForm[day]?.close ?? ''}
                                    disabled={operatingHoursForm[day]?.closed}
                                    onChange={(event) =>
                                      handleOperatingHoursChange(
                                        day,
                                        'close',
                                        event.target.value
                                      )
                                    }
                                  />
                                </section>
                              ))}
                            </section>
                          </section>
                          
                          {/* The section for the "Save changes" button and any feedback messages related to saving clinic details. */}
                          <section
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              marginTop: '12px',
                            }}
                          >
                            <button
                              className="admin-btn admin-btn-approve"
                              type="button"
                              onClick={saveClinicChanges}
                              disabled={savingClinic}
                            >
                              {savingClinic ? 'Saving...' : 'Save changes'}
                            </button>

                            {clinicEditError && (
                              <span className="admin-error" role="alert">
                                {clinicEditError}
                              </span>
                            )}

                            {clinicEditFeedback && (
                              <span className="admin-feedback" role="status">
                                {clinicEditFeedback}
                              </span>
                            )}
                          </section>
                        </section>
                      </section>
                    </>
                  )}
                </form>
              )}
            </section>
          </section>
        )}
      </section>
    </section>
  </section>
)

}