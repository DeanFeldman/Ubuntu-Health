import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../context/AuthContext'

const mockGetSession = jest.fn()
const mockOnAuthStateChange = jest.fn()
const mockSignInWithOAuth = jest.fn()
const mockSignOut = jest.fn()

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
      signInWithOAuth: (...args) => mockSignInWithOAuth(...args),
      signOut: (...args) => mockSignOut(...args),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'new-user',
          role: 'Patient',
          clinic_id: null,
          full_name: '',
        },
        error: null,
      }),
    })),
  },
}))

function TestConsumer() {
  const auth = useAuth()

  return (
    <div>
      <div data-testid="loading">{String(auth.loading)}</div>
      <div data-testid="error">{auth.error}</div>
      <div data-testid="role">{auth.role ?? ''}</div>
      <button onClick={auth.loginWithGoogle}>Login</button>
      <button onClick={auth.logout}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  const unsubscribeMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    sessionStorage.clear()

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