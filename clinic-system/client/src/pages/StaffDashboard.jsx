import { useAuth } from '../context/AuthContext'

export default function StaffDashboard() {
  const { logout } = useAuth()

  return (
    <main>
      <h1>Staff Dashboard</h1>
      <button onClick={logout}>Log out</button>
    </main>
  )
}