import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StaffDashboard from '../../pages/StaffDashboard'
import { useAuth } from '../../context/AuthContext'

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../lib/getApiBase', () => jest.fn(() => 'http://localhost:8080'))

/**
 * Render helper with a safe default auth state.
 * Individual tests can override only what they need.
 */
function renderDashboard(authOverride = {}) {
  useAuth.mockReturnValue({
    user: { id: 'staff-1', clinic_id: 'clinic-1' },
    clinicId: null,
    loading: false,
    ...authOverride,
  })

  return render(<StaffDashboard />)
}

/**
 * Safe default fetch mock for dashboard startup calls.
 * Covers:
 * - queue fetch
 * - completed count fetch
 * - users fetch
 */
function safeFetchMock({
  queue = [],
  users = [],
  completedCount = 0,
} = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    // Completed count endpoint
    if (String(url).includes('/completed-count')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ completedCount }),
      })
    }

    // Users endpoint
    if (String(url).includes('/api/users')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ users }),
      })
    }

    // Queue fetch endpoint
    if (
      String(url).includes('/api/queue/') &&
      !String(url).includes('/completed-count') &&
      !String(url).includes('/status') &&
      options.method !== 'POST' &&
      options.method !== 'DELETE'
    ) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ queue }),
      })
    }

    // Safe fallback for anything else
    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    })
  })
}

describe('StaffDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // test('shows error when no clinic is linked', async () => {
  //   /**
  //    * High-level test:
  //    * If no clinic is linked to the staff account,
  //    * the dashboard should show a safe error message.
  //    */
  //   safeFetchMock()

  //   renderDashboard({
  //     user: { id: 'staff-1', clinic_id: null },
  //     clinicId: null,
  //   })

  //   expect(
  //     await screen.findByText('No clinic is linked to this staff account.')
  //   ).toBeInTheDocument()
  // })

  // test('shows empty state when queue is empty', async () => {
  //   /**
  //    * High-level test:
  //    * Successful load, but no queue entries yet.
  //    */
  //   safeFetchMock({ queue: [] })

  //   renderDashboard()

  //   expect(
  //     await screen.findByText('No patients in queue right now.')
  //   ).toBeInTheDocument()
  // })

  test('renders queue data when available', async () => {
    /**
     * High-level happy path:
     * Dashboard shows loaded queue data and patient details.
     */
    safeFetchMock({
      queue: [
        {
          id: 'entry-1',
          status: 'Waiting',
          position: 1,
          patient: {
            full_name: 'Jane Doe',
            email: 'jane@example.com',
          },
        },
      ],
      users: [
        {
          id: 'patient-1',
          full_name: 'Jane Doe',
          role: 'Patient',
        },
      ],
      completedCount: 0,
    })

    renderDashboard()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('Waiting').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('table', { name: 'Patient queue' })
    ).toBeInTheDocument()
  })

  test('adds a patient to queue', async () => {
    /**
     * High-level interaction test:
     * User selects a patient and submits the add-to-queue action.
     * We verify the POST request and success feedback.
     */
    const user = userEvent.setup()

    global.fetch = jest.fn((url, options = {}) => {
      // Users dropdown data
      if (String(url).includes('/api/users')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            users: [
              { id: 'patient-2', full_name: 'John Smith', role: 'Patient' },
            ],
          }),
        })
      }

      // Completed count
      if (String(url).includes('/completed-count')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ completedCount: 0 }),
        })
      }

      // Add-to-queue POST
      if (String(url).includes('/join') && options.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        })
      }

      // Normal queue fetch
      if (
        String(url).includes('/api/queue/') &&
        !String(url).includes('/completed-count') &&
        options.method !== 'POST'
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ queue: [] }),
        })
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    })

    renderDashboard()

    const select = await screen.findByLabelText('Select patient')

    // Wait for the patient option to load before selecting it
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /John Smith/i })).toBeInTheDocument()
    })

    await user.selectOptions(select, 'patient-2')
    await user.click(screen.getByRole('button', { name: 'Add to queue' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/join'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
          body: JSON.stringify({
            patient_id: 'patient-2',
            confirmed: true,
          }),
        })
      )
    })

    expect(
      await screen.findByText('Patient added to queue.')
    ).toBeInTheDocument()
  })
})