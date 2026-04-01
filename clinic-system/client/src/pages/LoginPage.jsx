//import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
//   const { loginWithGoogle, error } = useAuth()

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        
        <header style={styles.header}>
          <span style={styles.logo}>UH</span>
          <h1 style={styles.title}>Ubuntu Health</h1>
          <p style={styles.subtitle}>
            Sign in to manage your clinic visits and queue
          </p>
        </header>

        {/* {error && (
          <p role="alert" style={styles.error}>
            {error}
          </p>
        )} */}

        <button style={styles.primaryBtn} onClick={styles.primaryBtn}>
          Sign in with Google
        </button>

        <button style={styles.secondaryBtn}>
          Create Account
        </button>

        <footer style={styles.footer}>
          Secure healthcare access platform
        </footer>

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
    fontFamily: 'Inter, Arial, sans-serif',
  },

  card: {
    width: '100%',
    maxWidth: '380px',
    padding: '2rem',
    borderRadius: '20px',
    background: '#FFFFFF',
    boxShadow: '0 10px 30px rgba(17, 24, 39, 0.08)',
    textAlign: 'center',
  },

  header: {
    marginBottom: '1.5rem',
  },

  logo: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '50px',
    height: '50px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #2563EB, #22C55E)',
    color: 'white',
    fontWeight: '800',
    marginBottom: '10px',
  },

  title: {
    marginBottom: '0.3rem',
  },

  subtitle: {
    color: '#6B7280',
    fontSize: '0.9rem',
  },

  primaryBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: 'none',
    background: '#2563EB',
    color: 'white',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '1rem',
  },

  secondaryBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #2563EB',
    background: 'white',
    color: '#2563EB',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '0.6rem',
  },

  error: {
    color: '#EF4444',
    marginTop: '0.5rem',
  },

  footer: {
    marginTop: '1.5rem',
    fontSize: '0.8rem',
    color: '#6B7280',
  },
}

