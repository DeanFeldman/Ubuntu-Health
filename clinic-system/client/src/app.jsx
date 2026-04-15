import { Routes, Route, Navigate } from 'react-router-dom'

import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

import LoginPage from './pages/LoginPage'
import PatientDashboard from './pages/PatientDashboard'
import StaffDashboard from './pages/StaffDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Queue from './pages/Queue'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/clinic" replace />} />

        <Route
          path="/clinic"
          element={
            <ProtectedRoute routeName="clinic">
              <PatientDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/queue"
          element={
            <ProtectedRoute routeName="clinic">
              <Queue />
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff"
          element={
            <ProtectedRoute routeName="staff">
              <StaffDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute routeName="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/clinic" replace />} />
      </Route>
    </Routes>
  )
}