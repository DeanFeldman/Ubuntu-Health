import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

export default function LoginPage() {
  const { loginWithGoogle, error, user, role, loading } = useAuth()
  const navigate = useNavigate()
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!user || !role) return

    sessionStorage.removeItem('oauth_started')

    if (role === 'Admin') navigate('/admin')
    else if (role === 'Staff') navigate('/staff')
    else navigate('/clinic')
  }, [user, role, navigate])

  useEffect(() => {
    const started = sessionStorage.getItem('oauth_started')

    if (!loading && !user && started) {
      setLocalError('Login was cancelled or failed. Please try again.')
      sessionStorage.removeItem('oauth_started')
    }
  }, [loading, user])

  async function handleLogin() {
    setLocalError('')
    sessionStorage.setItem('oauth_started', 'true')
    await loginWithGoogle()
  }

  return (
    <main style={styles.page}>
      <section style={styles.layout}>

        {/* LEFT */}
        <section style={styles.leftPanel}>
          <header style={styles.heroHeader}>

            {/* BIG CENTERED LOGO */}
            <img src={logo} alt="Ubuntu Health" style={styles.heroLogo} />

            <p style={styles.kicker}>Community Clinic Care</p>

            <h1 style={styles.heroTitle}>
              Smarter clinic queues,
              <br />
              bookings, and patient updates
            </h1>

            <p style={styles.heroText}>
              Ubuntu Health helps patients, staff, and admins manage clinic
              visits through booking, live queue tracking, and real-time updates.
            </p>
          </header>

          <section style={styles.infoGrid}>
            <article style={styles.infoCard}>
              <h2 style={styles.infoTitle}>Book appointments</h2>
              <p style={styles.infoText}>
                Schedule visits and avoid unnecessary waiting.
              </p>
            </article>

            <article style={styles.infoCard}>
              <h2 style={styles.infoTitle}>Track queue progress</h2>
              <p style={styles.infoText}>
                See live queue position and status updates.
              </p>
            </article>

            <article style={styles.infoCard}>
              <h2 style={styles.infoTitle}>Manage clinics</h2>
              <p style={styles.infoText}>
                Manage services, hours, and patient flow.
              </p>
            </article>

            <article style={styles.infoCard}>
              <h2 style={styles.infoTitle}>Real clinic data</h2>
              <p style={styles.infoText}>
                Access verified South African clinic info.
              </p>
            </article>
          </section>
        </section>

        {/* RIGHT */}
        <section style={styles.rightPanel}>
          <section style={styles.card}>
            <header style={styles.cardHeader}>

              {/* BIG CENTERED LOGO */}
              <img src={logo} alt="Ubuntu Health" style={styles.cardLogo} />

              <h2 style={styles.cardTitle}>Welcome to Ubuntu Health</h2>
              <p style={styles.cardSubtitle}>Sign in securely to continue</p>
            </header>

            {(error || localError) && (
              <p style={styles.error}>{error || localError}</p>
            )}

            <button
              style={styles.googleBtn}
              onClick={handleLogin}
            >
              Sign in with Google
            </button>

            <section style={styles.loginInfoBox}>
              <p style={styles.loginInfoText}>
                Secure login for Patients, Staff, and Admins
              </p>
            </section>

            <footer style={styles.footer}>
              Secure healthcare platform
            </footer>
          </section>
        </section>

      </section>
    </main>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #ECFDF5, #EFF6FF)',
    fontFamily: 'Inter, Arial',
    padding: '32px',
  },

  layout: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.9fr',
    gap: '40px',
    maxWidth: '1200px',
    margin: '0 auto',
    alignItems: 'center',
  },

  leftPanel: {
    padding: '20px',
  },

  heroHeader: {
    textAlign: 'center',
    marginBottom: '30px',
  },

  heroLogo: {
    width: '340px',
    margin: '0 auto 20px',
    display: 'block',
  },

  kicker: {
    color: '#059669',
    fontWeight: '600',
    fontSize: '0.8rem',
    letterSpacing: '1px',
  },

  heroTitle: {
    fontSize: '2.6rem',
    color: '#0F172A',
    marginBottom: '12px',
  },

  heroText: {
    color: '#475569',
    maxWidth: '600px',
    margin: '0 auto',
  },

  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },

  infoCard: {
    padding: '16px',
    borderRadius: '14px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
  },

  infoTitle: {
    fontSize: '0.95rem',
    color: '#0F172A',
  },

  infoText: {
    fontSize: '0.85rem',
    color: '#64748B',
  },

  rightPanel: {
    display: 'flex',
    justifyContent: 'center',
  },

  card: {
    width: '100%',
    maxWidth: '400px',
    padding: '30px',
    borderRadius: '18px',
    background: 'white',
    boxShadow: '0 15px 40px rgba(0,0,0,0.08)',
    textAlign: 'center',
  },

  cardHeader: {
    marginBottom: '20px',
  },

  cardLogo: {
    width: '200px',
    margin: '0 auto 12px',
    display: 'block',
  },

  cardTitle: {
    fontSize: '1.5rem',
    color: '#0F172A',
  },

  cardSubtitle: {
    color: '#64748B',
    fontSize: '0.9rem',
  },

  googleBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #10B981, #2563EB)',
    color: 'white',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '10px',
  },

  loginInfoBox: {
    marginTop: '14px',
    padding: '10px',
    background: '#F0FDF4',
    borderRadius: '10px',
  },

  loginInfoText: {
    fontSize: '0.8rem',
    color: '#166534',
  },

  error: {
    color: 'red',
    marginBottom: '10px',
  },

  footer: {
    marginTop: '16px',
    fontSize: '0.75rem',
    color: '#94A3B8',
  },
}