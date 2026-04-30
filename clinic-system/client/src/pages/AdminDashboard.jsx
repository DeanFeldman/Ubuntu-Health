import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import getApiBase from '../lib/getApiBase'

const WEEK_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const FACILITY_TYPE_OPTIONS = [
  'Clinic',
  'Community Health Centre',
  'Hospital',
  'Mobile Clinic',
  'Day Hospital',
  'Primary Health Care Clinic',
]

const EMPTY_CLINIC_FORM = {
  name: '',
  facility_type: '',
  province: '',
  district: '',
  municipality: '',
  services: '',
  appointment_duration_minutes: '',
}

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

async function readApiResponse(response) {
  const text = await response.text()

  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(text.includes('<html') ? 'API route not found' : 'Server did not return valid JSON')
  }
}

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

export default function AdminDashboard() {
  const { user } = useAuth()
  const API_BASE_URL = getApiBase()

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

  const selectedClinicStaff = staffUsers.filter((staffUser) => staffUser.clinic_id === selectedClinicId)
  const unassignedStaffUsers = staffUsers.filter((staffUser) => !staffUser.clinic_id)

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

  function handleClinicFormChange(event) {
    const { name, value } = event.target

    setClinicForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

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

  function handleOperatingHoursChange(day, field, value) {
    setOperatingHoursForm((currentForm) => ({
      ...currentForm,
      [day]: {
        ...currentForm[day],
        [field]: value,
      },
    }))
  }

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
    } catch (err) {
      setRoleFeedback(err.message || 'Failed to approve role request')
    } finally {
      setProcessingRoleRequestId('')
    }
  }

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
    } catch (err) {
      setRoleFeedback(err.message || 'Failed to reject role request')
    } finally {
      setProcessingRoleRequestId('')
    }
  }

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
    } catch (err) {
      setClinicEditError(err.message || 'Failed to update clinic')
    } finally {
      setSavingClinic(false)
    }
  }

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

  return (
  <section>
    <style>{styles}</style>

    <header className="admin-header">
      <h1>Admin Dashboard</h1>
      <p>Manage role approvals, staff placement, and clinic details from one place.</p>
    </header>

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
      </aside>

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
