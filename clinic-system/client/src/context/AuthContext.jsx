import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Get session on load
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    // Listen for changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    })

    if (error) {
      console.error(error.message)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  )
}


export function useAuth() {
  return useContext(AuthContext)
}