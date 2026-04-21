import { render, screen, fireEvent } from '@testing-library/react'
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

  // test('renders login page content', () => {
  //   useAuth.mockReturnValue({
  //     loginWithGoogle: jest.fn(),
  //     error: '',
  //     user: null,
  //     role: null,
  //     loading: false,
  //   })

  //   renderPage()

  //   expect(screen.getByText('Ubuntu Health')).toBeInTheDocument()
  //   expect(
  //     screen.getByText('Sign in with Google')
  //   ).toBeInTheDocument()
  // })

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

    fireEvent.click(screen.getByText('Sign in with Google'))

    expect(loginMock).toHaveBeenCalled()
  })

  // test('shows auth error message', () => {
  //   useAuth.mockReturnValue({
  //     loginWithGoogle: jest.fn(),
  //     error: 'Login failed',
  //     user: null,
  //     role: null,
  //     loading: false,
  //   })

  //   renderPage()

  //   expect(screen.getByRole('alert')).toHaveTextContent('Login failed')
  // })

//   test('shows cancelled login error', () => {
//     sessionStorage.setItem('oauth_started', 'true')

//     useAuth.mockReturnValue({
//       loginWithGoogle: jest.fn(),
//       error: '',
//       user: null,
//       role: null,
//       loading: false,
//     })

//     renderPage()

//     expect(screen.getByRole('alert')).toHaveTextContent(
//       'Login was cancelled or failed'
//     )
//   })
})

test('redirects admin after login', () => {
  useAuth.mockReturnValue({
    loginWithGoogle: jest.fn(),
    error: '',
    user: { id: '1' },
    role: 'Admin',
    loading: false,
  })

  renderPage()

  expect(mockNavigate).toHaveBeenCalledWith('/admin')
})

test('redirects staff after login', () => {
  useAuth.mockReturnValue({
    loginWithGoogle: jest.fn(),
    error: '',
    user: { id: '1' },
    role: 'Staff',
    loading: false,
  })

  renderPage()

  expect(mockNavigate).toHaveBeenCalledWith('/staff')
})

test('redirects patient to clinic after login', () => {
  useAuth.mockReturnValue({
    loginWithGoogle: jest.fn(),
    error: '',
    user: { id: '1' },
    role: 'Patient',
    loading: false,
  })

  renderPage()

  expect(mockNavigate).toHaveBeenCalledWith('/clinic')
})