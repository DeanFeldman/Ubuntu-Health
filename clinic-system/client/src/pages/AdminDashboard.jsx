]import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || ''


const styles = `
  .admin-header {
    margin-bottom: 24px;
  }

  .admin-header h1 {
    margin-bottom: 8px;
  }

  .admin-header p {
    color: var(--uh-muted);
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

export default function AdminDashboard() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingRequestId, setProcessingRequestId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadRequests() {
      if (!user?.id) return

      try {
        setLoading(true)
        setError('')

        const response = await fetch(
          `${API_BASE_URL}/api/role-requests?admin_id=${encodeURIComponent(user.id)}&status=pending`
        )
        const body = await response.json()

        if (!response.ok) {
          throw new Error(body.error || 'Failed to load role requests')
        }

        setRequests(body.requests || [])
      } catch (err) {
        setError(err.message || 'Failed to load role requests')
      } finally {
        setLoading(false)
      }
    }

    loadRequests()
  }, [user?.id])

  async function approveRequest(request) {
    setProcessingRequestId(request.id)
    setFeedback('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/role-requests/${request.id}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_id: user.id,
        }),
      })
      const body = await response.json()

      if (!response.ok) {
        throw new Error(body.error || 'Failed to approve role request')
      }

      setRequests((currentRequests) =>
        currentRequests.filter((currentRequest) => currentRequest.id !== request.id)
      )
      setFeedback('Role request approved.')
    } catch (err) {
      setFeedback(err.message || 'Failed to approve role request')
    } finally {
      setProcessingRequestId('')
    }
  }

  async function rejectRequest(request) {
    setProcessingRequestId(request.id)
    setFeedback('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/role-requests/${request.id}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_id: user.id,
        }),
      })
      const body = await response.json()

      if (!response.ok) {
        throw new Error(body.error || 'Failed to reject role request')
      }

      setRequests((currentRequests) =>
        currentRequests.filter((currentRequest) => currentRequest.id !== request.id)
      )
      setFeedback('Role request rejected.')
    } catch (err) {
      setFeedback(err.message || 'Failed to reject role request')
    } finally {
      setProcessingRequestId('')
    }
  }

  return (
    <section>
      <style>{styles}</style>

      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>Review pending account role requests.</p>
      </header>

      <section className="admin-panel" aria-labelledby="role-requests-heading">
        <div className="admin-panel-header">
          <h2 id="role-requests-heading">Pending role requests</h2>
          <span>{requests.length} pending</span>
        </div>

        {error && (
          <p className="admin-message admin-error" role="alert">
            {error}
          </p>
        )}
        {feedback && (
          <p className="admin-message admin-feedback" role="status">
            {feedback}
          </p>
        )}

        {loading ? (
          <p className="admin-message">Loading role requests...</p>
        ) : requests.length === 0 ? (
          <p className="admin-message">No pending role requests.</p>
        ) : (
          <div className="admin-table-wrap">
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
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.users?.full_name || 'Unknown user'}</td>
                    <td>{request.users?.email || 'No email'}</td>
                    <td>{request.users?.role || 'Unknown'}</td>
                    <td>{request.requested_role}</td>
                    <td>{new Date(request.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="admin-btn admin-btn-approve"
                          disabled={processingRequestId === request.id}
                          onClick={() => approveRequest(request)}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="admin-btn admin-btn-reject"
                          disabled={processingRequestId === request.id}
                          onClick={() => rejectRequest(request)}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
