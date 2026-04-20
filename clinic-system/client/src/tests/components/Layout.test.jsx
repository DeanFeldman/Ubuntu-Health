import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { canAccess } from '../../Utils/Permissions'

const mockNavigate = jest.fn()

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../Utils/Permissions', () => ({
  canAccess: jest.fn(),
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

function renderLayout(path = '/clinic') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="login" element={<div>Login</div>} />
          <Route path="clinic" element={<div>Clinic</div>} />
          <Route path="queue" element={<div>Queue</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('Layout', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    canAccess.mockReturnValue(true)
  })

  test('hides navbar on login page', () => {
    useAuth.mockReturnValue({
      user: null,
      role: null,
      logout: jest.fn(),
      RoleRequest: jest.fn(),
    })

    renderLayout('/login')

    expect(screen.queryByText('Ubuntu Health')).not.toBeInTheDocument()
  })

  test('shows back button on queue page', () => {
    useAuth.mockReturnValue({
      user: { id: '1' },
      role: 'Patient',
      logout: jest.fn(),
      RoleRequest: jest.fn(),
    })

    renderLayout('/queue')

    expect(screen.getByText('Back')).toBeInTheDocument()
  })

  test('clicking back navigates to clinic', () => {
    useAuth.mockReturnValue({
      user: { id: '1' },
      role: 'Patient',
      logout: jest.fn(),
      RoleRequest: jest.fn(),
    })

    renderLayout('/queue')

    fireEvent.click(screen.getByText('Back'))

    expect(mockNavigate).toHaveBeenCalledWith('/clinic')
  })

  test('patient sees request staff role button', () => {
    useAuth.mockReturnValue({
      user: { id: '1' },
      role: 'Patient',
      logout: jest.fn(),
      RoleRequest: jest.fn(),
    })

    renderLayout('/clinic')

    expect(
      screen.getByText('Request Staff Role')
    ).toBeInTheDocument()
  })

  test('staff sees request admin role button', () => {
    useAuth.mockReturnValue({
      user: { id: '1' },
      role: 'Staff',
      logout: jest.fn(),
      RoleRequest: jest.fn(),
    })

    renderLayout('/clinic')

    expect(
      screen.getByText('Request Admin Role')
    ).toBeInTheDocument()
  })

  test('logout button calls logout', () => {
    const logoutMock = jest.fn()

    useAuth.mockReturnValue({
      user: { id: '1' },
      role: 'Patient',
      logout: logoutMock,
      RoleRequest: jest.fn(),
    })

    renderLayout('/clinic')

    fireEvent.click(screen.getByText('Log out'))

    expect(logoutMock).toHaveBeenCalled()
  })
})
test('clicking request staff role calls RoleRequest with Staff', () => {
  const roleRequestMock = jest.fn()

  useAuth.mockReturnValue({
    user: { id: '1' },
    role: 'Patient',
    logout: jest.fn(),
    RoleRequest: roleRequestMock,
  })

  renderLayout('/clinic')

  fireEvent.click(screen.getByText('Request Staff Role'))

  expect(roleRequestMock).toHaveBeenCalledWith('Staff')
})

test('clicking request admin role calls RoleRequest with Admin', () => {
  const roleRequestMock = jest.fn()

  useAuth.mockReturnValue({
    user: { id: '1' },
    role: 'Staff',
    logout: jest.fn(),
    RoleRequest: roleRequestMock,
  })

  renderLayout('/clinic')

  fireEvent.click(screen.getByText('Request Admin Role'))

  expect(roleRequestMock).toHaveBeenCalledWith('Admin')
})