import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PatientDashboard from './pages/PatientDashboard'
import StaffDashboard from './pages/StaffDashboard'
import AdminDashboard from './pages/AdminDashboard'

function ProtectedRoute({ children, allowedRole }) {
  const { user, role, loading } = useAuth()

  if (loading) return <p>Loading...</p>
  if (!user) return <Navigate to="/login" replace />

  if (allowedRole && role !== allowedRole) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/clinic"
          element={
            <ProtectedRoute allowedRole="Patient">
              <PatientDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRole="Staff">
              <StaffDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="Admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/redirect" element={<Navigate to="/clinic" replace />} />
      </Route>
    </Routes>
  )
}