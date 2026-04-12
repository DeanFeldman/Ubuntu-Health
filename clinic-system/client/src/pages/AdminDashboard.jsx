import { useAuth } from '../context/AuthContext'

export default function AdminDashboard() {
    // Get logout function from our auth context
  const { logout } = useAuth()

  return (
    
    <main>
      {/* Html Page contents */}
      <h1>Admin Dashboard</h1>
      <button onClick={logout}>Log out</button>
    </main>
  )
}