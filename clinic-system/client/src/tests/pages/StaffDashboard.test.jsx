import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  facility_type: 'Clinic',
  municipality: 'Region F',
  district: 'Johannesburg',
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

const activeAppointment = {
  id: 'appointment-1',
  patient_id: 'patient-1',
  clinic_id: 'clinic-1',
  slot_id: 'slot-1',
  status: 'Confirmed',
  slot_datetime: '2099-05-11T10:00:00Z',
  patient: {
    full_name: 'Jane Appointment',
    email: 'jane.appointment@example.com',
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
  appointmentStatusOk = true,
  appointmentStatusError = 'Could not update appointment status.',
  slots = ['09:00', '09:15'],
  slotsOk = true,
  slotsError = 'Failed to load slots.',
  rescheduleOk = true,
  rescheduleError = 'Could not reschedule appointment.',
  joinOk = true,
  joinError = 'Failed to add patient to queue',
  createPatientOk = true,
  createPatientError = 'Failed to create patient.',
  cancelOk = true,
  cancelError = 'Could not cancel appointment.',
  autoNoShowsOk = true,
  autoNoShowsUpdatedCount = 0,
  autoNoShowsError = 'Failed to auto-mark no-shows.',
  queueStatusOk = true,
  queueStatusError = 'Could not update status.',
  removeQueueOk = true,
  removeQueueError = 'Could not remove patient.',
  availabilityRows = [],
  availabilityOk = true,
  availabilityError = 'Failed to load availability.',
  availabilitySaveOk = true,
  availabilitySaveError = 'Failed to save availability.',
  clinicDetailsOk = true,
  clinicDetailsError = 'Failed to load clinic details.',
  clinicsOk = true,
  clinicsError = 'Failed to load clinic.',
  usersOk = true,
  usersError = 'Failed to load patients.',
  completedCountOk = true,
  completedCountError = 'Failed to load completed count.',
} = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    const urlString = String(url)
    const method = options.method || 'GET'

    if (
      urlString.includes('/api/appointments/auto-no-shows/') &&
      method === 'PATCH'
    ) {
      return Promise.resolve({
        ok: autoNoShowsOk,
        json: async () =>
          autoNoShowsOk
            ? {
                message:
                  autoNoShowsUpdatedCount > 0
                    ? `${autoNoShowsUpdatedCount} appointment(s) marked as No-show`
                    : 'No missed appointments found',
                updatedCount: autoNoShowsUpdatedCount,
                appointments: [],
              }
            : { error: autoNoShowsError },
      })
    }

    if (urlString.includes('/completed-count')) {
      return Promise.resolve({
        ok: completedCountOk,
        json: async () =>
          completedCountOk
            ? { completedCount }
            : { error: completedCountError },
      })
    }

    if (
      urlString.includes('/api/queue/') &&
      urlString.includes('/status') &&
      method === 'PATCH'
    ) {
      const body = JSON.parse(options.body)

      return Promise.resolve({
        ok: queueStatusOk,
        json: async () =>
          queueStatusOk
            ? {
                entry: {
                  id: 'entry-1',
                  patient_id: 'patient-1',
                  status: body.status,
                  position: 1,
                  patient: {
                    full_name: 'Jane Doe',
                    email: 'jane@example.com',
                  },
                },
              }
            : { error: queueStatusError },
      })
    }

    if (
      urlString.includes('/api/queue/') &&
      urlString.includes('/entry/') &&
      method === 'DELETE'
    ) {
      return Promise.resolve({
        ok: removeQueueOk,
        json: async () =>
          removeQueueOk
            ? { message: 'Patient removed from queue' }
            : { error: removeQueueError },
      })
    }

    if (urlString.includes('/api/users')) {
      return Promise.resolve({
        ok: usersOk,
        json: async () => (usersOk ? { users } : { error: usersError }),
      })
    }

    if (
      urlString.includes('/api/appointments/') &&
      urlString.includes('/status') &&
      method === 'PATCH'
    ) {
      const body = JSON.parse(options.body)

      return Promise.resolve({
        ok: appointmentStatusOk,
        json: async () =>
          appointmentStatusOk
            ? {
                message: `Appointment marked as ${body.status}.`,
                appointment: {
                  ...activeAppointment,
                  status: body.status,
                },
              }
            : { error: appointmentStatusError },
      })
    }

    if (urlString.includes('/api/appointments/clinic/') && method === 'GET') {
      return Promise.resolve({
        ok: appointmentsOk,
        json: async () =>
          appointmentsOk ? { appointments } : { error: appointmentsError },
      })
    }

    if (urlString.includes('/api/appointments/slots') && method === 'GET') {
      return Promise.resolve({
        ok: slotsOk,
        json: async () => (slotsOk ? slots : { error: slotsError }),
      })
    }

    if (
      urlString.includes('/api/appointments/') &&
      urlString.includes('/reschedule') &&
      method === 'PATCH'
    ) {
      return Promise.resolve({
        ok: rescheduleOk,
        json: async () =>
          rescheduleOk
            ? {
                success: true,
                message: 'Appointment rescheduled successfully',
                appointment: {},
              }
            : { error: rescheduleError },
      })
    }

    if (urlString.includes('/api/clinics/clinic-1') && method === 'GET') {
      return Promise.resolve({
        ok: clinicDetailsOk,
        json: async () =>
          clinicDetailsOk
            ? { clinic: clinicDetails }
            : { error: clinicDetailsError },
      })
    }

    if (urlString.endsWith('/api/clinics') && method === 'GET') {
      return Promise.resolve({
        ok: clinicsOk,
        json: async () => (clinicsOk ? { clinics } : { error: clinicsError }),
      })
    }

    if (urlString.includes('/availability') && method === 'GET') {
      return Promise.resolve({
        ok: availabilityOk,
        json: async () =>
          availabilityOk
            ? { availability: availabilityRows }
            : { error: availabilityError },
      })
    }

    if (urlString.includes('/availability') && method === 'POST') {
      return Promise.resolve({
        ok: availabilitySaveOk,
        json: async () =>
          availabilitySaveOk ? {} : { error: availabilitySaveError },
      })
    }

    if (urlString.includes('/availability') && method === 'PATCH') {
      return Promise.resolve({
        ok: availabilitySaveOk,
        json: async () =>
          availabilitySaveOk ? {} : { error: availabilitySaveError },
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

    if (
      urlString.includes('/api/appointments/') &&
      urlString.includes('/cancel') &&
      method === 'PATCH'
    ) {
      return Promise.resolve({
        ok: cancelOk,
        json: async () =>
          cancelOk
            ? {
                message: 'Appointment cancelled successfully',
                appointment: {
                  ...activeAppointment,
                  status: 'Cancelled',
                },
              }
            : { error: cancelError },
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

  test('shows assigned clinic details in clinic section', async () => {
    setupFetchMock()

    renderDashboard()
    await openSection(/clinic/i)

    expect(await screen.findByText('Assigned clinic')).toBeInTheDocument()
    expect(screen.getByText('Hillbrow Clinic')).toBeInTheDocument()
    expect(screen.getByText(/Clinic • Region F • Johannesburg/i)).toBeInTheDocument()
  })

  test('shows clinic details fetch error as toast', async () => {
    setupFetchMock({
      clinicDetailsOk: false,
      clinicDetailsError: 'Clinic details are unavailable.',
    })

    renderDashboard()

    expect(await screen.findByText('Clinic details are unavailable.')).toBeInTheDocument()
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

  test('auto-marks missed appointments as no-show on dashboard load', async () => {
    setupFetchMock({
      autoNoShowsUpdatedCount: 2,
    })

    renderDashboard()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/appointments/auto-no-shows/clinic-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { Accept: 'application/json' },
        })
      )
    })

    expect(
      await screen.findByText('2 missed appointment(s) marked as No-show.')
    ).toBeInTheDocument()
  })

  test('does not show auto no-show toast when no appointments were updated', async () => {
    setupFetchMock({
      autoNoShowsUpdatedCount: 0,
    })

    renderDashboard()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/appointments/auto-no-shows/clinic-1',
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })

    expect(
      screen.queryByText(/missed appointment\(s\) marked as No-show/i)
    ).not.toBeInTheDocument()
  })

  test('handles auto no-show failure without blocking dashboard load', async () => {
    setupFetchMock({
      autoNoShowsOk: false,
      autoNoShowsError: 'Auto no-show failed.',
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
    })

    renderDashboard()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Failed to auto-mark no-shows:',
        'Auto no-show failed.'
      )
    })
  })

  test('logs completed count fetch failure without blocking queue', async () => {
    setupFetchMock({
      completedCountOk: false,
      completedCountError: 'Completed count failed.',
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
    })

    renderDashboard()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch completed count:',
        'Completed count failed.'
      )
    })
  })

  test('logs patient fetch failure without blocking dashboard', async () => {
    setupFetchMock({
      usersOk: false,
      usersError: 'Patients failed to load.',
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
    })

    renderDashboard()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch patients:',
        'Patients failed to load.'
      )
    })
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

  test('displays appointment time for queued patient with matching appointment', async () => {
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
      appointments: [
        {
          ...activeAppointment,
          patient_id: 'patient-1',
          slot_datetime: '2099-05-11T10:00:00Z',
          status: 'Confirmed',
        },
      ],
    })

    renderDashboard()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Appt. Time')).toBeInTheDocument()
    expect(await screen.findByText(/10:00/)).toBeInTheDocument()
    expect(screen.queryByText('Walk-in')).not.toBeInTheDocument()
  })

  test('displays Walk-in when queued patient has no matching appointment', async () => {
    setupFetchMock({
      queue: [
        {
          id: 'entry-1',
          patient_id: 'walk-in-patient',
          status: 'Waiting',
          position: 1,
          patient: {
            full_name: 'Walk In Patient',
            email: 'walkin@example.com',
          },
        },
      ],
      appointments: [
        {
          ...activeAppointment,
          patient_id: 'different-patient',
          slot_datetime: '2099-05-11T10:00:00Z',
          status: 'Confirmed',
        },
      ],
    })

    renderDashboard()

    expect(await screen.findByText('Walk In Patient')).toBeInTheDocument()
    expect(screen.getByText('Appt. Time')).toBeInTheDocument()
    expect(screen.getByText('Walk-in')).toBeInTheDocument()
    expect(screen.queryByText(/10:00/)).not.toBeInTheDocument()
  })

  test('displays Walk-in when matching appointment is finalised', async () => {
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
      appointments: [
        {
          ...activeAppointment,
          patient_id: 'patient-1',
          slot_datetime: '2099-05-11T10:00:00Z',
          status: 'No-show',
        },
      ],
    })

    renderDashboard()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Walk-in')).toBeInTheDocument()
    expect(screen.queryByText(/10:00/)).not.toBeInTheDocument()
  })

  test('moves queue patient to next status', async () => {
    const user = userEvent.setup()

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
    })

    renderDashboard()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next status/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/queue/clinic-1/entry/entry-1/status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'In Consultation' }),
        })
      )
    })

    expect(await screen.findByText('Jane Doe marked as In Consultation.')).toBeInTheDocument()
  })

  test('shows queue status update error when backend rejects next status', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      queueStatusOk: false,
      queueStatusError: 'Invalid queue transition',
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
    })

    renderDashboard()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next status/i }))

    expect(await screen.findByText('Invalid queue transition')).toBeInTheDocument()
  })

  test('removes patient from queue', async () => {
    const user = userEvent.setup()

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
    })

    renderDashboard()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^remove$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/queue/clinic-1/entry/entry-1',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })

    expect(await screen.findByText('Jane Doe removed from the queue.')).toBeInTheDocument()
  })

  test('shows remove queue error when backend rejects removal', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      removeQueueOk: false,
      removeQueueError: 'Cannot remove patient now',
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
    })

    renderDashboard()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^remove$/i }))

    expect(await screen.findByText('Cannot remove patient now')).toBeInTheDocument()
  })

  test('does not show next status button for complete queue entry', async () => {
    setupFetchMock({
      queue: [
        {
          id: 'entry-1',
          patient_id: 'patient-1',
          status: 'Complete',
          position: 1,
          patient: {
            full_name: 'Jane Doe',
            email: 'jane@example.com',
          },
        },
      ],
    })

    renderDashboard()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next status/i })).not.toBeInTheDocument()
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

  test('closes add patient popup when clicking overlay', async () => {
    const user = userEvent.setup()

    setupFetchMock()
    renderDashboard()

    await user.click(screen.getByRole('button', { name: /\+ add new patient/i }))

    const dialog = await screen.findByRole('dialog', { name: /add new patient/i })

    fireEvent.click(dialog)

    expect(screen.queryByRole('dialog', { name: /add new patient/i }))
      .not.toBeInTheDocument()
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

  test('shows backend error when creating new patient fails', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      createPatientOk: false,
      createPatientError: 'Email already exists.',
    })

    renderDashboard()

    await user.click(screen.getByRole('button', { name: /\+ add new patient/i }))

    await user.type(await screen.findByLabelText(/full name/i), 'New Patient')
    await user.type(screen.getByLabelText(/email address/i), 'new@example.com')
    await user.click(screen.getByRole('button', { name: /^add patient$/i }))

    expect(await screen.findByText(/Email already exists/i)).toBeInTheDocument()
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

  describe('staff reschedule flow', () => {
    test('opens popup with current appointment details', async () => {
      const user = userEvent.setup()

      setupFetchMock({
        appointments: [activeAppointment],
        slots: ['09:00', '09:15'],
      })

      renderDashboard()
      await openSection(/appointments/i)

      expect(await screen.findByText('Jane Appointment')).toBeInTheDocument()
      expect(screen.getByText('jane.appointment@example.com')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /reschedule/i }))

      const dialog = await screen.findByRole('dialog', {
        name: /reschedule appointment/i,
      })

      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveTextContent('Choose a new date and time for Jane Appointment.')
      expect(screen.getByLabelText(/new date/i)).toHaveValue('2099-05-11')
      expect(await screen.findByRole('button', { name: '9:15 AM' })).toBeInTheDocument()
    })

    test('fetches slots and does not refetch when selecting a time', async () => {
      const user = userEvent.setup()

      setupFetchMock({
        appointments: [activeAppointment],
        slots: ['09:00', '09:15'],
      })

      renderDashboard()
      await openSection(/appointments/i)

      await user.click(await screen.findByRole('button', { name: /reschedule/i }))

      const slotButton = await screen.findByRole('button', { name: '9:15 AM' })

      await waitFor(() => {
        expect(
          global.fetch.mock.calls.filter(([url]) =>
            String(url).includes('/api/appointments/slots')
          )
        ).toHaveLength(1)
      })

      await user.click(slotButton)

      expect(slotButton).toHaveAttribute('aria-pressed', 'true')
      expect(
        global.fetch.mock.calls.filter(([url]) =>
          String(url).includes('/api/appointments/slots')
        )
      ).toHaveLength(1)
    })

    test('hides the current appointment time on the current appointment date', async () => {
      const user = userEvent.setup()

      setupFetchMock({
        appointments: [activeAppointment],
        slots: ['12:00', '12:15'],
      })

      renderDashboard()
      await openSection(/appointments/i)

      await user.click(await screen.findByRole('button', { name: /reschedule/i }))

      expect(await screen.findByRole('button', { name: '12:15 PM' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '12:00 PM' })).not.toBeInTheDocument()
    })

    test('displays the same clock time on a different date', async () => {
      const user = userEvent.setup()

      setupFetchMock({
        appointments: [activeAppointment],
        slots: ['12:00', '12:15'],
      })

      renderDashboard()
      await openSection(/appointments/i)

      await user.click(await screen.findByRole('button', { name: /reschedule/i }))

      expect(await screen.findByRole('button', { name: '12:15 PM' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '12:00 PM' })).not.toBeInTheDocument()

      fireEvent.change(screen.getByLabelText(/new date/i), {
        target: { value: '2099-05-12' },
      })

      expect(await screen.findByRole('button', { name: '12:00 PM' })).toBeInTheDocument()
    })

    test('shows reschedule slot loading error in modal', async () => {
      const user = userEvent.setup()

      setupFetchMock({
        appointments: [activeAppointment],
        slotsOk: false,
        slotsError: 'Reschedule slots failed.',
      })

      renderDashboard()
      await openSection(/appointments/i)

      expect(await screen.findByText('Jane Appointment')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /reschedule/i }))

      expect(await screen.findByText('Reschedule slots failed.')).toBeInTheDocument()
    })

    test('clears selected time when date changes', async () => {
      const user = userEvent.setup()

      setupFetchMock({
        appointments: [activeAppointment],
        slots: ['09:00', '09:15'],
      })

      renderDashboard()
      await openSection(/appointments/i)

      await user.click(await screen.findByRole('button', { name: /reschedule/i }))

      const slotButton = await screen.findByRole('button', { name: '9:15 AM' })
      await user.click(slotButton)

      expect(slotButton).toHaveAttribute('aria-pressed', 'true')

      fireEvent.change(screen.getByLabelText(/new date/i), {
        target: { value: '2099-05-12' },
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm reschedule/i })).toBeDisabled()
      })
    })

    test('sends PATCH and refreshes appointments on success', async () => {
      const user = userEvent.setup()

      setupFetchMock({
        appointments: [activeAppointment],
        slots: ['09:00', '09:15'],
      })

      renderDashboard()
      await openSection(/appointments/i)

      await user.click(await screen.findByRole('button', { name: /reschedule/i }))
      await user.click(await screen.findByRole('button', { name: '9:15 AM' }))
      await user.click(screen.getByRole('button', { name: /confirm reschedule/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:8080/api/appointments/appointment-1/reschedule',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({
              date: '2099-05-11',
              time: '09:15',
            }),
          })
        )
      })

      expect(await screen.findByText('Appointment rescheduled successfully')).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: /reschedule appointment/i }))
        .not.toBeInTheDocument()
    })

    test('displays backend errors in the modal', async () => {
      const user = userEvent.setup()

      setupFetchMock({
        appointments: [activeAppointment],
        slots: ['09:00'],
        rescheduleOk: false,
        rescheduleError: 'This slot is already booked',
      })

      renderDashboard()
      await openSection(/appointments/i)

      await user.click(await screen.findByRole('button', { name: /reschedule/i }))
      await user.click(await screen.findByRole('button', { name: '9:00 AM' }))
      await user.click(screen.getByRole('button', { name: /confirm reschedule/i }))

      expect(await screen.findByText(/This slot is already booked/)).toBeInTheDocument()
      expect(screen.getByRole('dialog', { name: /reschedule appointment/i })).toBeInTheDocument()
    })
  })

  test('navigates to booking page when adding appointment', async () => {
    const user = userEvent.setup()

    setupFetchMock()

    renderDashboard()

    await user.click(await screen.findByRole('button', { name: /appointments/i }))
    await user.click(await screen.findByRole('button', { name: /add appointment/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/booking', {
        state: expect.objectContaining({
          clinic: { id: 'clinic-1', name: 'Hillbrow Clinic' },
          bookingMode: 'staff',
        }),
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

  test('shows booking error when clinic list request fails', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      clinicsOk: false,
      clinicsError: 'Clinic list failed.',
    })

    renderDashboard()

    await user.click(await screen.findByRole('button', { name: /appointments/i }))
    await user.click(await screen.findByRole('button', { name: /add appointment/i }))

    expect(await screen.findByText('Clinic list failed.')).toBeInTheDocument()
  })

  test('shows booking error when staff has no linked clinic', async () => {
    const user = userEvent.setup()

    setupFetchMock()

    renderDashboard({
      user: { id: 'staff-1', clinic_id: null },
      clinicId: null,
    })

    await user.click(await screen.findByRole('button', { name: /appointments/i }))
    await user.click(await screen.findByRole('button', { name: /add appointment/i }))

    expect(
      await screen.findByText('No clinic is linked to this staff account.')
    ).toBeInTheDocument()
  })

  test('shows availability section', async () => {
    setupFetchMock()

    renderDashboard()
    await openSection(/availability/i)

    expect(await screen.findByRole('heading', { name: 'Availability' })).toBeInTheDocument()
    expect(screen.getByText(/set the days and times/i)).toBeInTheDocument()
  })

  test('shows availability load error as toast', async () => {
    setupFetchMock({
      availabilityOk: false,
      availabilityError: 'Availability failed to load.',
    })

    renderDashboard()
    await openSection(/availability/i)

    expect(await screen.findByText('Availability failed to load.')).toBeInTheDocument()
  })

  test('loads existing availability rows', async () => {
    setupFetchMock({
      availabilityRows: [
        {
          id: 'availability-1',
          day_of_week: 0,
          start_time: '09:00:00',
          end_time: '15:00:00',
          is_available: true,
        },
      ],
    })

    renderDashboard()
    await openSection(/availability/i)

    expect(await screen.findByLabelText(/monday start time/i)).toHaveValue('09:00')
    expect(screen.getByLabelText(/monday end time/i)).toHaveValue('15:00')
  })

  test('uses alternate clinic hours format for availability defaults', async () => {
    setupFetchMock({
      clinicDetails: {
        id: 'clinic-1',
        name: 'Hillbrow Clinic',
        hours: {
          MONDAY: {
            start_time: '10:00:00',
            end_time: '14:00:00',
          },
        },
      },
    })

    renderDashboard()
    await openSection(/availability/i)

    expect(await screen.findByLabelText(/monday start time/i)).toHaveValue('10:00')
    expect(screen.getByLabelText(/monday end time/i)).toHaveValue('14:00')
  })

  test('shows availability validation error when start time is after end time', async () => {
    const user = userEvent.setup()

    setupFetchMock()

    renderDashboard()
    await openSection(/availability/i)

    const mondayStart = await screen.findByLabelText(/monday start time/i)
    const mondayEnd = screen.getByLabelText(/monday end time/i)

    await user.clear(mondayStart)
    await user.type(mondayStart, '17:00')

    await user.clear(mondayEnd)
    await user.type(mondayEnd, '08:00')

    await user.click(screen.getByRole('button', { name: /save availability/i }))

    expect(await screen.findByText('Start time must be before end time.')).toBeInTheDocument()
    expect(await screen.findByText('Please fix availability errors first.')).toBeInTheDocument()
  })

  test('saves availability successfully', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      availabilityRows: [
        {
          id: 'availability-1',
          day_of_week: 0,
          start_time: '09:00:00',
          end_time: '15:00:00',
          is_available: true,
        },
      ],
    })

    renderDashboard()
    await openSection(/availability/i)

    await user.click(await screen.findByRole('button', { name: /save availability/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/staff/staff-1/availability/availability-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            start_time: '09:00',
            end_time: '15:00',
            is_available: true,
          }),
        })
      )
    })

    expect(await screen.findByText('Availability saved successfully.')).toBeInTheDocument()
  })

  test('shows availability save error when backend rejects save', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      availabilitySaveOk: false,
      availabilitySaveError: 'Availability overlaps another schedule',
      availabilityRows: [
        {
          id: 'availability-1',
          day_of_week: 0,
          start_time: '09:00:00',
          end_time: '15:00:00',
          is_available: true,
        },
      ],
    })

    renderDashboard()
    await openSection(/availability/i)

    await user.click(await screen.findByRole('button', { name: /save availability/i }))

    expect(await screen.findByText('Availability overlaps another schedule')).toBeInTheDocument()
  })

  test('updates staff appointment view when marking appointment as Completed', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      appointments: [activeAppointment],
    })

    renderDashboard()
    await openSection(/appointments/i)

    expect(await screen.findByText('Jane Appointment')).toBeInTheDocument()
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /^completed$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/appointments/appointment-1/status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'Completed' }),
        })
      )
    })

    expect(await screen.findByText('Appointment marked as Completed.')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
    })

    expect(screen.queryByRole('button', { name: /^completed$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^no-show$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^reschedule$/i })).not.toBeInTheDocument()
  })

  test('updates staff appointment view when marking appointment as No-show', async () => {
    const user = userEvent.setup()

    setupFetchMock({
      appointments: [activeAppointment],
    })

    renderDashboard()
    await openSection(/appointments/i)

    expect(await screen.findByText('Jane Appointment')).toBeInTheDocument()
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /^no-show$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/appointments/appointment-1/status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'No-show' }),
        })
      )
    })

    expect(await screen.findByText('Appointment marked as No-show.')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getAllByText('No-show').length).toBeGreaterThan(0)
    })

    expect(screen.queryByRole('button', { name: /^completed$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^no-show$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^reschedule$/i })).not.toBeInTheDocument()
  })

  describe('staff cancel flow', () => {
    test('opens cancel popup with current appointment details', async () => {
      const user = userEvent.setup()

      setupFetchMock({
        appointments: [activeAppointment],
      })

      renderDashboard()
      await openSection(/appointments/i)

      expect(await screen.findByText('Jane Appointment')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /^cancel$/i }))

      const dialog = await screen.findByRole('dialog', {
        name: /cancel appointment/i,
      })

      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveTextContent('Cancel appointment?')
      expect(dialog).toHaveTextContent('Jane Appointment')
      expect(dialog).toHaveTextContent('Date:')
      expect(dialog).toHaveTextContent('Time:')
    })

    test('dismisses staff cancel popup without calling cancel endpoint', async () => {
      const user = userEvent.setup()

      setupFetchMock({
        appointments: [activeAppointment],
      })

      renderDashboard()
      await openSection(/appointments/i)

      await user.click(await screen.findByRole('button', { name: /^cancel$/i }))
      await user.click(screen.getByRole('button', { name: /keep appointment/i }))

      expect(screen.queryByRole('dialog', { name: /cancel appointment/i }))
        .not.toBeInTheDocument()

      expect(
        global.fetch.mock.calls.some(([url]) =>
          String(url).includes('/api/appointments/appointment-1/cancel')
        )
      ).toBe(false)
    })

    test('staff cancel confirm sends PATCH and marks appointment as cancelled', async () => {
      const user = userEvent.setup()

      setupFetchMock({
        appointments: [activeAppointment],
      })

      renderDashboard()
      await openSection(/appointments/i)

      await user.click(await screen.findByRole('button', { name: /^cancel$/i }))
      await user.click(screen.getByRole('button', { name: /yes, cancel/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:8080/api/appointments/appointment-1/cancel',
          expect.objectContaining({
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          })
        )
      })

      expect(await screen.findByText('Appointment cancelled successfully'))
        .toBeInTheDocument()

      expect(screen.getByText('Jane Appointment')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0)
      })

      expect(screen.queryByRole('dialog', { name: /cancel appointment/i }))
        .not.toBeInTheDocument()
    })

    test('staff cancel displays backend error and keeps popup open', async () => {
      const user = userEvent.setup()

      setupFetchMock({
        appointments: [activeAppointment],
        cancelOk: false,
        cancelError: 'Cannot cancel an appointment that is Completed',
      })

      renderDashboard()
      await openSection(/appointments/i)

      await user.click(await screen.findByRole('button', { name: /^cancel$/i }))
      await user.click(screen.getByRole('button', { name: /yes, cancel/i }))

      expect(
        await screen.findByText(/cannot cancel an appointment that is completed/i)
      ).toBeInTheDocument()

      expect(screen.getByRole('dialog', { name: /cancel appointment/i }))
        .toBeInTheDocument()
    })
  })
})