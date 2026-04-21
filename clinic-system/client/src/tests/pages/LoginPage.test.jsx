import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../../pages/LoginPage'
import { useAuth } from '../../context/AuthContext'

const mockNavigate = jest.fn()

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sessionStorage.clear()
  })

  test('renders login page content', () => {
    useAuth.mockReturnValue({
      loginWithGoogle: jest.fn(),
      error: '',
      user: null,
      role: null,
      loading: false,
    })

    renderPage()

    expect(
      screen.getByRole('heading', { name: /welcome to ubuntu health/i })
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: /sign in with google/i })
    ).toBeInTheDocument()

    expect(
      screen.getByText(/secure login for patients, staff, and admins/i)
    ).toBeInTheDocument()
  })

  test('calls loginWithGoogle when button clicked', () => {
    const loginMock = jest.fn()

    useAuth.mockReturnValue({
      loginWithGoogle: loginMock,
      error: '',
      user: null,
      role: null,
      loading: false,
    })

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))

    expect(loginMock).toHaveBeenCalled()
    expect(sessionStorage.getItem('oauth_started')).toBe('true')
  })

  test('shows auth error message', () => {
    useAuth.mockReturnValue({
      loginWithGoogle: jest.fn(),
      error: 'Login failed',
      user: null,
      role: null,
      loading: false,
    })

    renderPage()

    expect(screen.getByText('Login failed')).toBeInTheDocument()
  })

  test('shows cancelled login error', () => {
    sessionStorage.setItem('oauth_started', 'true')

    useAuth.mockReturnValue({
      loginWithGoogle: jest.fn(),
      error: '',
      user: null,
      role: null,
      loading: false,
    })

    renderPage()

    expect(
      screen.getByText('Login was cancelled or failed. Please try again.')
    ).toBeInTheDocument()
  })

  test('redirects admin after login', async () => {
    useAuth.mockReturnValue({
      loginWithGoogle: jest.fn(),
      error: '',
      user: { id: '1' },
      role: 'Admin',
      loading: false,
    })

    renderPage()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin')
    })
  })

  test('redirects staff after login', async () => {
    useAuth.mockReturnValue({
      loginWithGoogle: jest.fn(),
      error: '',
      user: { id: '1' },
      role: 'Staff',
      loading: false,
    })

    renderPage()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/staff')
    })
  })

  test('redirects patient to clinic after login', async () => {
    useAuth.mockReturnValue({
      loginWithGoogle: jest.fn(),
      error: '',
      user: { id: '1' },
      role: 'Patient',
      loading: false,
    })

    renderPage()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/clinic')
    })
  })
})