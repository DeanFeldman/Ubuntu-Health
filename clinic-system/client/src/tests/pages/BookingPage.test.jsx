import { render, screen, waitFor } from '@testing-library/react'
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
  locationState = { clinic },
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

describe('BookingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('shows fallback when no clinic is selected', () => {
    setupFetchMock()

    renderPage({
      locationState: null,
    })

    expect(screen.getByText('No clinic selected')).toBeInTheDocument()
    expect(
      screen.getByText('Please go back and select a clinic before booking.')
    ).toBeInTheDocument()
  })

  test('shows initial prompt to pick a date first', () => {
    setupFetchMock()

    renderPage()

    expect(screen.getByText('Pick a date first')).toBeInTheDocument()
  })

  test('loads and displays available slots after selecting a date', async () => {
    const user = userEvent.setup()
    setupFetchMock({
      slots: ['09:00', '09:30'],
    })

    renderPage()

    const dateInput = screen.getByLabelText('Appointment date')
    await user.type(dateInput, '2026-05-10')

    expect(await screen.findByRole('button', { name: '9:00 AM' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '9:30 AM' })).toBeInTheDocument()
  })

  test('shows slot loading error when slot request fails', async () => {
    const user = userEvent.setup()
    setupFetchMock({
      slotsOk: false,
    })

    renderPage()

    const dateInput = screen.getByLabelText('Appointment date')
    await user.type(dateInput, '2026-05-10')

    expect(await screen.findByText('Unable to load slots')).toBeInTheDocument()
  })

  test('staff can switch to add new patient form', async () => {
    const user = userEvent.setup()
    setupFetchMock()

    renderPage()

    await user.click(screen.getByRole('button', { name: /\+ Add new patient instead/i }))

    expect(await screen.findByText('New Patient Details')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
  })

  test('review button stays disabled for incomplete new patient details', async () => {
    const user = userEvent.setup()
    setupFetchMock()

    renderPage()

    await user.click(screen.getByRole('button', { name: /\+ Add new patient instead/i }))
    await user.type(screen.getByLabelText('Appointment date'), '2026-05-10')
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }))

    expect(screen.getByRole('button', { name: /Review Booking/i })).toBeDisabled()
  })

  test('review button stays disabled for invalid new patient email', async () => {
    const user = userEvent.setup()
    setupFetchMock()

    renderPage()

    await user.click(screen.getByRole('button', { name: /\+ Add new patient instead/i }))
    await user.type(screen.getByLabelText('Full name'), 'Amara Dlamini')
    await user.type(screen.getByLabelText('Email address'), 'not-an-email')
    await user.type(screen.getByLabelText('Appointment date'), '2026-05-10')
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }))

    expect(screen.getByRole('button', { name: /Review Booking/i })).toBeDisabled()
  })

  test('staff can complete booking flow for an existing patient', async () => {
    const user = userEvent.setup()
    setupFetchMock()

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Jane Doe' })).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Select existing patient'), 'patient-1')
    await user.type(screen.getByLabelText('Appointment date'), '2026-05-10')
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }))

    await user.click(screen.getByRole('button', { name: /Review Booking/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Confirm Appointment')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('Appointment Booked!')).toBeInTheDocument()
  })

  test('staff can complete booking flow for a new patient', async () => {
    const user = userEvent.setup()
    setupFetchMock()

    renderPage()

    await user.click(screen.getByRole('button', { name: /\+ Add new patient instead/i }))
    await user.type(screen.getByLabelText('Full name'), 'Amara Dlamini')
    await user.type(screen.getByLabelText('Email address'), 'amara@example.com')
    await user.type(screen.getByLabelText('Appointment date'), '2026-05-10')
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }))

    await user.click(screen.getByRole('button', { name: /Review Booking/i }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/patients'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    expect(await screen.findByText('Appointment Booked!')).toBeInTheDocument()
  })

  test('shows submit error when patient creation fails', async () => {
    const user = userEvent.setup()
    setupFetchMock({
      createPatientOk: false,
    })

    renderPage()

    await user.click(screen.getByRole('button', { name: /\+ Add new patient instead/i }))
    await user.type(screen.getByLabelText('Full name'), 'Amara Dlamini')
    await user.type(screen.getByLabelText('Email address'), 'amara@example.com')
    await user.type(screen.getByLabelText('Appointment date'), '2026-05-10')
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }))

    await user.click(screen.getByRole('button', { name: /Review Booking/i }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))

    const errors = await screen.findAllByText((text) =>
      text.includes('Failed to create patient')
    )

    expect(errors.length).toBeGreaterThan(0)
  })

  test('shows submit error when appointment booking fails', async () => {
    const user = userEvent.setup()
    setupFetchMock({
      appointmentOk: false,
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Jane Doe' })).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Select existing patient'), 'patient-1')
    await user.type(screen.getByLabelText('Appointment date'), '2026-05-10')
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }))

    await user.click(screen.getByRole('button', { name: /Review Booking/i }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))

    
      const errors = await screen.findAllByText((text) =>
  text.includes('Booking failed')
)

expect(errors.length).toBeGreaterThan(0)
  })
})