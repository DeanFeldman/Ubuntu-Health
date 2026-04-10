import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  // Get auth-related data and functions from context
  const { loginWithGoogle, error, user, role, loading } = useAuth()
  const navigate = useNavigate()
  
  // Local error state for handling cancelled OAuth flows
  const [localError, setLocalError] = useState('')

  // Redirect user after successful login based on role
  useEffect(() => {
    if (!user || !role) return

    // Clear Auth Flag onces login complete
    sessionStorage.removeItem('oauth_started')

    if (role === 'Admin') {
      navigate('/admin')
    } else if (role === 'Staff') {
      navigate('/staff')
    } else {
      navigate('/clinic')
    }
  }, [user, role, navigate])

  // Check for cancelled or failed OAuth login attempts
  useEffect(() => {
    const started = sessionStorage.getItem('oauth_started')

    if (!loading && !user && started) {
      setLocalError('Login was cancelled or failed. Please try again.')
      sessionStorage.removeItem('oauth_started')
    }
  }, [loading, user])

  // Initiate Google OAuth login flow
  async function handleLogin() {
    setLocalError('')
    sessionStorage.setItem('oauth_started', 'true')
    await loginWithGoogle()
  }

  return (
    //Html Page contents
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.header}>
          <span style={styles.logo}>UH</span>
          <h1 style={styles.title}>Ubuntu Health</h1>
          <p style={styles.subtitle}>
            Sign in to manage your clinic visits and queue
          </p>
        </header>

        {(error || localError) && (
          <p role="alert" style={styles.error}>
            {error || localError}
          </p>
        )}

        // Google Sign-In button 
        <button
          type="button"
          style={styles.googleBtn}
          onClick={handleLogin}
        >
          //google icon image
          <span style={styles.googleIconWrap}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              style={styles.googleIcon}
              aria-hidden="true"
            >
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.3 5.5-6.1 7.1l6.3 5.2C39.8 36.3 44 30.7 44 24c0-1.3-.1-2.4-.4-3.5z"/>
            </svg>
          </span>
          <span>Sign in with Google</span>
        </button>

        <button
          type="button"
          style={styles.secondaryBtn}
          onClick={() => console.log('Create Account clicked')}
        >
          Create Account
        </button>

        <footer style={styles.footer}>
          Secure healthcare access platform
        </footer>
      </section>
    </main>
  )
}

// Basic inline styles for layout and appearance
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
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #2563EB, #22C55E)',
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: '20px',
    marginBottom: '12px',
  },

  title: {
    margin: 0,
    marginBottom: '0.3rem',
  },

  googleBtn: {
    width: '100%',
    height: '48px',
    borderRadius: '12px',
    border: '1px solid #DADCE0',
    backgroundColor: '#FFFFFF',
    color: '#1F1F1F',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '0 16px',
    boxSizing: 'border-box',
  },

  googleIconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    flexShrink: 0,
  },

  googleIcon: {
    width: '20px',
    height: '20px',
    display: 'block',
  },

  subtitle: {
    color: '#6B7280',
    fontSize: '0.9rem',
    margin: 0,
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