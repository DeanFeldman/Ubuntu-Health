import { useLocation } from 'react-router-dom'

export default function BookingPage() {
  const { state } = useLocation()
  const clinic = state?.clinic

  return (
    <main>
      <h1>Booking Page</h1>

    </main>
  )
}