import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  (window.location.hostname === 'localhost' ? 'http://localhost:8080' : '')

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

  .admin-panel-header {
    align-items: center;
    border-bottom: 1px solid var(--uh-border);
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
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
  }, [user?.id])

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

  async function approveClinicRequest(request) {
    setProcessingClinicRequestId(request.id)
    setClinicFeedback('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/clinic-requests/${request.id}/approve`, {
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
        throw new Error(body.error || 'Failed to approve clinic request')
      }

      setClinicRequests((currentRequests) =>
        currentRequests.filter((currentRequest) => currentRequest.id !== request.id)
      )
      setClinicFeedback('Clinic request approved.')
    } catch (err) {
      setClinicFeedback(err.message || 'Failed to approve clinic request')
    } finally {
      setProcessingClinicRequestId('')
    }
  }

  async function rejectClinicRequest(request) {
    setProcessingClinicRequestId(request.id)
    setClinicFeedback('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/clinic-requests/${request.id}/reject`, {
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
        throw new Error(body.error || 'Failed to reject clinic request')
      }

      setClinicRequests((currentRequests) =>
        currentRequests.filter((currentRequest) => currentRequest.id !== request.id)
      )
      setClinicFeedback('Clinic request rejected.')
    } catch (err) {
      setClinicFeedback(err.message || 'Failed to reject clinic request')
    } finally {
      setProcessingClinicRequestId('')
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

        <section className="admin-panel" aria-labelledby="clinic-requests-heading">
          <header className="admin-panel-header">
            <h2 id="clinic-requests-heading">Pending clinic access requests</h2>
            <span>{clinicRequests.length} pending</span>
          </header>

          {clinicError && (
            <p className="admin-message admin-error" role="alert">
              {clinicError}
            </p>
          )}

          {clinicFeedback && (
            <p className="admin-message admin-feedback" role="status">
              {clinicFeedback}
            </p>
          )}

          {loadingClinicRequests ? (
            <p className="admin-message">Loading clinic requests...</p>
          ) : clinicRequests.length === 0 ? (
            <p className="admin-message">No pending clinic access requests.</p>
          ) : (
            <section className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Staff member</th>
                    <th>Email</th>
                    <th>Current role</th>
                    <th>Requested clinic</th>
                    <th>Requested</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {clinicRequests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.users?.full_name || 'Unknown user'}</td>
                      <td>{request.users?.email || 'No email'}</td>
                      <td>{request.users?.role || 'Unknown'}</td>
                      <td>{request.clinics?.name || 'Unknown clinic'}</td>
                      <td>{new Date(request.created_at).toLocaleDateString('en-GB')}</td>
                      <td>
                        <menu className="admin-actions">
                          <li>
                            <button
                              className="admin-btn admin-btn-approve"
                              disabled={processingClinicRequestId === request.id}
                              onClick={() => approveClinicRequest(request)}
                              type="button"
                            >
                              Approve
                            </button>
                          </li>
                          <li>
                            <button
                              className="admin-btn admin-btn-reject"
                              disabled={processingClinicRequestId === request.id}
                              onClick={() => rejectClinicRequest(request)}
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
    </section>
  )
}