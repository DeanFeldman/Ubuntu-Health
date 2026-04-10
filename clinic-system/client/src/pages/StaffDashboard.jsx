import { useAuth } from '../context/AuthContext'

export default function StaffDashboard() {
  // Get logout function from our auth context
  const { logout } = useAuth()

  return (
    //Html Page contents
    <main>
      <h1>Staff Dashboard</h1>
      <button onClick={logout}>Log out</button>
    </main>
  )
}