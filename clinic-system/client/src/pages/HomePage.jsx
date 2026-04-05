import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1>Ubuntu Health</h1>
        <p>Book appointments and track clinic queues </p>

        <button onClick={() => navigate('/login')}>
          Sign In / Sign Up
        </button>
      </section>
    </main>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#F3F4F6',
  },
  card: {
    padding: '2rem',
    background: 'white',
    borderRadius: '12px',
    textAlign: 'center',
  },
}