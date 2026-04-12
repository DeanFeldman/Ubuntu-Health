/**
 * Tests for App routing and authentication behaviour.
 * Verifies that users are redirected correctly based on
 * authentication state and role.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../app'
import { useAuth } from '../context/AuthContext'

// mock authentication context- we can control user state in tests
jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))
// mock page components to isolate routing behaviour
jest.mock('../pages/HomePage', () => () => <div>Home Page</div>)
jest.mock('../pages/LoginPage', () => () => <div>Login Page</div>)
jest.mock('../pages/PatientDashboard', () => () => <div>Patient Dashboard</div>)
jest.mock('../pages/StaffDashboard', () => () => <div>Staff Dashboard</div>)
jest.mock('../pages/AdminDashboard', () => () => <div>Admin Dashboard</div>)

describe('App routing and auth behaviour', () => {

  test('redirects unauthenticated users from /clinic to /login', () => {
    // simulate a user who is not logged in
    useAuth.mockReturnValue({
      user: null,
      role: null,
      loading: false,
    })
    // render app at /clinic route
    render(
      <MemoryRouter initialEntries={['/clinic']}>
        <App />
      </MemoryRouter>
    )
    //expect redirect to login page
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  test('allows Patient user to access /clinic', () => {
    // simulate a logged-in patient user
    useAuth.mockReturnValue({
      user: { id: '123' },
      role: 'Patient',
      loading: false,
    })
    // render app at /clinic route
    render(
      <MemoryRouter initialEntries={['/clinic']}>
        <App />
      </MemoryRouter>
    )
    //expect to see patient dashboard
    expect(screen.getByText('Patient Dashboard')).toBeInTheDocument()
  })

  test('blocks Patient from accessing /admin', () => {
    // simulate a logged-in patient user (trying to access an admin route)
    useAuth.mockReturnValue({
      user: { id: '123' },
      role: 'Patient',
      loading: false,
    })
    // render app at /admin route
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    )
    //expect redirect to login page (or could be a "not authorized" page depending on implementation)
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  test('shows loading state', () => {
    // simulate loading state
    useAuth.mockReturnValue({
      user: null,
      role: null,
      loading: true,
    })
    // render app while loading
    render(
      <MemoryRouter initialEntries={['/clinic']}>
        <App />
      </MemoryRouter>
    )
    //expect to see loading indicator
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
  test('allows Admin user to access /admin', () => {
  // Simulate an Admin user
  useAuth.mockReturnValue({
    user: { id: '123' },
    role: 'Admin',
    loading: false,
  })

  // Render app at /admin route
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <App />
    </MemoryRouter>
  )

  // Expect Admin dashboard to be shown
  expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
})
test('allows Staff user to access /staff', () => {
  // Simulate a Staff user
  useAuth.mockReturnValue({
    user: { id: '123' },
    role: 'Staff',
    loading: false,
  })

  // Render app at /staff route
  render(
    <MemoryRouter initialEntries={['/staff']}>
      <App />
    </MemoryRouter>
  )

  // Expect Staff dashboard to be shown
  expect(screen.getByText('Staff Dashboard')).toBeInTheDocument()
})
  test('allows Admin user to access /admin', () => {
    // Simulate a logged-in Admin user
    useAuth.mockReturnValue({
      user: { id: '123' },
      role: 'Admin',
      loading: false,
    })

    // Render app at /admin route
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    )

    // Expect Admin dashboard to be shown
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
  })

  test('allows Staff user to access /staff', () => {
    // Simulate a logged-in Staff user
    useAuth.mockReturnValue({
      user: { id: '123' },
      role: 'Staff',
      loading: false,
    })

    // Render app at /staff route
    render(
      <MemoryRouter initialEntries={['/staff']}>
        <App />
      </MemoryRouter>
    )

    // Expect Staff dashboard to be shown
    expect(screen.getByText('Staff Dashboard')).toBeInTheDocument()
  })
  test('redirects Patient to /clinic via RoleRedirect', () => {
  useAuth.mockReturnValue({
    user: { id: '123' },
    role: 'Patient',
    loading: false,
  })

  render(
    <MemoryRouter initialEntries={['/redirect']}>
      <App />
    </MemoryRouter>
  )

  expect(screen.getByText('Patient Dashboard')).toBeInTheDocument()
})
})