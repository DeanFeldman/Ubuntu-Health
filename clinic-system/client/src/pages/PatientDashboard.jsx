import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PatientDashboard() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main>
      <h1>Patient Dashboard</h1>
      <button onClick={handleLogout}>Log out</button>
    </main>
  )
}