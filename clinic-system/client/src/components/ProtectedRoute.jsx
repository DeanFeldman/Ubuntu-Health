import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccess } from '../Utils/Permissions'

// The ProtectedRoute component is a wrapper for routes that require authentication and role-based access control. 
export default function ProtectedRoute({ children, routeName }) {
  const { user, role, loading } = useAuth()

  if (loading) return <p>Loading...</p>

  if (!user) return <Navigate to="/login" replace />

  if (!canAccess(role, routeName)) {
    if (role === 'Admin') return <Navigate to="/admin" replace />
    if (role === 'Staff') return <Navigate to="/staff" replace />
    return <Navigate to="/clinic" replace />
  }

  return children
}