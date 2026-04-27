import { render, screen, waitFor } from '@testing-library/react'
import PatientAppointments from '../../pages/PatientAppointments'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    dbUser: { id: 'test-patient-id' },
  }),
}))

jest.mock('../../lib/getApiBase', () => () => 'http://localhost:5000')

global.fetch = jest.fn()

describe('PatientAppointments', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows empty state when no appointments exist', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appointments: [] }),
    })

    render(<PatientAppointments />)

    await waitFor(() => {
      expect(screen.getByText('No upcoming appointments')).toBeInTheDocument()
    })

    expect(screen.getByText(/book an appointment at a clinic/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /browse clinics/i })).toBeInTheDocument()
  })

  it('renders appointment details correctly', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        appointments: [
          {
            id: 'appointment-1',
            clinic_name: 'Ubuntu Clinic',
            status: 'Confirmed',
            slot_datetime: '2026-01-01T10:00:00Z',
          },
        ],
      }),
    })

    render(<PatientAppointments />)

    await waitFor(() => {
      expect(screen.getAllByText('Ubuntu Clinic').length).toBeGreaterThan(0)
    })

    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0)
    expect(screen.getByText('Clinic')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getAllByText('Time').length).toBeGreaterThan(0)
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('shows an error message when appointments fail to load', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to load test appointments' }),
    })

    render(<PatientAppointments />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to load test appointments'
      )
    })
  })
})