import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PatientDashboard from '../../pages/PatientDashboard'
import { useAuth } from '../../context/AuthContext'

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

/**
 * Safe fetch mock for the clinics endpoint.
 * Keeps tests high level and avoids brittle implementation details.
 */
function mockFetch({ clinics = [], error = null } = {}) {
  global.fetch = jest.fn(() => {
    if (error) {
      return Promise.resolve({
        ok: false,
        status: 500,
      })
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({ clinics }),
    })
  })
}

describe('PatientDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    useAuth.mockReturnValue({
      user: { id: 'patient-1' },
      loading: false,
    })

    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('shows loading state initially', async () => {
    /**
     * Verifies the dashboard shows a loading message
     * while clinics are being fetched.
     */
    mockFetch({ clinics: [] })

    render(<PatientDashboard />)

    expect(await screen.findByText('Loading clinics…')).toBeInTheDocument()
  })

  test('shows empty state when no clinics match', async () => {
    /**
     * Verifies the empty state when no clinics are returned.
     */
    mockFetch({ clinics: [] })

    render(<PatientDashboard />)

    await waitFor(() => {
      expect(
        screen.getByText('No clinics match your search. Try adjusting your filters.')
      ).toBeInTheDocument()
    })
  })

  test('renders clinic data when available', async () => {
    /**
     * High-level happy path:
     * clinics load and the main clinic action appears.
     */
    mockFetch({
      clinics: [
        {
          id: 'clinic-1',
          name: 'Test Clinic',
          municipality: 'Cape Town',
          district: 'Metro',
          province: 'Western Cape',
          facility_type: 'Clinic',
          address: '123 Main Road',
          services: ['General Care'],
        },
      ],
    })

    render(<PatientDashboard />)

    expect(await screen.findByText('Test Clinic')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Join queue at Test Clinic/i })
    ).toBeInTheDocument()
  })

  test('navigates to queue when join button is clicked', async () => {
    /**
     * Verifies the main action:
     * clicking Join Queue navigates to the queue page
     * with the selected clinic in route state.
     */
    const user = userEvent.setup()

    mockFetch({
      clinics: [
        {
          id: 'clinic-1',
          name: 'Test Clinic',
          municipality: 'Cape Town',
          district: 'Metro',
          province: 'Western Cape',
          facility_type: 'Clinic',
        },
      ],
    })

    render(<PatientDashboard />)

    const button = await screen.findByRole('button', {
      name: /Join queue at Test Clinic/i,
    })

    await user.click(button)

    expect(mockNavigate).toHaveBeenCalledWith('/queue', {
      state: {
        clinic: expect.objectContaining({
          id: 'clinic-1',
          name: 'Test Clinic',
        }),
      },
    })
  })

  test('shows error message when clinic fetch fails', async () => {
    /**
     * Verifies the dashboard shows an error message
     * when the clinic API request fails.
     */
    mockFetch({ error: true })

    render(<PatientDashboard />)

    expect(
      await screen.findByText(/Failed to load clinics/i)
    ).toBeInTheDocument()
  })
})