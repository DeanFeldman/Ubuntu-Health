import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

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

  .admin-message {
    padding: 16px;
  }

  .admin-error {
    color: #DC2626;
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
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadRequests() {
      if (!user?.id) return

      try {
        setLoading(true)
        setError('')

        const response = await fetch(
          `/api/role-requests?admin_id=${encodeURIComponent(user.id)}&status=pending`
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
