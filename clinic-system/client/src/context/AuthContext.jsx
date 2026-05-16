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
      .select('id, role, clinic_id, full_name')
      .eq('id', authUser.id)
      .maybeSingle()

    if (fetchError) throw fetchError

    if (existingUser) {
      console.log('DB USER:', existingUser)
      setUser(existingUser)
      setRole(existingUser.role)
      return existingUser.role
    }

    // Check if a ghost patient record exists with the same email
    if (authUser.email) {
      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id')
        .eq('email', authUser.email)
        .is('linked_user_id', null)
        .maybeSingle()

      if (existingPatient) {
        await supabase
          .from('patients')
          .update({ linked_user_id: authUser.id })
          .eq('id', existingPatient.id)
      }
    }

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || '',
        role: 'Patient',
      })
      .select('id, role, clinic_id, full_name')
      .single()

    if (insertError) throw insertError

    setUser(newUser)
    setRole(newUser.role)
    return newUser.role
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

  const RoleRequest = async (requestedRole) => {
  try {
    if (!user?.id) {
      throw new Error('No logged-in user found')
    }

    const allowedRoles = ['Patient', 'Staff', 'Admin']
    if (!allowedRoles.includes(requestedRole)) {
      throw new Error('Invalid requested role')
    }

    if (role === requestedRole) {
      throw new Error('You already have this role')
    }

    const { data: existingRequest, error: existingError } = await supabase
      .from('role_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('requested_role', requestedRole)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingError) throw existingError

    if (existingRequest) {
      throw new Error('A pending request for this role already exists')
    }

    const { error } = await supabase
      .from('role_requests')
      .insert({
        user_id: user.id,
        requested_role: requestedRole,
        status: 'pending'
      })

    if (error) throw error

    } catch (err) {
    console.error(err)
    throw err
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
        RoleRequest
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