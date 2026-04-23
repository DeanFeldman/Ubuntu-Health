import { Routes, Route, Navigate } from 'react-router-dom'


import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

import LoginPage from './pages/LoginPage'
import PatientDashboard from './pages/PatientDashboard'
import StaffDashboard from './pages/StaffDashboard'
import AdminDashboard from './pages/AdminDashboard'
import QueuePage from './pages/QueuePage'
import BookingPage from './pages/BookingPage'


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


        <Route
          path="/queue"
          element={
            <ProtectedRoute routeName="clinic">
              <QueuePage />
            </ProtectedRoute>
          }
        />


        <Route
          path="/booking"
          element={
            <ProtectedRoute routeName="clinic">
              <BookingPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/clinic" replace />} />
      </Route>
    </Routes>
  )
}