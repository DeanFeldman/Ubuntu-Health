import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../context/AuthContext'

const mockGetSession = jest.fn()
const mockOnAuthStateChange = jest.fn()
const mockSignInWithOAuth = jest.fn()
const mockSignOut = jest.fn()
const mockFrom = jest.fn()

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
      signInWithOAuth: (...args) => mockSignInWithOAuth(...args),
      signOut: (...args) => mockSignOut(...args),
    },
    from: (...args) => mockFrom(...args),
  },
}))

function makeUsersQuery({
  existingUser = null,
  fetchError = null,
  insertedUser = {
    id: 'new-user',
    role: 'Patient',
    clinic_id: null,
    full_name: '',
  },
  insertError = null,
} = {}) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: existingUser,
      error: fetchError,
    }),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: insertedUser,
      error: insertError,
    }),
  }

  return query
}

function makeRoleRequestsQuery({
  existingRequest = null,
  existingError = null,
  insertError = null,
} = {}) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: existingRequest,
      error: existingError,
    }),
    insert: jest.fn().mockResolvedValue({
      error: insertError,
    }),
  }

  return query
}

function TestConsumer() {
  const auth = useAuth()

  return (
    <div>
      <div data-testid="loading">{String(auth.loading)}</div>
      <div data-testid="error">{auth.error}</div>
      <div data-testid="role">{auth.role ?? ''}</div>
      <div data-testid="user-id">{auth.user?.id ?? ''}</div>
      <button onClick={auth.loginWithGoogle}>Login</button>
      <button onClick={auth.logout}>Logout</button>
      <button onClick={() => auth.RoleRequest('Staff')}>Request Staff</button>
      <button onClick={() => auth.RoleRequest('Admin')}>Request Admin</button>
      <button onClick={() => auth.RoleRequest('InvalidRole')}>Request Invalid</button>
    </div>
  )
}

describe('AuthContext', () => {
  const unsubscribeMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    sessionStorage.clear()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(window, 'alert').mockImplementation(() => {})

    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: unsubscribeMock,
        },
      },
    })

    mockSignInWithOAuth.mockResolvedValue({ error: null })
    mockSignOut.mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return makeUsersQuery()
      }
      if (table === 'role_requests') {
        return makeRoleRequestsQuery()
      }
      if (table === 'patients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)

      throw new Error(`Unexpected table: ${table}`)
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('renders children inside provider', async () => {
    render(
      <AuthProvider>
        <div>Child Content</div>
      </AuthProvider>
    )

    expect(screen.getByText('Child Content')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled()
    })
  })

  test('useAuth provides default context values', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    expect(screen.getByTestId('error')).toHaveTextContent('')
    expect(screen.getByTestId('role')).toHaveTextContent('')
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  test('loginWithGoogle starts OAuth flow', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    fireEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      })
    })

    expect(sessionStorage.getItem('oauth_started')).toBe('true')
  })

  test('loginWithGoogle sets error when provider returns an error', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: 'OAuth failed' },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    fireEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent(
        'Google sign-in failed. Please try again.'
      )
    })

    expect(sessionStorage.getItem('oauth_started')).toBeNull()
  })

  test('loginWithGoogle sets network error when request throws', async () => {
    mockSignInWithOAuth.mockRejectedValue(new Error('Network down'))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    fireEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent(
        'Network error. Please try again.'
      )
    })

    expect(sessionStorage.getItem('oauth_started')).toBeNull()
  })

  test('logout calls supabase signOut', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    fireEvent.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
    })
  })

  test('logout clears oauth_started from session storage', async () => {
    sessionStorage.setItem('oauth_started', 'true')

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    fireEvent.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
    })

    expect(sessionStorage.getItem('oauth_started')).toBeNull()
  })

  test('logout sets error when signOut returns an error', async () => {
    mockSignOut.mockResolvedValue({
      error: { message: 'Could not sign out' },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    fireEvent.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent(
        'Could not log out. Please try again.'
      )
    })
  })

  test('logout sets network error when signOut throws', async () => {
    mockSignOut.mockRejectedValue(new Error('Request failed'))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    fireEvent.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent(
        'Network error while logging out.'
      )
    })
  })

  test('restores an existing user from the database session', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'existing-user',
            email: 'existing@example.com',
            user_metadata: { full_name: 'Existing User' },
          },
        },
      },
      error: null,
    })

    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return makeUsersQuery({
          existingUser: {
            id: 'existing-user',
            role: 'Admin',
            clinic_id: null,
            full_name: 'Existing User',
          },
        })
      }

      if (table === 'role_requests') {
        return makeRoleRequestsQuery()
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('Admin')
    })

    expect(screen.getByTestId('user-id')).toHaveTextContent('existing-user')
  })

  test('creates a new user when session user is not found in database', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'new-user',
            email: 'new@example.com',
            user_metadata: { full_name: 'New User' },
          },
        },
      },
      error: null,
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('Patient')
    })

    expect(screen.getByTestId('user-id')).toHaveTextContent('new-user')
  })

  test('sets error when initial session fetch fails', async () => {
    mockGetSession.mockResolvedValue({
      data: null,
      error: new Error('Session failed'),
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent(
        'Could not restore your session. Please sign in again.'
      )
    })

    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  })

  test('RoleRequest submits a valid staff request', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'patient-1',
            email: 'patient@example.com',
            user_metadata: { full_name: 'Patient One' },
          },
        },
      },
      error: null,
    })

    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return makeUsersQuery({
          existingUser: {
            id: 'patient-1',
            role: 'Patient',
            clinic_id: null,
            full_name: 'Patient One',
          },
        })
      }

      if (table === 'role_requests') {
        return makeRoleRequestsQuery()
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('Patient')
    })

    fireEvent.click(screen.getByText('Request Staff'))

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Request submitted!')
    })
  })

  test('RoleRequest rejects an invalid requested role', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'patient-1',
            email: 'patient@example.com',
            user_metadata: { full_name: 'Patient One' },
          },
        },
      },
      error: null,
    })

    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return makeUsersQuery({
          existingUser: {
            id: 'patient-1',
            role: 'Patient',
            clinic_id: null,
            full_name: 'Patient One',
          },
        })
      }

      if (table === 'role_requests') {
        return makeRoleRequestsQuery()
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('Patient')
    })

    fireEvent.click(screen.getByText('Request Invalid'))

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Invalid requested role')
    })
  })

  test('RoleRequest rejects requesting the same role', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            user_metadata: { full_name: 'Admin User' },
          },
        },
      },
      error: null,
    })

    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return makeUsersQuery({
          existingUser: {
            id: 'admin-1',
            role: 'Admin',
            clinic_id: null,
            full_name: 'Admin User',
          },
        })
      }

      if (table === 'role_requests') {
        return makeRoleRequestsQuery()
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('Admin')
    })

    fireEvent.click(screen.getByText('Request Admin'))

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('You already have this role')
    })
  })

  test('RoleRequest rejects duplicate pending requests', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'patient-1',
            email: 'patient@example.com',
            user_metadata: { full_name: 'Patient One' },
          },
        },
      },
      error: null,
    })

    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return makeUsersQuery({
          existingUser: {
            id: 'patient-1',
            role: 'Patient',
            clinic_id: null,
            full_name: 'Patient One',
          },
        })
      }

      if (table === 'role_requests') {
        return makeRoleRequestsQuery({
          existingRequest: { id: 'pending-1' },
        })
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('Patient')
    })

    fireEvent.click(screen.getByText('Request Staff'))

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        'A pending request for this role already exists'
      )
    })
  })

  test('unsubscribes auth listener on unmount', async () => {
    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalled()
    })

    unmount()

    expect(unsubscribeMock).toHaveBeenCalled()
  })
})