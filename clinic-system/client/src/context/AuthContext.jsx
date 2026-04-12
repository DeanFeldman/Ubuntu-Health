import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Create a global context for authentication state
const AuthContext = createContext()

export function AuthProvider({ children }) {
  {/*State to hold the current user, their role, any auth errors, and loading status from supabase */}
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function fetchOrCreateUser(authUser) {
    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', authUser.id)
        .maybeSingle()

      if (fetchError) throw fetchError

      {/*If user exists, use their stored role */}
      if (existingUser) {
        setRole(existingUser.role)
        return existingUser.role
      }

      {/*Otherwise create a new user with default role "Patient" */}
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || '',
          role: 'Patient',
        })
        .select('role')
        .single()

      if (insertError) throw insertError

      const newRole = newUser?.role || 'Patient'
      setRole(newRole)
      return newRole
    } catch (err) {
      console.error('Error fetching/creating user:', err)
      setError('Could not load your profile.')
      setRole(null)
      return null
    }
  }

  {/*Restores user session from Supabase on page load or refresh */}
  async function restoreSession(session) {
    try {
      const authUser = session?.user ?? null
      setUser(authUser)

      if (authUser) {
        await fetchOrCreateUser(authUser)
      } else {
        setRole(null)
      }
    } catch (err) {
      console.error('Session restore error:', err)
      setError('Could not restore your session.')
      setUser(null)
      setRole(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    {/*Initial session load when app starts */}
    async function init() {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) throw error
        if (!mounted) return

        await restoreSession(data.session)
      } catch (err) {
        console.error('Initial session error:', err)
        if (mounted) {
          setError('Could not restore your session. Please sign in again.')
          setUser(null)
          setRole(null)
          setLoading(false)
        }
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      setTimeout(() => {
        if (mounted) {
          restoreSession(session)
        }
      }, 0)
    })
    {/*Cleanup to prevent memory leaks */}
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])
{/*Starts Google OAuth login flow */}
async function loginWithGoogle() {
  sessionStorage.setItem('oauth_started', 'true')
  setError('')

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    })

    if (error) {
      setError('Google sign-in failed. Please try again.')
      sessionStorage.removeItem('oauth_started')
    }
  } catch (err) {
    setError('Network error. Please try again.')
    sessionStorage.removeItem('oauth_started')
  }
}
  {/*Logs the user out and clears local state */}
  async function logout() {
    setError('')

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        setError('Could not log out. Please try again.')
        console.error(error.message)
        return
      }
      sessionStorage.removeItem('oauth_started')
      setUser(null)
      setRole(null)
    } catch (err) {
      console.error(err)
      setError('Network error while logging out.')
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        error,
        loading,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

{/*Custom hook to easily access auth context in components */}
export function useAuth() {
  return useContext(AuthContext)
}