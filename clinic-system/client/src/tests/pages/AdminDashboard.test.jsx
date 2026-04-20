import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminDashboard from '../../pages/AdminDashboard'
import { useAuth } from '../../context/AuthContext'
import getApiBase from '../../lib/getApiBase'

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../lib/getApiBase', () => jest.fn())

function mockFetch({
  roleRequests = [],
  clinicRequests = [],
  roleError = null,
  clinicError = null,
} = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    if (String(url).includes('/role-requests') && !String(url).includes('/approve') && !String(url).includes('/reject')) {
      if (roleError) {
        return Promise.resolve({
          ok: false,
          text: async () => JSON.stringify({ error: roleError }),
        })
      }

      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ requests: roleRequests }),
      })
    }

    if (String(url).includes('/clinic-requests')) {
      if (clinicError) {
        return Promise.resolve({
          ok: false,
          text: async () => JSON.stringify({ error: clinicError }),
        })
      }

      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ requests: clinicRequests }),
      })
    }

    return Promise.resolve({
      ok: true,
      text: async () => JSON.stringify({}),
    })
  })
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    useAuth.mockReturnValue({
      user: { id: 'admin-1' },
    })

    getApiBase.mockReturnValue('http://localhost:8080')

    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('shows loading state initially', () => {
    mockFetch()

    render(<AdminDashboard />)

    expect(screen.getByText('Loading role requests...')).toBeInTheDocument()
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
    expect(screen.getByText('Patient')).toBeInTheDocument()
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

      if (String(url).includes('/clinic-requests')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ requests: [] }),
        })
      }

      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({}),
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

  test('rejects a role request', async () => {
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

      if (String(url).includes('/reject')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({}),
        })
      }

      if (String(url).includes('/clinic-requests')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ requests: [] }),
        })
      }

      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({}),
      })
    })

    render(<AdminDashboard />)

    const rejectBtn = await screen.findByRole('button', { name: 'Reject' })
    await user.click(rejectBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/reject'),
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })

    expect(
      await screen.findByText('Role request rejected.')
    ).toBeInTheDocument()
  })

  test('shows error message when role requests API fails', async () => {
    mockFetch({ roleError: 'Failed to load role requests' })

    render(<AdminDashboard />)

    expect(
      await screen.findByText('Failed to load role requests')
    ).toBeInTheDocument()
  })
})