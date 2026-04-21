import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import getApiBase from '../lib/getApiBase'

/*const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  (window.location.hostname === 'localhost' ? 'http://localhost:8080' : '')*/
  /*const API_BASE_URL = getApiBase()*/
  /*const API_BASE_URL =
  getApiBase() ||
  (window.location.hostname === 'localhost' ? 'http://localhost:8080' : '')*/

const styles = `
  .admin-header {
    margin-bottom: 24px;
  }

  .clinic-details-grid.is-clickable {
  cursor: pointer;
}


.edit-clinic-container {
  max-width: 900px;
  margin: 0 auto;
}

.edit-clinic-name {
  text-align: center;
  margin-bottom: 24px;
}

.edit-clinic-name input {
  text-align: center;
  font-weight: 700;
  font-size: 16px;
}

.edit-clinic-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 700px) {
  .edit-clinic-grid {
    grid-template-columns: 1fr;
  }
}

.edit-field {
  display: flex;
  flex-direction: column;
}

.clinic-details-grid.is-clickable .clinic-detail-card:hover {
  border-color: var(--uh-text);
  transform: translateY(-2px);
  transition: 0.2s ease;
}

.clinic-main-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  margin-top: 20px;
}

@media (max-width: 900px) {
  .clinic-main-grid {
    grid-template-columns: 1fr;
  }
}
  .admin-header h1 {
    margin-bottom: 8px;
  }

  .admin-header p {
    color: var(--uh-muted);
    font-size: 13px;
  }

  .admin-stack {
    display: grid;
    gap: 24px;
  }

  .admin-panel {
    background: var(--uh-surface);
    border: 1px solid var(--uh-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .clinic-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.clinic-detail-card {
  background: var(--uh-surface);
  border: 1px solid var(--uh-border);
  border-radius: 8px;
  padding: 14px 16px;
}

.clinic-detail-card h4 {
  margin: 0 0 8px 0;
  font-size: 0.85rem;
  color: var(--uh-muted);
  text-transform: uppercase;
}

.clinic-detail-card p {
  margin: 0;
  font-size: 14px;
  word-break: break-word;
}
  
  .admin-message select {
  border: 1px solid var(--uh-border);
  border-radius: 8px;
  font: inherit;
  margin-top: 6px;
  padding: 10px 12px;
  width: 100%;
  max-width: 420px;
}

.admin-message label {
  display: inline-block;
  font-weight: 700;
  margin-top: 4px;
}

  .admin-panel-header {
    align-items: center;
    border-bottom: 1px solid var(--uh-border);
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
  }
    .admin-message input {
  border: 1px solid var(--uh-border);
  border-radius: 8px;
  font: inherit;
  margin-top: 6px;
  padding: 10px 12px;
  width: 100%;
  max-width: 420px;
}

.admin-subsection {
  border-top: 1px solid var(--uh-border);
  margin-top: 20px;
  padding-top: 20px;
}

.admin-subsection h3 {
  margin-bottom: 12px;
}

  .admin-panel-header h2 {
    font-size: 1.1rem;
  }

  .admin-panel-header span {
    font-size: 13px;
    color: var(--uh-muted);
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
    padding: 14px 16px;
    text-align: left;
    vertical-align: middle;
    font-size: 14px;
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
    gap: 8px;
    flex-wrap: wrap;
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

  .admin-message {
    padding: 16px;
    font-size: 14px;
  }

  .admin-error {
    color: #DC2626;
  }

  .admin-feedback {
    color: var(--uh-muted);
  }

  @media (max-width: 640px) {
    .admin-panel-header {
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

export default function AdminDashboard() {
  const { user } = useAuth()
  const API_BASE_URL = getApiBase()

  const [roleRequests, setRoleRequests] = useState([])
  const [clinicRequests, setClinicRequests] = useState([])

  const [loadingRoleRequests, setLoadingRoleRequests] = useState(true)
  const [loadingClinicRequests, setLoadingClinicRequests] = useState(true)

  const [processingRoleRequestId, setProcessingRoleRequestId] = useState('')
  const [processingClinicRequestId, setProcessingClinicRequestId] = useState('')

  const [roleFeedback, setRoleFeedback] = useState('')
  const [clinicFeedback, setClinicFeedback] = useState('')

  const [roleError, setRoleError] = useState('')
  const [clinicError, setClinicError] = useState('')

  const [clinics, setClinics] = useState([])
  const [staffUsers, setStaffUsers] = useState([])
  const [loadingAssignmentData, setLoadingAssignmentData] = useState(true)

  const [selectedClinicId, setSelectedClinicId] = useState('')
  const [selectedStaffId, setSelectedStaffId] = useState('')

  const [assignmentFeedback, setAssignmentFeedback] = useState('')
  const [assignmentError, setAssignmentError] = useState('')
  const [assigningStaff, setAssigningStaff] = useState(false)
  const [showClinicEditor, setShowClinicEditor] = useState(false)

  const [clinicForm, setClinicForm] = useState({
    name: '',
    facility_type: '',
    province: '',
    district: '',
    municipality: '',
    operating_hours: '',
    services: '',
  })

  const [savingClinic, setSavingClinic] = useState(false)
  const [clinicEditFeedback, setClinicEditFeedback] = useState('')
  const [clinicEditError, setClinicEditError] = useState('')


  const selectedClinicStaff = staffUsers.filter(
    (staffUser) => staffUser.clinic_id === selectedClinicId
  )

  const unassignedStaffUsers = staffUsers.filter(
    (staffUser) => !staffUser.clinic_id
  )
  const selectedClinic = clinics.find(
    (clinic) => clinic.id === selectedClinicId
  )
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
        return role && (role.includes('staff') || role === 'admin')
      })
    )
  } catch (err) {
    setAssignmentError(err.message || 'Failed to load assignment data')
  } finally {
    setLoadingAssignmentData(false)
  }
}


  async function loadClinicRequests() {
    if (!user?.id) return

    try {
      setLoadingClinicRequests(true)
      setClinicError('')

      const response = await fetch(
        `${API_BASE_URL}/api/clinic-requests?admin_id=${encodeURIComponent(user.id)}&status=pending`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      )

      const text = await response.text()

      let body = {}
      try {
        body = text ? JSON.parse(text) : {}
      } catch {
        // Azure returned HTML instead of JSON, so just treat it as no clinic requests
        setClinicRequests([])
        setClinicError('')
        return
      }

      if (!response.ok) {
        throw new Error(body.error || 'Failed to load clinic requests')
      }

      setClinicRequests(body.requests || [])
    } catch (err) {
      setClinicError(err.message || 'Failed to load clinic requests')
    } finally {
      setLoadingClinicRequests(false)
    }
  }

    loadRoleRequests()
    loadClinicRequests()
    loadAssignmentData()
    
}, [API_BASE_URL, user?.id])


useEffect(() => {
  if (!selectedClinic) {
    setClinicForm({
      name: '',
      facility_type: '',
      province: '',
      district: '',
      municipality: '',
      operating_hours: '',
      services: '',
    })
    return
  }

  setClinicForm({
    name: selectedClinic.name || '',
    facility_type: selectedClinic.facility_type || '',
    province: selectedClinic.province || '',
    district: selectedClinic.district || '',
    municipality: selectedClinic.municipality || '',
    operating_hours:
      typeof selectedClinic.operating_hours === 'object'
        ? JSON.stringify(selectedClinic.operating_hours)
        : selectedClinic.operating_hours || '',    services: Array.isArray(selectedClinic.services)
      ? selectedClinic.services.join(', ')
      : selectedClinic.services || '',
  })
}, [selectedClinic])


  function handleClinicFormChange(event) {
    const { name, value } = event.target

    setClinicForm((currentForm) => ({
      ...currentForm,
      [name]: value,
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
          operating_hours:
            typeof clinicForm.operating_hours === 'string'
              ? JSON.parse(clinicForm.operating_hours || '{}')
              : clinicForm.operating_hours,
        })
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

      setClinicEditFeedback('Clinic updated successfully.')
    } catch (err) {
      setClinicEditError(err.message || 'Failed to update clinic')
    } finally {
      setSavingClinic(false)
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

      setSelectedClinicId('')
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
        <p>Review pending role requests and clinic access requests.</p>
      </header>

      <section className="admin-stack">
        <section className="admin-panel" aria-labelledby="role-requests-heading">
          <header className="admin-panel-header">
            <h2 id="role-requests-heading">Pending role requests</h2>
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
            <p className="admin-message">No pending role requests.</p>
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
                      <td>{new Date(request.created_at).toLocaleDateString('en-GB')}</td>
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

       {/* add the clinic requests panel here, similar to the role requests panel, using the clinicRequests state and related functions */}
      <section className="admin-panel" aria-labelledby="staff-assignment-heading">
        <header className="admin-panel-header">
          <h2 id="staff-assignment-heading">Assign staff to clinic</h2>
          <span>Choose a clinic and a staff member</span>
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
            <label htmlFor="clinic-select">Clinic</label>
            <br />
            <select
              id="clinic-select"
              value={selectedClinicId}
              onChange={(event) => {
                setSelectedClinicId(event.target.value)
                setSelectedStaffId('')
                setAssignmentError('')
                setAssignmentFeedback('')
                setShowClinicEditor(false)
              }}
            >
              <option value="">Select clinic</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>

          {selectedClinicId && (
            <>
              <br />
              <br />

              <section className="admin-subsection">
                <h3>Clinic staff</h3>

                <section className="admin-table-wrap">
                  <table className="admin-table">
                    <tbody>
                      {selectedClinicStaff.length === 0 ? (
                        <tr>
                          <td colSpan="4">No staff assigned.</td>
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

                <label htmlFor="staff-select">Add staff</label>
                <br />
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
                <h3>Selected clinic details</h3>
                <p className="admin-feedback">Click any card below to edit this clinic.</p>

                <section
                  className="clinic-details-grid is-clickable"
                  onClick={() => setShowClinicEditor((current) => !current)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setShowClinicEditor((current) => !current)
                    }
                  }}
                >
                  <article className="clinic-detail-card">
                    <h4>Clinic name</h4>
                    <p>{selectedClinic?.name || 'Not available'}</p>
                  </article>

                  <article className="clinic-detail-card">
                    <h4>Facility type</h4>
                    <p>{selectedClinic?.facility_type || 'Not available'}</p>
                  </article>

                  <article className="clinic-detail-card">
                    <h4>Province</h4>
                    <p>{selectedClinic?.province || 'Not available'}</p>
                  </article>

                  <article className="clinic-detail-card">
                    <h4>District</h4>
                    <p>{selectedClinic?.district || 'Not available'}</p>
                  </article>

                  <article className="clinic-detail-card">
                    <h4>Municipality</h4>
                    <p>{selectedClinic?.municipality || 'Not available'}</p>
                  </article>

                  <article className="clinic-detail-card">
                    <h4>Operating hours</h4>
                    {selectedClinic?.operating_hours ? (
                      Object.entries(selectedClinic.operating_hours).map(([day, hours]) => (
                        <p key={day}>
                          <strong>
                            {day.charAt(0).toUpperCase() + day.slice(1)}:
                          </strong>{' '}
                          {typeof hours === 'string'
                            ? hours
                            : hours?.open && hours?.close
                            ? `${hours.open} - ${hours.close}`
                            : 'Closed'}
                        </p>
                      ))
                    ) : (
                      <p>Not available</p>
                    )}
                  </article>

                  <article className="clinic-detail-card">
                    <h4>Services</h4>
                    <p>
                      {Array.isArray(selectedClinic?.services)
                        ? selectedClinic.services.join(', ')
                        : selectedClinic?.services || 'Not available'}
                    </p>
                  </article>
                </section>
              </section>

              {showClinicEditor && (
                <section className="admin-subsection">
                  <h3>Edit clinic</h3>

                  <section className="edit-clinic-container">

                    {/* 🔹 NAME CENTERED */}
                    <section className="edit-clinic-name">
                      <label htmlFor="clinic-name">Name</label>
                      <input
                        id="clinic-name"
                        name="name"
                        value={clinicForm.name}
                        onChange={handleClinicFormChange}
                      />
                    </section>

                    {/* 🔹 GRID */}
                    <section className="edit-clinic-grid">

                      <section className="edit-field">
                        <label htmlFor="facility-type">Facility type</label>
                        <input
                          id="facility-type"
                          name="facility_type"
                          value={clinicForm.facility_type}
                          onChange={handleClinicFormChange}
                        />
                      </section>

                      <section className="edit-field">
                        <label htmlFor="province">Province</label>
                        <input
                          id="province"
                          name="province"
                          value={clinicForm.province}
                          onChange={handleClinicFormChange}
                        />
                      </section>

                      <section className="edit-field">
                        <label htmlFor="district">District</label>
                        <input
                          id="district"
                          name="district"
                          value={clinicForm.district}
                          onChange={handleClinicFormChange}
                        />
                      </section>

                      <section className="edit-field">
                        <label htmlFor="municipality">Municipality</label>
                        <input
                          id="municipality"
                          name="municipality"
                          value={clinicForm.municipality}
                          onChange={handleClinicFormChange}
                        />
                      </section>

                      <section className="edit-field">
                        <label htmlFor="operating-hours">Operating hours</label>
                        <input
                          id="operating-hours"
                          name="operating_hours"
                          value={
                            typeof clinicForm.operating_hours === 'string'
                              ? clinicForm.operating_hours
                              : JSON.stringify(clinicForm.operating_hours || {})
                          }
                          onChange={handleClinicFormChange}
                        />
                      </section>

                      <section className="edit-field">
                        <label htmlFor="services">Services</label>
                        <input
                          id="services"
                          name="services"
                          value={clinicForm.services}
                          onChange={handleClinicFormChange}
                        />
                      </section>

                    </section>

                    <br />

                    <button
                      className="admin-btn admin-btn-approve"
                      type="button"
                      onClick={saveClinicChanges}
                      disabled={savingClinic}
                    >
                      {savingClinic ? 'Saving...' : 'Save changes'}
                    </button>

                  </section>
                </section>
              )}
            </>
          )}

          </form>
        )}
      </section>
      </section>
    </section>
  )
}