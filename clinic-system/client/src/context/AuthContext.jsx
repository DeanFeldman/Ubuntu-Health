import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Create context to share auth state across the app
const AuthContext = createContext()

export function AuthProvider({ children }) {
  // Logged-in Supabase user object
  const [user, setUser] = useState(null)

  // Role from our own DB (Patient / Clinic Staff / Admin)
  const [role, setRole] = useState(null)

  // Error message for UI
  const [error, setError] = useState('')

  // Loading state while restoring session / fetching role
  const [loading, setLoading] = useState(true)

   
  async function fetchOrCreateUser(authUser) {
    try {
      // Try find user in DB
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', authUser.id)
        .maybeSingle() // safer than single()

      if (fetchError) throw fetchError

      // If user exists → use stored role
      if (existingUser) {
        setRole(existingUser.role)
        return existingUser.role
      }

      // If first login → create new user with default role
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || '',
          role: 'Patient', // default role
        })
        .select('role')
        .single()

      if (insertError) throw insertError

      const newRole = newUser?.role || 'Patient'
      setRole(newRole)
      return newRole
    } catch (err) {
      console.error('Error fetching/creating user:', err)

      // If something fails, fallback safely
      setError('Could not load your profile.')
      setRole(null)
      return null
    }
  }


  useEffect(() => {
    async function getInitialSession() {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          setError('Could not restore your session. Please sign in again.')
          setLoading(false)
          return
        }

        const authUser = data.session?.user ?? null
        setUser(authUser)

        if (authUser) {
          await fetchOrCreateUser(authUser)
        } else {
          setRole(null)
        }
      } catch (err) {
        console.error(err)
        setError('Network error while restoring session.')
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

      setLoading(false)
    })

    return () => subscription.unsubscribe()
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

  // Provide auth state + functions to the rest of the app
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

// Custom hook for easy access to auth context
export function useAuth() {
  return useContext(AuthContext)
}