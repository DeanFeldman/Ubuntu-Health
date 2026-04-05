import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchOrCreateUser = async (authUser) => {
    try {
      // Check if user already exists in our users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single()

      if (existingUser) {
        // User exists — just get their role
        setRole(existingUser.role)
      } else {
        // First login — create user record with default role Patient
        const { data: newUser } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            full_name: authUser.user_metadata?.full_name || '',
            role: 'Patient'
          })
          .select('role')
          .single()

        setRole(newUser?.role || 'Patient')
      }
    } catch (err) {
      console.error('Error fetching/creating user:', err)
      setRole('Patient')
    }
  }

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          setError('Could not restore your session. Please sign in again.')
          return
        }
        const authUser = data.session?.user ?? null
        setUser(authUser)
        if (authUser) await fetchOrCreateUser(authUser)
      } catch (err) {
        setError('Network error while restoring session.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        await fetchOrCreateUser(authUser)
      } else {
        setRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loginWithGoogle = async () => {
    setError('')
    try {
      const redirectTo = `${window.location.origin}/login`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) {
        setError('Google sign-in failed. Please try again.')
        console.error(error.message)
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.')
      console.error(err)
    }
  }

  const logout = async () => {
    setError('')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setError('Could not log out. Please try again.')
        console.error(error.message)
        return
      }
      setUser(null)
      setRole(null)
    } catch (err) {
      setError('Network error while logging out.')
      console.error(err)
    }
  }

  return (
    <AuthContext.Provider value={{ user, role, error, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}