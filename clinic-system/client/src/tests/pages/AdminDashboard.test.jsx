import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminDashboard from '../../pages/AdminDashboard'
import { useAuth } from '../../context/AuthContext'

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../lib/getApiBase', () => jest.fn(() => 'http://localhost:8080'))


//Safe fetch mock for admin endpoints
function mockFetch({
  roleRequests = [],
  clinicRequests = [],
  error = null,
} = {}) {
  global.fetch = jest.fn((url) => {
    // Role requests
    if (String(url).includes('/role-requests')) {
      if (error) {
        return Promise.resolve({
          ok: false,
          text: async () => JSON.stringify({ error }),
        })
      }

      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ requests: roleRequests }),
      })
    }

    // Clinic requests
    if (String(url).includes('/clinic-requests')) {
      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ requests: clinicRequests }),
      })
    }

    return Promise.resolve({
      ok: true,
      text: async () => '{}',
    })
  })
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    useAuth.mockReturnValue({
      user: { id: 'admin-1' },
    })

    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('shows loading state initially', async () => {
    mockFetch()

    render(<AdminDashboard />)

    expect(
      await screen.findByText('Loading role requests...')
    ).toBeInTheDocument()
  })

  test('shows empty state when no role requests', async () => {
    mockFetch({ roleRequests: [] })

    render(<AdminDashboard />)

    expect(
      await screen.findByText('No pending role requests.')
    ).toBeInTheDocument()
  })

  test('renders role request data when available', async () => {
    mockFetch({
      roleRequests: [
        {
          id: 'req-1',
          requested_role: 'Staff',
          created_at: '2026-01-01',
          users: {
            full_name: 'Test Admin',
            email: 'test@example.com',
            role: 'Patient',
          },
        },
      ],
    })

    render(<AdminDashboard />)

    expect(await screen.findByText('Test Admin')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()

    // Avoid duplicate issues
    expect(screen.getAllByText('Staff').length).toBeGreaterThan(0)

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })

  test('approves a role request', async () => {
    const user = userEvent.setup()

    global.fetch = jest.fn((url, options = {}) => {
      if (String(url).includes('/role-requests?')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify({
              requests: [
                {
                  id: 'req-1',
                  requested_role: 'Staff',
                  created_at: '2026-01-01',
                  users: {
                    full_name: 'Test Admin',
                    email: 'test@example.com',
                    role: 'Patient',
                  },
                },
              ],
            }),
        })
      }

      if (String(url).includes('/approve')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({}),
        })
      }

      return Promise.resolve({
        ok: true,
        text: async () => '{}',
      })
    })

    render(<AdminDashboard />)

    const approveBtn = await screen.findByRole('button', { name: 'Approve' })

    await user.click(approveBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/approve'),
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })

    expect(
      await screen.findByText('Role request approved.')
    ).toBeInTheDocument()
  })

  test('shows error message when API fails', async () => {
    mockFetch({ error: 'Failed to load role requests' })

    render(<AdminDashboard />)

    expect(
      await screen.findByText('Failed to load role requests')
    ).toBeInTheDocument()
  })
})