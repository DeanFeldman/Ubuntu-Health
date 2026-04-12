import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../app'
import { useAuth } from '../context/AuthContext'

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../pages/HomePage', () => () => <div>Home Page</div>)
jest.mock('../pages/LoginPage', () => () => <div>Login Page</div>)
jest.mock('../pages/PatientDashboard', () => () => <div>Patient Dashboard</div>)
jest.mock('../pages/StaffDashboard', () => () => <div>Staff Dashboard</div>)
jest.mock('../pages/AdminDashboard', () => () => <div>Admin Dashboard</div>)

describe('App routing and auth behaviour', () => {
  test('redirects unauthenticated users from /clinic to /login', () => {
    useAuth.mockReturnValue({
      user: null,
      role: null,
      loading: false,
    })

    render(
      <MemoryRouter initialEntries={['/clinic']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  test('allows Patient user to access /clinic', () => {
    useAuth.mockReturnValue({
      user: { id: '123' },
      role: 'Patient',
      loading: false,
    })

    render(
      <MemoryRouter initialEntries={['/clinic']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('Patient Dashboard')).toBeInTheDocument()
  })

  test('blocks Patient from accessing /admin', () => {
    useAuth.mockReturnValue({
      user: { id: '123' },
      role: 'Patient',
      loading: false,
    })

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  test('shows loading state', () => {
    useAuth.mockReturnValue({
      user: null,
      role: null,
      loading: true,
    })

    render(
      <MemoryRouter initialEntries={['/clinic']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})