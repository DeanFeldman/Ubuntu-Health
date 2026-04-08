import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
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

      if (existingUser) {
        setRole(existingUser.role)
        return existingUser.role
      }

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

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function loginWithGoogle() {
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
        console.error(error.message)
      }
    } catch (err) {
      console.error(err)
      setError('Network error. Please check your connection and try again.')
    }
  }

  async function logout() {
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

export function useAuth() {
  return useContext(AuthContext)
}