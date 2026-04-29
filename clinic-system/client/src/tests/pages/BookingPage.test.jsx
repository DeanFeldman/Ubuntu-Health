import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BookingPage from '../../pages/BookingPage'
import { useAuth } from '../../context/AuthContext'
import getApiBase from '../../lib/getApiBase'
import { useLocation, useNavigate } from 'react-router-dom'

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../lib/getApiBase', () => jest.fn())

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn(),
  useNavigate: jest.fn(),
}))

const mockNavigate = jest.fn()

const clinic = {
  id: 'clinic-1',
  name: 'Hillbrow Clinic',
  municipality: 'Region F',
  district: 'Johannesburg',
  facility_type: 'Clinic',
}

function renderPage({
  auth = {
    user: { id: 'staff-1', full_name: 'Staff User', email: 'staff@example.com' },
    role: 'Staff',
  },
  locationState = { clinic, bookingMode: 'staff' },
} = {}) {
  useAuth.mockReturnValue(auth)
  useLocation.mockReturnValue({ state: locationState })
  useNavigate.mockReturnValue(mockNavigate)
  getApiBase.mockReturnValue('http://localhost:8080')

  return render(<BookingPage />)
}

function setupFetchMock({
  users = [
    { id: 'patient-1', full_name: 'Jane Doe', role: 'Patient' },
    { id: 'staff-2', full_name: 'Someone Staff', role: 'Staff' },
  ],
  slots = ['09:00', '09:30'],
  patientsOk = true,
  slotsOk = true,
  createPatientOk = true,
  createPatient = { patient: { id: 'new-patient-1' } },
  appointmentOk = true,
  appointmentResponse = { appointment: { id: 'appt-1' } },
} = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    const urlString = String(url)
    const method = options.method || 'GET'

    if (urlString.includes('/api/users') && method === 'GET') {
      return Promise.resolve({
        ok: patientsOk,
        json: async () => (patientsOk ? { users } : { error: 'Failed to load users' }),
      })
    }

    if (urlString.includes('/api/appointments/slots') && method === 'GET') {
      return Promise.resolve({
        ok: slotsOk,
        json: async () => (slotsOk ? slots : { error: 'Failed to load slots' }),
      })
    }

    if (urlString.includes('/api/patients') && method === 'POST') {
      return Promise.resolve({
        ok: createPatientOk,
        json: async () =>
          createPatientOk ? createPatient : { error: 'Failed to create patient.' },
      })
    }

    if (urlString.includes('/api/appointments') && method === 'POST') {
      return Promise.resolve({
        ok: appointmentOk,
        json: async () =>
          appointmentOk ? appointmentResponse : { error: 'Booking failed.' },
      })
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    })
  })
}

async function selectExistingPatientAndSlot(user) {
  await waitFor(() => {
    expect(screen.getByRole('option', { name: /Jane Doe/ })).toBeInTheDocument()
  })

  await user.selectOptions(screen.getByLabelText('Select existing patient'), 'patient-1')
  await user.type(screen.getByLabelText('Appointment date'), '2099-05-10')
  await user.click(await screen.findByRole('button', { name: '9:00 AM' }))
}

describe('BookingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('opens the confirmation popup when booking details are complete', async () => {
    const user = userEvent.setup()
    setupFetchMock()

    renderPage()
    await selectExistingPatientAndSlot(user)

    await user.click(screen.getByRole('button', { name: /Review Booking/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Confirm Appointment')).toBeInTheDocument()
  })

  test('shows the selected booking details in the confirmation popup', async () => {
    const user = userEvent.setup()
    setupFetchMock()

    renderPage()
    await selectExistingPatientAndSlot(user)

    await user.click(screen.getByRole('button', { name: /Review Booking/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('Hillbrow Clinic')).toBeInTheDocument()
    expect(within(dialog).getByText('Sunday, 10 May 2099')).toBeInTheDocument()
    expect(within(dialog).getByText('9:00 AM')).toBeInTheDocument()
    expect(within(dialog).getByText('Jane Doe')).toBeInTheDocument()
  })

  test('cannot proceed to confirmation without selecting a slot', async () => {
    const user = userEvent.setup()
    setupFetchMock()

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Jane Doe/ })).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Select existing patient'), 'patient-1')
    await user.type(screen.getByLabelText('Appointment date'), '2099-05-10')

    expect(screen.getByRole('button', { name: /Review Booking/i })).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('cannot proceed to confirmation with missing patient data', async () => {
    const user = userEvent.setup()
    setupFetchMock()

    renderPage()

    await user.type(screen.getByLabelText('Appointment date'), '2099-05-10')
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }))

    expect(screen.getByRole('button', { name: /Review Booking/i })).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('submits a valid booking and shows success feedback', async () => {
    const user = userEvent.setup()
    setupFetchMock()

    renderPage()
    await selectExistingPatientAndSlot(user)

    await user.click(screen.getByRole('button', { name: /Review Booking/i }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/appointments',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinic_id: 'clinic-1',
            patient_id: 'patient-1',
            date: '2099-05-10',
            time: '09:00',
            booked_by: 'staff-1',
            is_new_patient: false,
          }),
        })
      )
    })

    expect(await screen.findByText('Appointment Booked!')).toBeInTheDocument()
    expect(screen.getByText('Appointment booked successfully')).toBeInTheDocument()
    expect(screen.getByText(/Your appointment at/i)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('shows API error feedback when booking fails', async () => {
    const user = userEvent.setup()
    setupFetchMock({
      appointmentOk: false,
    })

    renderPage()
    await selectExistingPatientAndSlot(user)

    await user.click(screen.getByRole('button', { name: /Review Booking/i }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))

    const errors = await screen.findAllByText((text) => text.includes('Booking failed.'))

    expect(errors.length).toBeGreaterThan(0)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Appointment Booked!')).not.toBeInTheDocument()
  })

  test('date input prevents selecting past dates using min attribute', () => {
  setupFetchMock()
  renderPage()

  const dateInput = screen.getByLabelText('Appointment date')

  expect(dateInput).toHaveAttribute('min')
  expect(dateInput.getAttribute('min')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('shows slot API error when available slots fail to load', async () => {
  const user = userEvent.setup()
  setupFetchMock({
    slotsOk: false,
  })

  renderPage()

  await user.type(screen.getByLabelText('Appointment date'), '2099-05-10')

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load slots')
  expect(screen.getByText('Failed to load slots')).toBeInTheDocument()
})
test('shows only valid slots returned by the backend', async () => {
  const user = userEvent.setup()

  setupFetchMock({
    slots: ['09:00', '09:30'],
  })

  renderPage()

  await waitFor(() => {
    expect(screen.getByRole('option', { name: /Jane Doe/ })).toBeInTheDocument()
  })

  await user.type(screen.getByLabelText('Appointment date'), '2099-05-10')

  expect(await screen.findByRole('button', { name: '9:00 AM' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '9:30 AM' })).toBeInTheDocument()
  expect(screen.queryByText('bad-slot')).not.toBeInTheDocument()
  expect(screen.queryByText('25:99')).not.toBeInTheDocument()
})
})
