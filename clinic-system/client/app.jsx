import { Routes, Route, Navigate } from 'react-router-dom'

import Layout from './src/components/Layout'
import ProtectedRoute from './src/components/ProtectedRoute'

import LoginPage from './src/pages/LoginPage'
import PatientDashboard from './src/pages/PatientDashboard'
import StaffDashboard from './src/pages/StaffDashboard'
import AdminDashboard from './src/pages/AdminDashboard'

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