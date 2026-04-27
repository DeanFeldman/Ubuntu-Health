import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StaffDashboard from '../../pages/StaffDashboard'
import { useAuth } from '../../context/AuthContext'
import getApiBase from '../../lib/getApiBase'
import { useNavigate } from 'react-router-dom'

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../lib/getApiBase', () => jest.fn())

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}))

const mockNavigate = jest.fn()

const defaultClinic = {
  id: 'clinic-1',
  name: 'Hillbrow Clinic',
  operating_hours: {
    monday: { open: '08:00', close: '17:00' },
    tuesday: { open: '08:00', close: '17:00' },
    wednesday: { open: '08:00', close: '17:00' },
    thursday: { open: '08:00', close: '17:00' },
    friday: { open: '08:00', close: '17:00' },
    saturday: { open: '08:00', close: '12:00' },
    sunday: { open: '08:00', close: '12:00' },
  },
}

function renderDashboard(authOverride = {}) {
  useAuth.mockReturnValue({
    user: { id: 'staff-1', clinic_id: 'clinic-1' },
    clinicId: null,
    loading: false,
    ...authOverride,
  })

  return render(<StaffDashboard />)
}

function setupFetchMock({
  queue = [],
  users = [],
  appointments = [],
  completedCount = 0,
  clinics = [{ id: 'clinic-1', name: 'Hillbrow Clinic' }],
  clinicDetails = defaultClinic,
  queueOk = true,
  queueError = 'Failed to load queue.',
} = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    const urlString = String(url)
    const method = options.method || 'GET'

    if (urlString.includes('/completed-count')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ completedCount }),
      })
    }

    if (urlString.includes('/api/users')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ users }),
      })
    }

    if (urlString.includes('/api/appointments/clinic/') && method === 'GET') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ appointments }),
      })
    }

    if (urlString.includes('/api/clinics/clinic-1') && method === 'GET') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ clinic: clinicDetails }),
      })
    }

    if (urlString.endsWith('/api/clinics') && method === 'GET') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ clinics }),
      })
    }

    if (urlString.includes('/availability') && method === 'GET') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ availability: [] }),
      })
    }

    if (urlString.includes('/availability') && method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    }

    if (urlString.includes('/availability') && method === 'PATCH') {
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    }

    if (urlString.includes('/join') && method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    }

    if (
      urlString.includes('/api/queue/') &&
      !urlString.includes('/completed-count') &&
      method === 'GET'
    ) {
      return Promise.resolve({
        ok: queueOk,
        json: async () => (queueOk ? { queue } : { error: queueError }),
      })
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    })
  })
}

describe('StaffDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getApiBase.mockReturnValue('http://localhost:8080')
    useNavigate.mockReturnValue(mockNavigate)
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('shows error when no clinic is linked', async () => {
    setupFetchMock()

    renderDashboard({
      user: { id: 'staff-1', clinic_id: null },
      clinicId: null,
    })

    expect(
      await screen.findByText('No clinic is linked to this staff account.')
    ).toBeInTheDocument()
  })

  test('shows empty queue state', async () => {
    setupFetchMock({ queue: [] })

    renderDashboard()

    expect(
      await screen.findByText('No patients in queue right now.')
    ).toBeInTheDocument()
  })

  test('renders queue patient details', async () => {
    setupFetchMock({
      queue: [
        {
          id: 'entry-1',
          patient_id: 'patient-1',
          status: 'Waiting',
          position: 1,
          patient: {
            full_name: 'Jane Doe',
            email: 'jane@example.com',
          },
        },
      ],
      completedCount: 2,
    })

    renderDashboard()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('Waiting').length).toBeGreaterThan(0)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  test('adds selected patient to queue', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      users: [
        {
          id: 'patient-2',
          full_name: 'John Smith',
          role: 'Patient',
        },
      ],
    })

    renderDashboard()

    const select = await screen.findByLabelText('Select patient')

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /John Smith/i })).toBeInTheDocument()
    })

    await user.selectOptions(select, 'patient-2')
    await user.click(screen.getByRole('button', { name: /add to queue/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/join'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            patient_id: 'patient-2',
            confirmed: true,
          }),
        })
      )
    })

    expect(await screen.findByText('Patient added to queue.')).toBeInTheDocument()
  })

  test('renders appointment date selector and empty appointments state', async () => {
    setupFetchMock({ appointments: [] })

    renderDashboard()

    expect(await screen.findByLabelText('Appointment date')).toBeInTheDocument()

    expect(
      await screen.findByText('No appointments found for this date.')
    ).toBeInTheDocument()
  })

  test('renders clinic appointments for selected date', async () => {
    setupFetchMock({
      appointments: [
        {
          id: 'appointment-1',
          slot_datetime: '2026-04-26T09:30:00',
          status: 'Confirmed',
          patient: {
            full_name: 'Thabo Mokoena',
            email: 'thabo@example.com',
          },
        },
      ],
    })

    renderDashboard()

    expect(await screen.findByText('Thabo Mokoena')).toBeInTheDocument()
    expect(screen.getByText('thabo@example.com')).toBeInTheDocument()
    expect(screen.getByText('09:30')).toBeInTheDocument()
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0)
  })

  test('navigates to booking page when adding appointment', async () => {
    const user = userEvent.setup()

    setupFetchMock()

    renderDashboard()

    await user.click(await screen.findByRole('button', { name: /add appointment/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/booking', {
        state: {
          clinic: { id: 'clinic-1', name: 'Hillbrow Clinic' },
          bookingMode: 'staff',
        },
      })
    })
  })

test('shows availability section', async () => {
  setupFetchMock()

  renderDashboard()

  expect(await screen.findByText('Availability')).toBeInTheDocument()
  expect(screen.getByText(/set the days and times/i)).toBeInTheDocument()
})
})