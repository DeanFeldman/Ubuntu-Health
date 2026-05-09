import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PatientAppointments from '../../pages/PatientAppointments'
import { useAuth } from '../../context/AuthContext'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../lib/getApiBase', () => () => 'http://localhost:5000')

const activeAppointment = {
  id: 'appointment-1',
  patient_id: 'test-patient-id',
  clinic_id: 'clinic-1',
  slot_id: 'slot-1',
  clinic_name: 'Ubuntu Clinic',
  status: 'Confirmed',
  slot_datetime: '2099-05-11T10:00:00Z',
}

function mockAuth({
  user = { id: 'test-user-id' },
  dbUser = { id: 'test-patient-id' },
} = {}) {
  useAuth.mockReturnValue({ user, dbUser })
}

function mockAutoNoShowsResponse({
  ok = true,
  updatedCount = 0,
  error = 'Failed to auto-mark no-shows.',
} = {}) {
  fetch.mockResolvedValueOnce({
    ok,
    json: async () =>
      ok
        ? {
            message: updatedCount
              ? `${updatedCount} appointment(s) marked as No-show`
              : 'No missed appointments found',
            updatedCount,
            appointments: [],
          }
        : { error },
  })
}

function mockAppointmentsResponse({
  ok = true,
  appointments = [],
  error = 'Failed to load appointments',
} = {}) {
  fetch.mockResolvedValueOnce({
    ok,
    json: async () => (ok ? { appointments } : { error }),
  })
}

function mockSlotsResponse({
  ok = true,
  slots = ['07:30', '07:45'],
  error = 'Failed to load available slots.',
} = {}) {
  fetch.mockResolvedValueOnce({
    ok,
    json: async () => (ok ? slots : { error }),
  })
}

function renderPage() {
  return render(<PatientAppointments />)
}

async function renderWithAppointments(appointments = [activeAppointment]) {
  mockAutoNoShowsResponse()
  mockAppointmentsResponse({ appointments })

  renderPage()

  await screen.findByText('My Future Appointments')
}

async function openCancelConfirmation(user) {
  await renderWithAppointments([activeAppointment])

  await user.click(await screen.findByRole('button', { name: /cancel appointment/i }))

  return screen.getByRole('dialog', { name: /cancel appointment/i })
}

async function openRescheduleModal(user, slots = ['07:30', '07:45']) {
  mockAutoNoShowsResponse()
  mockAppointmentsResponse({ appointments: [activeAppointment] })
  mockSlotsResponse({ slots })

  renderPage()

  await user.click(await screen.findByRole('button', { name: /reschedule/i }))

  return screen.getByRole('dialog', { name: /reschedule appointment/i })
}

async function openRescheduleConfirmation(user, slots = ['07:30', '07:45']) {
  await openRescheduleModal(user, slots)

  await user.click(await screen.findByRole('button', { name: '07:45' }))
  await user.click(screen.getByRole('button', { name: /continue/i }))

  return screen.getByRole('dialog', { name: /confirm reschedule/i })
}

describe('PatientAppointments', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
    global.fetch = jest.fn()
    mockAuth()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  test('auto-marks patient no-shows before loading appointments', async () => {
    mockAutoNoShowsResponse({ updatedCount: 1 })
    mockAppointmentsResponse({ appointments: [] })

    renderPage()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/appointments/auto-no-shows/user/test-patient-id',
        expect.objectContaining({
          method: 'PATCH',
          headers: { Accept: 'application/json' },
        })
      )
    })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/appointments/patient/test-patient-id',
      { headers: { Accept: 'application/json' } }
    )
  })

  test('logs auto no-show failure but still loads appointments', async () => {
    mockAutoNoShowsResponse({
      ok: false,
      error: 'Auto no-show failed.',
    })

    mockAppointmentsResponse({
      appointments: [activeAppointment],
    })

    renderPage()

    expect((await screen.findAllByText('Ubuntu Clinic')).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Failed to auto-mark no-shows:',
        'Auto no-show failed.'
      )
    })
  })

  test('does not fetch when no patient id is available', async () => {
    mockAuth({
      user: null,
      dbUser: null,
    })

    renderPage()

    expect(await screen.findByText('No upcoming appointments')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('shows loading state before appointments resolve', async () => {
    let resolveAutoNoShows

    fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAutoNoShows = resolve
      })
    )

    renderPage()

    expect(screen.getByLabelText('Loading appointments')).toBeInTheDocument()
    expect(screen.getByText(/Loading your appointments/i)).toBeInTheDocument()

    mockAppointmentsResponse({ appointments: [] })

    resolveAutoNoShows({
      ok: true,
      json: async () => ({ updatedCount: 0, appointments: [] }),
    })

    expect(await screen.findByText('No upcoming appointments')).toBeInTheDocument()
  })

  test('shows empty state when no appointments exist', async () => {
    await renderWithAppointments([])

    expect(await screen.findByText('No upcoming appointments')).toBeInTheDocument()
    expect(screen.getByText(/browse available clinics and tap/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /browse clinics/i })).toBeInTheDocument()
  })

  test('browse clinics button navigates to clinic page', async () => {
    const user = userEvent.setup()

    await renderWithAppointments([])

    const browseButton = await screen.findByRole('button', {
      name: /browse clinics/i,
    })

    await user.click(browseButton)

    expect(mockNavigate).toHaveBeenCalledWith('/clinic')
  })

  test('renders appointment details correctly', async () => {
    await renderWithAppointments([activeAppointment])

    expect((await screen.findAllByText('Ubuntu Clinic')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0)
    expect(screen.getByText('Clinic')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getAllByText('Time').length).toBeGreaterThan(0)
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel appointment/i })).toBeInTheDocument()
  })

  test('uses fallback clinic and status values when appointment fields are missing', async () => {
    await renderWithAppointments([
      {
        ...activeAppointment,
        clinic_name: '',
        status: '',
        slot_datetime: '',
      },
    ])

    expect((await screen.findAllByText('Clinic')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  test('hides action buttons for final appointment statuses and filters cancelled/completed appointments', async () => {
    await renderWithAppointments([
      { ...activeAppointment, id: 'cancelled', status: 'Cancelled' },
      { ...activeAppointment, id: 'completed', status: 'Completed' },
      { ...activeAppointment, id: 'no-show', status: 'No-show' },
    ])

    await waitFor(() => {
      expect(screen.getAllByText(/Ubuntu Clinic/i).length).toBeGreaterThan(0)
    })

    expect(screen.getAllByText('No-show').length).toBeGreaterThan(0)
    expect(screen.queryByText('Cancelled')).not.toBeInTheDocument()
    expect(screen.queryByText('Completed')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reschedule/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel appointment/i })).not.toBeInTheDocument()
  })

  test('shows an error message when appointments fail to load', async () => {
    mockAutoNoShowsResponse()
    mockAppointmentsResponse({
      ok: false,
      error: 'Failed to load test appointments',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load test appointments'
    )
  })

  test('uses default appointment load error when response has no JSON body', async () => {
    mockAutoNoShowsResponse()

    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('bad json')
      },
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load appointments'
    )
  })

  test('opens reschedule interface and fetches slots when date changes', async () => {
    const user = userEvent.setup()

    mockAutoNoShowsResponse()
    mockAppointmentsResponse({ appointments: [activeAppointment] })
    mockSlotsResponse({ slots: ['07:30', '07:45'] })
    mockSlotsResponse({ slots: ['08:00', '08:15'] })

    renderPage()

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))

    expect(screen.getByRole('dialog', { name: /reschedule appointment/i }))
      .toBeInTheDocument()

    const dateInput = screen.getByLabelText(/new date/i)
    expect(dateInput).toBeInTheDocument()

    await screen.findByRole('button', { name: '07:30' })

    fireEvent.change(dateInput, { target: { value: '2099-05-12' } })

    expect(await screen.findByRole('button', { name: '08:00' })).toBeInTheDocument()

    expect(fetch).toHaveBeenLastCalledWith(
      'http://localhost:5000/api/appointments/slots?clinic_id=clinic-1&date=2099-05-12',
      { headers: { Accept: 'application/json' } }
    )
  })

  test('displays current appointment details in the reschedule interface', async () => {
    const user = userEvent.setup()

    const dialog = await openRescheduleModal(user)

    expect(dialog).toHaveTextContent('Choose a new date and available time')
    expect(dialog).toHaveTextContent('Ubuntu Clinic')
    expect(dialog).toHaveTextContent('Current date')
    expect(dialog).toHaveTextContent('Current time')
    expect(screen.getByLabelText(/new date/i)).toHaveValue('2099-05-11')
  })

  test('does not show the current appointment slot as an available reschedule option', async () => {
    const user = userEvent.setup()

    await openRescheduleModal(user, ['12:00', '12:15'])

    expect(await screen.findByRole('button', { name: '12:15' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '12:00' })).not.toBeInTheDocument()
  })

  test('clears selected slot and disables continue when reschedule date changes', async () => {
    const user = userEvent.setup()

    mockAutoNoShowsResponse()
    mockAppointmentsResponse({ appointments: [activeAppointment] })
    mockSlotsResponse({ slots: ['07:30', '07:45'] })
    mockSlotsResponse({ slots: ['08:00', '08:15'] })

    renderPage()

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))

    const slotButton = await screen.findByRole('button', { name: '07:45' })
    await user.click(slotButton)

    expect(slotButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()

    fireEvent.change(screen.getByLabelText(/new date/i), {
      target: { value: '2099-05-12' },
    })

    expect(await screen.findByRole('button', { name: '08:00' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('shows slot loading state while fetching available slots', async () => {
    const user = userEvent.setup()
    let resolveSlots

    mockAutoNoShowsResponse()
    mockAppointmentsResponse({ appointments: [activeAppointment] })

    fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSlots = resolve
      })
    )

    renderPage()

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))

    expect(await screen.findByText(/loading available slots/i)).toBeInTheDocument()

    resolveSlots({
      ok: true,
      json: async () => ['07:30'],
    })

    expect(await screen.findByRole('button', { name: '07:30' })).toBeInTheDocument()
  })

  test('shows slot error state when slot fetch fails', async () => {
    const user = userEvent.setup()

    mockAutoNoShowsResponse()
    mockAppointmentsResponse({ appointments: [activeAppointment] })
    mockSlotsResponse({
      ok: false,
      error: 'Failed to load slots for test',
    })

    renderPage()

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Failed to load slots for test')
  })

  test('shows default slot error when slot response has no JSON body', async () => {
    const user = userEvent.setup()

    mockAutoNoShowsResponse()
    mockAppointmentsResponse({ appointments: [activeAppointment] })

    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('bad json')
      },
    })

    renderPage()

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Failed to load available slots.')
  })

  test('shows empty state when no slots are available', async () => {
    const user = userEvent.setup()

    await openRescheduleModal(user, [])

    expect(await screen.findByText(/no slots available for this date/i))
      .toBeInTheDocument()
  })

  test('marks selected slot visually and enables continue', async () => {
    const user = userEvent.setup()

    await openRescheduleModal(user)

    const continueButton = screen.getByRole('button', { name: /continue/i })
    expect(continueButton).toBeDisabled()

    const slotButton = await screen.findByRole('button', { name: '07:45' })
    await user.click(slotButton)

    expect(slotButton).toHaveAttribute('aria-pressed', 'true')
    expect(slotButton).toHaveClass('q-slot-btn-selected')
    expect(continueButton).not.toBeDisabled()
  })

  test('opens confirmation popup with old and new appointment details', async () => {
    const user = userEvent.setup()

    const confirmDialog = await openRescheduleConfirmation(user)

    expect(confirmDialog).toBeInTheDocument()
    expect(confirmDialog).toHaveTextContent('Ubuntu Clinic')
    expect(confirmDialog).toHaveTextContent('Current date')
    expect(confirmDialog).toHaveTextContent('Current time')
    expect(confirmDialog).toHaveTextContent('New date')
    expect(confirmDialog).toHaveTextContent('New time')
    expect(confirmDialog).toHaveTextContent('07:45')
    expect(confirmDialog).toHaveTextContent('Confirmed')
  })

  test('shows optional service in reschedule confirmation when present', async () => {
    const user = userEvent.setup()

    mockAutoNoShowsResponse()
    mockAppointmentsResponse({
      appointments: [
        {
          ...activeAppointment,
          service: 'General Consultation',
        },
      ],
    })
    mockSlotsResponse()

    renderPage()

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))
    await user.click(await screen.findByRole('button', { name: '07:45' }))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    const confirmDialog = screen.getByRole('dialog', { name: /confirm reschedule/i })

    expect(confirmDialog).toHaveTextContent('Service')
    expect(confirmDialog).toHaveTextContent('General Consultation')
  })

  test('back in confirmation returns to slot selection without calling PATCH', async () => {
    const user = userEvent.setup()

    await openRescheduleConfirmation(user)

    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(screen.queryByRole('dialog', { name: /confirm reschedule/i }))
      .not.toBeInTheDocument()

    expect(screen.getByRole('dialog', { name: /reschedule appointment/i }))
      .toBeInTheDocument()

    expect(fetch).toHaveBeenCalledTimes(3)
  })

  test('clicking reschedule overlay closes the reschedule modal', async () => {
    const user = userEvent.setup()

    const dialog = await openRescheduleModal(user)

    fireEvent.click(dialog)

    expect(screen.queryByRole('dialog', { name: /reschedule appointment/i }))
      .not.toBeInTheDocument()
  })

  test('clicking reschedule confirmation overlay closes only the confirmation modal', async () => {
    const user = userEvent.setup()

    const confirmDialog = await openRescheduleConfirmation(user)

    fireEvent.click(confirmDialog)

    expect(screen.queryByRole('dialog', { name: /confirm reschedule/i }))
      .not.toBeInTheDocument()

    expect(screen.getByRole('dialog', { name: /reschedule appointment/i }))
      .toBeInTheDocument()
  })

  test('confirm reschedule calls PATCH with selected appointment id and body', async () => {
    const user = userEvent.setup()

    await openRescheduleConfirmation(user)

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Appointment rescheduled successfully',
        appointment: {
          ...activeAppointment,
          slot_datetime: '2099-05-11T07:45:00Z',
        },
      }),
    })

    mockAppointmentsResponse({ appointments: [] })

    await user.click(screen.getByRole('button', { name: /confirm reschedule/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/appointments/appointment-1/reschedule',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            date: '2099-05-11',
            time: '07:45',
          }),
        }
      )
    })
  })

  test('successful confirm refreshes appointments and closes reschedule modals', async () => {
    const user = userEvent.setup()

    await openRescheduleConfirmation(user)

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Appointment rescheduled successfully',
        appointment: {
          ...activeAppointment,
          slot_datetime: '2099-05-11T07:45:00Z',
        },
      }),
    })

    mockAppointmentsResponse({ appointments: [] })

    await user.click(screen.getByRole('button', { name: /confirm reschedule/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /confirm reschedule/i }))
        .not.toBeInTheDocument()
    })

    expect(screen.queryByRole('dialog', { name: /reschedule appointment/i }))
      .not.toBeInTheDocument()

    expect(await screen.findByText('Appointment rescheduled successfully'))
      .toBeInTheDocument()

    expect(fetch).toHaveBeenLastCalledWith(
      'http://localhost:5000/api/appointments/patient/test-patient-id',
      { headers: { Accept: 'application/json' } }
    )
  })

  test('backend error displays in confirmation modal and keeps selected details', async () => {
    const user = userEvent.setup()

    const confirmDialog = await openRescheduleConfirmation(user)

    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'This slot is already booked' }),
    })

    await user.click(screen.getByRole('button', { name: /confirm reschedule/i }))

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('This slot is already booked')

    expect(confirmDialog).toBeInTheDocument()
    expect(confirmDialog).toHaveTextContent('07:45')
  })

  test('uses default reschedule error when backend returns no JSON body', async () => {
    const user = userEvent.setup()

    await openRescheduleConfirmation(user)

    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('bad json')
      },
    })

    await user.click(screen.getByRole('button', { name: /confirm reschedule/i }))

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Could not reschedule appointment.')
  })

  test('confirm button is disabled while reschedule request is loading', async () => {
    const user = userEvent.setup()
    let resolveReschedule

    await openRescheduleConfirmation(user)

    fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReschedule = resolve
      })
    )

    await user.click(screen.getByRole('button', { name: /confirm reschedule/i }))

    expect(screen.getByRole('button', { name: /rescheduling/i })).toBeDisabled()

    mockAppointmentsResponse({ appointments: [] })

    resolveReschedule({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Appointment rescheduled successfully',
        appointment: activeAppointment,
      }),
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /confirm reschedule/i }))
        .not.toBeInTheDocument()
    })
  })

  test('opens patient cancel confirmation popup with appointment details', async () => {
    const user = userEvent.setup()

    const dialog = await openCancelConfirmation(user)

    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Cancel appointment?')
    expect(dialog).toHaveTextContent('Ubuntu Clinic')
    expect(dialog).toHaveTextContent('Date')
    expect(dialog).toHaveTextContent('Time')
  })

  test('dismisses patient cancel popup without calling cancel endpoint', async () => {
    const user = userEvent.setup()

    await openCancelConfirmation(user)

    await user.click(screen.getByRole('button', { name: /keep appointment/i }))

    expect(screen.queryByRole('dialog', { name: /cancel appointment/i }))
      .not.toBeInTheDocument()

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('clicking cancel overlay dismisses cancel popup', async () => {
    const user = userEvent.setup()

    const dialog = await openCancelConfirmation(user)

    fireEvent.click(dialog)

    expect(screen.queryByRole('dialog', { name: /cancel appointment/i }))
      .not.toBeInTheDocument()
  })

  test('patient cancel confirm sends PATCH and removes appointment from view', async () => {
    const user = userEvent.setup()

    await openCancelConfirmation(user)

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'Appointment cancelled successfully',
        appointment: {
          ...activeAppointment,
          status: 'Cancelled',
        },
      }),
    })

    await user.click(screen.getByRole('button', { name: /yes, cancel/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/appointments/appointment-1/cancel',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      )
    })

    expect(await screen.findByText(/appointment cancelled successfully/i))
      .toBeInTheDocument()

    expect(screen.queryByText('Ubuntu Clinic')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /cancel appointment/i }))
      .not.toBeInTheDocument()
  })

  test('patient cancel displays backend error and keeps popup open', async () => {
    const user = userEvent.setup()

    const dialog = await openCancelConfirmation(user)

    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Cannot cancel an appointment that is Completed',
      }),
    })

    await user.click(screen.getByRole('button', { name: /yes, cancel/i }))

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Cannot cancel an appointment that is Completed')

    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Ubuntu Clinic')
  })

  test('patient cancel uses default error when backend returns no JSON body', async () => {
    const user = userEvent.setup()

    await openCancelConfirmation(user)

    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('bad json')
      },
    })

    await user.click(screen.getByRole('button', { name: /yes, cancel/i }))

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Could not cancel appointment.')
  })

  test('cancel button is disabled while cancel request is loading', async () => {
    const user = userEvent.setup()
    let resolveCancel

    await openCancelConfirmation(user)

    fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCancel = resolve
      })
    )

    await user.click(screen.getByRole('button', { name: /yes, cancel/i }))

    expect(screen.getByRole('button', { name: /cancelling/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /keep appointment/i })).toBeDisabled()

    resolveCancel({
      ok: true,
      json: async () => ({
        message: 'Appointment cancelled successfully',
      }),
    })

    expect(await screen.findByText(/appointment cancelled successfully/i))
      .toBeInTheDocument()
  })
})