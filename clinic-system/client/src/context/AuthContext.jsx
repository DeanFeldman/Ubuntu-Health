import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          setError('Could not restore your session. Please sign in again.')
          return
        }

        setUser(data.session?.user ?? null)
      } catch (err) {
        setError('Network error while restoring session.')
        console.error(err)
      }
    }

    getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])


  const loginWithGoogle = async () => {
    setError('')

    try {
      const redirectTo = `${window.location.origin}/login`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
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
    } catch (err) {
      setError('Network error while logging out.')
      console.error(err)
    }
  }

  return (
    <AuthContext.Provider value={{ user, error, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}