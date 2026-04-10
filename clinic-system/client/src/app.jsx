import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './context/AuthContext'

import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PatientDashboard from './pages/PatientDashboard'
import StaffDashboard from './pages/StaffDashboard'
import AdminDashboard from './pages/AdminDashboard'

function RoleRedirect() {
  // Get current auth state so we can send users to the correct page
  const { user, role, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return

    // If no user is logged in, send them back to login
    if (!user) {
      navigate('/login')
      return
    }
    // Redirect users based on the role stored in the system
    if (role === 'Admin') navigate('/admin')
    else if (role === 'Staff') navigate('/staff')
    else if (role === 'Patient') navigate('/clinic')
    else navigate('/login')
  }, [user, role, loading, navigate])

  return <p>Loading...</p>
}

function ProtectedRoute({ children, allowedRoles }) {
  // Used to stop unauthorised users from opening protected pages

  const { user, role, loading } = useAuth()

  if (loading) return <p>Loading...</p>
  if (!user) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(role)) return <Navigate to="/login" replace />

  return children
}

export default function App() {
  return (
    <Routes>
      // publioc routes
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/redirect" element={<RoleRedirect />} />

      // protected routes
      <Route
        path="/patient"
        element={
          <ProtectedRoute allowedRoles={['Patient']}>
            <PatientDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/clinic"
        element={
          <ProtectedRoute allowedRoles={['Patient']}>
            <PatientDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={['Staff']}>
            <StaffDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}