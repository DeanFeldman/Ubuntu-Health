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
  completedCount = 0,
  clinicDetails = {
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
  },
  clinics = [{ id: 'clinic-1', name: 'Hillbrow Clinic' }],
  appointments = [],
  availability = [],
  queueOk = true,
  queueError = 'Failed to load queue.',
  joinOk = true,
  joinError = 'Failed to add patient to queue',
  clinicsOk = true,
  clinicsError = 'Failed to load clinic.',
  availabilityOk = true,
  availabilityError = 'Failed to load availability.',
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
        ok: clinicsOk,
        json: async () =>
          clinicsOk ? { clinics } : { error: clinicsError },
      })
    }

    if (urlString.includes('/availability') && method === 'GET') {
      return Promise.resolve({
        ok: availabilityOk,
        json: async () =>
          availabilityOk ? { availability } : { error: availabilityError },
      })
    }

    if (
      urlString.includes('/api/queue/') &&
      !urlString.includes('/completed-count') &&
      !urlString.includes('/status') &&
      !urlString.includes('/entry/') &&
      !urlString.includes('/join') &&
      method === 'GET'
    ) {
      return Promise.resolve({
        ok: queueOk,
        json: async () => (queueOk ? { queue } : { error: queueError }),
      })
    }

    if (urlString.includes('/join') && method === 'POST') {
      return Promise.resolve({
        ok: joinOk,
        json: async () => (joinOk ? {} : { error: joinError }),
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

  test('shows empty state when queue is empty', async () => {
    setupFetchMock({ queue: [] })

    renderDashboard()

    expect(
      await screen.findByText('No patients in queue right now.')
    ).toBeInTheDocument()
  })

  test('renders queue data when available', async () => {
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
      users: [
        {
          id: 'patient-1',
          full_name: 'Jane Doe',
          role: 'Patient',
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

  test('adds a patient to the queue', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      queue: [],
      users: [
        { id: 'patient-2', full_name: 'John Smith', role: 'Patient' },
      ],
    })

    renderDashboard()

    const select = await screen.findByLabelText('Select patient')

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: /John Smith/i })
      ).toBeInTheDocument()
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

    expect(await screen.findByText('Patient added to queue.')).toBeInTheDocument()
  })

  test('navigates to booking page when clinic is found', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      clinics: [{ id: 'clinic-1', name: 'Hillbrow Clinic' }],
    })

    renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Add appointment' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/booking', {
        state: {
          clinic: { id: 'clinic-1', name: 'Hillbrow Clinic' },
        },
      })
    })
  })

  test('shows error toast when assigned clinic is not found for booking', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      clinics: [{ id: 'clinic-999', name: 'Other Clinic' }],
    })

    renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Add appointment' }))

    expect(await screen.findByText('Assigned clinic not found.')).toBeInTheDocument()
  })

  test('renders appointment date selector and empty appointment state', async () => {
    setupFetchMock({ appointments: [] })

    renderDashboard()

    expect(await screen.findByLabelText('Appointment date')).toBeInTheDocument()
    expect(
      await screen.findByText('No appointments found for this date.')
    ).toBeInTheDocument()
  })

  test('renders appointments for the selected date', async () => {
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
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
  })

  test('shows validation error when availability times are invalid', async () => {
    const user = userEvent.setup()

    setupFetchMock()

    renderDashboard()

    await waitFor(() => {
      expect(screen.queryByText('Loading availability…')).not.toBeInTheDocument()
    })

    const checkboxes = await screen.findAllByRole('checkbox')
    await user.click(checkboxes[0])

    const startInput = await screen.findByLabelText('Monday start time')
    const endInput = await screen.findByLabelText('Monday end time')

    await user.clear(startInput)
    await user.type(startInput, '18:00')

    await user.clear(endInput)
    await user.type(endInput, '09:00')

    await user.click(screen.getByRole('button', { name: /save availability/i }))

    expect(
      await screen.findByText('Please fix availability errors first.')
    ).toBeInTheDocument()
  })

  test('handles empty availability state without crashing', async () => {
  setupFetchMock({ availability: [] })

  renderDashboard()

  expect(await screen.findByText('Availability')).toBeInTheDocument()

  // wait until loading disappears
  await waitFor(() => {
    expect(screen.queryByText('Loading availability…')).not.toBeInTheDocument()
  })

  // now the grid (and button) exist
  expect(
    await screen.findByRole('button', { name: /save availability/i })
  ).toBeInTheDocument()
})
})