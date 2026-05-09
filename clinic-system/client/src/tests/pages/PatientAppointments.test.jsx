import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

function mockAutoNoShowsResponse(updatedCount = 0) {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      message: 'No missed appointments found',
      updatedCount,
      appointments: [],
    }),
  })
}

const activeAppointment = {
  id: 'appointment-1',
  patient_id: 'test-patient-id',
  clinic_id: 'clinic-1',
  slot_id: 'slot-1',
  clinic_name: 'Ubuntu Clinic',
  status: 'Confirmed',
  slot_datetime: '2099-05-11T10:00:00Z',
}

async function openRescheduleConfirmation(user, slots = ['07:30', '07:45']) {
  mockAutoNoShowsResponse()

  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appointments: [activeAppointment] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => slots,
    })

  render(<PatientAppointments />)

  await user.click(await screen.findByRole('button', { name: /reschedule/i }))
  await user.click(await screen.findByRole('button', { name: '07:45' }))
  await user.click(screen.getByRole('button', { name: /continue/i }))

  return screen.getByRole('dialog', { name: /confirm reschedule/i })
}

async function openCancelConfirmation(user) {
  mockAutoNoShowsResponse()

  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ appointments: [activeAppointment] }),
  })

  render(<PatientAppointments />)

  await user.click(await screen.findByRole('button', { name: /cancel appointment/i }))

  return screen.getByRole('dialog', { name: /cancel appointment/i })
}


describe('PatientAppointments', () => {
 beforeEach(() => {
  jest.clearAllMocks()
  fetch.mockReset()
})

  it('shows empty state when no appointments exist', async () => {
    mockAutoNoShowsResponse()

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appointments: [] }),
    })

    render(<PatientAppointments />)

    await waitFor(() => {
      expect(screen.getByText('No upcoming appointments')).toBeInTheDocument()
    })

    expect(screen.getByText(/browse available clinics and tap/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /browse clinics/i })).toBeInTheDocument()
  })

  it('renders appointment details correctly', async () => {
    mockAutoNoShowsResponse()
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        appointments: [activeAppointment],
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

  it('shows reschedule button for eligible appointments', async () => {
    mockAutoNoShowsResponse()
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appointments: [activeAppointment] }),
    })

    render(<PatientAppointments />)

    expect(await screen.findByRole('button', { name: /reschedule/i }))
      .toBeInTheDocument()
  })

  it('hides reschedule button for final appointment statuses', async () => {
    mockAutoNoShowsResponse() 
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        appointments: [
          { ...activeAppointment, id: 'cancelled', status: 'Cancelled' },
          { ...activeAppointment, id: 'completed', status: 'Completed' },
          { ...activeAppointment, id: 'no-show', status: 'No-show' },
        ],
      }),
    })

    render(<PatientAppointments />)

    await waitFor(() => {
      expect(screen.getAllByText(/ubuntu clinic/i).length).toBeGreaterThan(0)
    })

    expect(screen.queryByRole('button', { name: /reschedule/i }))
      .not.toBeInTheDocument()
  })

  it('opens reschedule interface and fetches slots when date changes', async () => {
    const user = userEvent.setup()
    mockAutoNoShowsResponse()
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ appointments: [activeAppointment] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ['07:30', '07:45'],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ['08:00', '08:15'],
      })

    render(<PatientAppointments />)

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))

    expect(screen.getByRole('dialog', { name: /reschedule appointment/i }))
      .toBeInTheDocument()

    const dateInput = screen.getByLabelText(/new date/i)
    expect(dateInput).toBeInTheDocument()

    await screen.findByRole('button', { name: '07:30' })

    fireEvent.change(dateInput, { target: { value: '2099-05-12' } })

    expect(await screen.findByRole('button', { name: '08:00' }))
      .toBeInTheDocument()
    expect(fetch).toHaveBeenLastCalledWith(
      'http://localhost:5000/api/appointments/slots?clinic_id=clinic-1&date=2099-05-12',
      { headers: { Accept: 'application/json' } }
    )
  })
    it('displays current appointment details in the reschedule interface', async () => {
    const user = userEvent.setup()
    mockAutoNoShowsResponse()
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ appointments: [activeAppointment] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ['07:30', '07:45'],
      })

    render(<PatientAppointments />)

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))

    const rescheduleDialog = await screen.findByRole('dialog', {
      name: /reschedule appointment/i,
    })

    expect(rescheduleDialog).toHaveTextContent('Choose a new date and available time')
    expect(rescheduleDialog).toHaveTextContent('Ubuntu Clinic')
    expect(rescheduleDialog).toHaveTextContent('Current date')
    expect(rescheduleDialog).toHaveTextContent('Current time')
    expect(screen.getByLabelText(/new date/i)).toHaveValue('2099-05-11')
  })

  it('does not show the current appointment slot as an available reschedule option', async () => {
  const user = userEvent.setup()
    mockAutoNoShowsResponse()
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appointments: [activeAppointment] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ['12:00', '12:15'],
    })

  render(<PatientAppointments />)

  await user.click(await screen.findByRole('button', { name: /reschedule/i }))

  expect(await screen.findByRole('button', { name: '12:15' }))
    .toBeInTheDocument()

  expect(screen.queryByRole('button', { name: '12:00' }))
    .not.toBeInTheDocument()
})
  it('clears selected slot and disables continue when reschedule date changes', async () => {
    const user = userEvent.setup()
    mockAutoNoShowsResponse()
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ appointments: [activeAppointment] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ['07:30', '07:45'],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ['08:00', '08:15'],
      })

    render(<PatientAppointments />)

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))

    const slotButton = await screen.findByRole('button', { name: '07:45' })
    await user.click(slotButton)

    expect(slotButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()

    fireEvent.change(screen.getByLabelText(/new date/i), {
      target: { value: '2099-05-12' },
    })

    expect(await screen.findByRole('button', { name: '08:00' }))
      .toBeInTheDocument()

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('shows slot loading state while fetching available slots', async () => {
    const user = userEvent.setup()
    let resolveSlots
    const slotsPromise = new Promise((resolve) => {
      resolveSlots = resolve
    })
    mockAutoNoShowsResponse()
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ appointments: [activeAppointment] }),
      })
      .mockReturnValueOnce(slotsPromise)

    render(<PatientAppointments />)

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))

    expect(await screen.findByText(/loading available slots/i))
      .toBeInTheDocument()

    resolveSlots({
      ok: true,
      json: async () => ['07:30'],
    })

    expect(await screen.findByRole('button', { name: '07:30' }))
      .toBeInTheDocument()
  })

  it('shows slot error state when slot fetch fails', async () => {
    const user = userEvent.setup()
    mockAutoNoShowsResponse()
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ appointments: [activeAppointment] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to load slots for test' }),
      })

    render(<PatientAppointments />)

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Failed to load slots for test')
  })

  it('shows empty state when no slots are available', async () => {
    const user = userEvent.setup()
    mockAutoNoShowsResponse()
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ appointments: [activeAppointment] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

    render(<PatientAppointments />)

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))

    expect(await screen.findByText(/no slots available for this date/i))
      .toBeInTheDocument()
  })

  it('marks selected slot visually and enables continue', async () => {
    const user = userEvent.setup()
    mockAutoNoShowsResponse()
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ appointments: [activeAppointment] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ['07:30', '07:45'],
      })

    render(<PatientAppointments />)

    await user.click(await screen.findByRole('button', { name: /reschedule/i }))

    const continueButton = screen.getByRole('button', { name: /continue/i })
    expect(continueButton).toBeDisabled()

    const slotButton = await screen.findByRole('button', { name: '07:45' })
    await user.click(slotButton)

    expect(slotButton).toHaveAttribute('aria-pressed', 'true')
    expect(slotButton).toHaveClass('q-slot-btn-selected')
    expect(continueButton).not.toBeDisabled()
  })

  it('opens confirmation popup with old and new appointment details', async () => {
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

  it('cancel in confirmation returns to slot selection without calling PATCH', async () => {
    const user = userEvent.setup()

    await openRescheduleConfirmation(user)
    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(screen.queryByRole('dialog', { name: /confirm reschedule/i }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /reschedule appointment/i }))
      .toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('confirm calls PATCH with selected appointment id and body', async () => {
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
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appointments: [] }),
    })

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

  it('successful confirm refreshes appointments and closes reschedule modals', async () => {
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
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appointments: [] }),
    })

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

  it('backend error displays in confirmation modal and keeps selected details', async () => {
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

  it('confirm button is disabled while reschedule request is loading', async () => {
    const user = userEvent.setup()
    let resolveReschedule
    await openRescheduleConfirmation(user)

    fetch.mockReturnValueOnce(new Promise((resolve) => {
      resolveReschedule = resolve
    }))

    await user.click(screen.getByRole('button', { name: /confirm reschedule/i }))

    expect(screen.getByRole('button', { name: /rescheduling/i }))
      .toBeDisabled()
    mockAutoNoShowsResponse()
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appointments: [] }),
    })
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

  it('shows an error message when appointments fail to load', async () => {
    mockAutoNoShowsResponse()
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
  it('opens patient cancel confirmation popup with appointment details', async () => {
  const user = userEvent.setup()

  const dialog = await openCancelConfirmation(user)

  expect(dialog).toBeInTheDocument()
  expect(dialog).toHaveTextContent('Cancel appointment?')
  expect(dialog).toHaveTextContent('Ubuntu Clinic')
  expect(dialog).toHaveTextContent('Date')
  expect(dialog).toHaveTextContent('Time')
})

it('dismisses patient cancel popup without calling cancel endpoint', async () => {
  const user = userEvent.setup()

  await openCancelConfirmation(user)
  await user.click(screen.getByRole('button', { name: /keep appointment/i }))

  expect(screen.queryByRole('dialog', { name: /cancel appointment/i }))
    .not.toBeInTheDocument()

  expect(fetch).toHaveBeenCalledTimes(2)
})

it('patient cancel confirm sends PATCH and removes appointment from view', async () => {
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

it('patient cancel displays backend error and keeps popup open', async () => {
  const user = userEvent.setup()

  const dialog = await openCancelConfirmation(user)
  fetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: 'Cannot cancel an appointment that is Completed' }),
  })

  await user.click(screen.getByRole('button', { name: /yes, cancel/i }))

  expect(await screen.findByRole('alert'))
    .toHaveTextContent('Cannot cancel an appointment that is Completed')

  expect(dialog).toBeInTheDocument()
  expect(dialog).toHaveTextContent('Ubuntu Clinic')
})
})