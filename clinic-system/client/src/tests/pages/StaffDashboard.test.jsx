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
  appointmentsOk = true,
  appointmentsError = 'Failed to load appointments.',
  joinOk = true,
  joinError = 'Failed to add patient to queue',
  createPatientOk = true,
  createPatientError = 'Failed to create patient.',
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
        ok: appointmentsOk,
        json: async () =>
          appointmentsOk ? { appointments } : { error: appointmentsError },
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
        ok: joinOk,
        json: async () => (joinOk ? {} : { error: joinError }),
      })
    }

    if (urlString.includes('/api/patients') && method === 'POST') {
      return Promise.resolve({
        ok: createPatientOk,
        json: async () =>
          createPatientOk
            ? {
                patient: {
                  id: 'new-patient-1',
                  full_name: 'New Patient',
                  email: 'new@example.com',
                  role: 'Patient',
                },
              }
            : { error: createPatientError },
      })
    }

    if (
      urlString.includes('/api/queue/') &&
      !urlString.includes('/completed-count') &&
      !urlString.includes('/join') &&
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

async function openSection(name) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name }))
  return user
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

  test('shows queue error state when queue fetch fails', async () => {
    setupFetchMock({
      queueOk: false,
      queueError: 'Queue failed to load.',
    })

    renderDashboard()

    expect(await screen.findByText('Queue failed to load.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
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

    await user.selectOptions(
      select,
      screen.getByRole('option', { name: /John Smith/i })
    )

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

  test('shows error toast when adding patient to queue fails', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      users: [
        {
          id: 'patient-2',
          full_name: 'John Smith',
          role: 'Patient',
        },
      ],
      joinOk: false,
      joinError: 'Patient already has an active queue entry',
    })

    renderDashboard()

    const select = await screen.findByLabelText('Select patient')

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /John Smith/i })).toBeInTheDocument()
    })

    await user.selectOptions(
      select,
      screen.getByRole('option', { name: /John Smith/i })
    )

    await user.click(screen.getByRole('button', { name: /add to queue/i }))

    expect(
      await screen.findByText('Patient already has an active queue entry')
    ).toBeInTheDocument()
  })

  test('opens add new patient popup', async () => {
    const user = userEvent.setup()

    setupFetchMock()
    renderDashboard()

    await user.click(screen.getByRole('button', { name: /\+ add new patient/i }))

    expect(await screen.findByText('Add New Patient')).toBeInTheDocument()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
  })

  test('shows validation errors when adding new patient with empty fields', async () => {
    const user = userEvent.setup()

    setupFetchMock()
    renderDashboard()

    await user.click(screen.getByRole('button', { name: /\+ add new patient/i }))
    await user.click(await screen.findByRole('button', { name: /^add patient$/i }))

    expect(await screen.findByText('Name is required.')).toBeInTheDocument()
    expect(screen.getByText('Email is required.')).toBeInTheDocument()
  })

  test('shows validation error for invalid new patient email', async () => {
    const user = userEvent.setup()

    setupFetchMock()
    renderDashboard()

    await user.click(screen.getByRole('button', { name: /\+ add new patient/i }))

    await user.type(await screen.findByLabelText(/full name/i), 'Test Patient')
    await user.type(screen.getByLabelText(/email address/i), 'bad-email')
    await user.click(screen.getByRole('button', { name: /^add patient$/i }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
  })

  test('creates a new patient from popup', async () => {
    const user = userEvent.setup()

    setupFetchMock()
    renderDashboard()

    await user.click(screen.getByRole('button', { name: /\+ add new patient/i }))

    await user.type(await screen.findByLabelText(/full name/i), 'New Patient')
    await user.type(screen.getByLabelText(/email address/i), 'new@example.com')
    await user.click(screen.getByRole('button', { name: /^add patient$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/patients'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            full_name: 'New Patient',
            email: 'new@example.com',
            created_by: 'staff-1',
          }),
        })
      )
    })

    expect(await screen.findByText('New Patient added as a new patient.')).toBeInTheDocument()
  })

  test('renders appointment date selector and empty appointments state', async () => {
    setupFetchMock({ appointments: [] })

    renderDashboard()
    await openSection(/appointments/i)

    expect(await screen.findByLabelText('Appointment date')).toBeInTheDocument()

    expect(
      await screen.findByText('No appointments found for this date.')
    ).toBeInTheDocument()
  })

  test('shows appointment error state when appointment fetch fails', async () => {
    setupFetchMock({
      appointmentsOk: false,
      appointmentsError: 'Appointments failed to load.',
    })

    renderDashboard()
    await openSection(/appointments/i)

    expect(await screen.findByText('Appointments failed to load.')).toBeInTheDocument()
  })

  expect(screen.queryByRole('button', { name: /reschedule/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
})

  test('navigates to booking page when adding appointment', async () => {
    const user = userEvent.setup()

    setupFetchMock()

    renderDashboard()

    await user.click(await screen.findByRole('button', { name: /appointments/i }))
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

  test('shows error toast when assigned clinic is not found for booking', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      clinics: [{ id: 'clinic-999', name: 'Other Clinic' }],
    })

    renderDashboard()

    await user.click(await screen.findByRole('button', { name: /appointments/i }))
    await user.click(await screen.findByRole('button', { name: /add appointment/i }))

    expect(await screen.findByText('Assigned clinic not found.')).toBeInTheDocument()
  })

  test('shows availability section', async () => {
    setupFetchMock()

    renderDashboard()
    await openSection(/availability/i)

    expect(
      await screen.findByRole('heading', { name: 'Availability' })
    ).toBeInTheDocument()
    
    expect(screen.getByText(/set the days and times/i)).toBeInTheDocument()
  })



