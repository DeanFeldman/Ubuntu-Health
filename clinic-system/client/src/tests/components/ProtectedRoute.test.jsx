import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProtectedRoute from '../../components/ProtectedRoute'
import { useAuth } from '../../context/AuthContext'
import { canAccess } from '../../Utils/Permissions'

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../Utils/Permissions', () => ({
  canAccess: jest.fn(),
}))

function renderProtectedRoute(props = {}) {
  return render(
    <MemoryRouter>
      <ProtectedRoute routeName="queue" {...props}>
        <div>Protected Content</div>
      </ProtectedRoute>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  test('shows loading message when auth is loading', () => {
    useAuth.mockReturnValue({
      user: null,
      role: null,
      loading: true,
    })

    renderProtectedRoute()

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('redirects to login when there is no user', () => {
    useAuth.mockReturnValue({
      user: null,
      role: null,
      loading: false,
    })

    renderProtectedRoute()

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  test('redirects admin to admin page when access is denied', () => {
    useAuth.mockReturnValue({
      user: { id: '1' },
      role: 'Admin',
      loading: false,
    })

    canAccess.mockReturnValue(false)

    renderProtectedRoute()

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  test('redirects staff to staff page when access is denied', () => {
    useAuth.mockReturnValue({
      user: { id: '1' },
      role: 'Staff',
      loading: false,
    })

    canAccess.mockReturnValue(false)

    renderProtectedRoute()

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  test('redirects other roles to clinic page when access is denied', () => {
    useAuth.mockReturnValue({
      user: { id: '1' },
      role: 'Patient',
      loading: false,
    })

    canAccess.mockReturnValue(false)

    renderProtectedRoute()

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  test('renders children when user has access', () => {
    useAuth.mockReturnValue({
      user: { id: '1' },
      role: 'Admin',
      loading: false,
    })

    canAccess.mockReturnValue(true)

    renderProtectedRoute()

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})