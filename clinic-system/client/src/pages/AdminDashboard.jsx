import { useAuth } from '../context/AuthContext'

export default function AdminDashboard() {
  const { logout } = useAuth()

  return (
    <main>
      <h1>Admin Dashboard</h1>
      <button onClick={logout}>Log out</button>
    </main>
  )
}