import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

const staffAuth = {
  user: {
    id: 'staff-1',
    full_name: 'Staff User',
    email: 'staff@example.com',
  },
  role: 'Staff',
}

const patientAuth = {
  user: {
    id: 'patient-self',
    full_name: 'Patient User',
    email: 'patient@example.com',
  },
  role: 'Patient',
}

function renderPage({
  auth = staffAuth,
  locationState = {
    clinic,
    bookingMode: 'staff',
    fromPage: 'Staff',
    fromPath: '/staff',
  },
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
    { id: 'patient-2', full_name: 'John Smith', role: 'Patient' },
    { id: 'staff-2', full_name: 'Someone Staff', role: 'Staff' },
  ],
  slots = ['09:00', '09:30', '14:00'],
  patientsOk = true,
  patientsError = 'Failed to load users',
  slotsOk = true,
  slotsError = 'Failed to load slots',
  createPatientOk = true,
  createPatientResponse = {
    patient: {
      id: 'new-patient-row-1',
      user_id: 'new-patient-user-1',
      full_name: 'New Patient',
    },
  },
  createPatientError = 'Failed to create patient.',
  appointmentOk = true,
  appointmentResponse = {
    appointment: { id: 'appt-1' },
  },
  appointmentError = 'Booking failed.',
} = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    const urlString = String(url)
    const method = options.method || 'GET'

    if (urlString.includes('/api/users') && method === 'GET') {
      return Promise.resolve({
        ok: patientsOk,
        json: async () =>
          patientsOk ? { users } : { error: patientsError },
      })
    }

    if (urlString.includes('/api/appointments/slots') && method === 'GET') {
      return Promise.resolve({
        ok: slotsOk,
        json: async () =>
          slotsOk ? slots : { error: slotsError },
      })
    }

    if (urlString.includes('/api/patients') && method === 'POST') {
      return Promise.resolve({
        ok: createPatientOk,
        json: async () =>
          createPatientOk
            ? createPatientResponse
            : { error: createPatientError },
      })
    }

    if (urlString.includes('/api/appointments') && method === 'POST') {
      return Promise.resolve({
        ok: appointmentOk,
        json: async () =>
          appointmentOk
            ? appointmentResponse
            : { error: appointmentError },
      })
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    })
  })
}

async function chooseDate(date = '2099-05-10') {
  await userEvent.type(screen.getByLabelText('Appointment date'), date)
}

async function chooseSlot(name = '9:00 AM') {
  await userEvent.click(await screen.findByRole('button', { name }))
}

async function chooseExistingPatient(patientId = 'patient-1') {
  await waitFor(() => {
    expect(screen.getByRole('option', { name: /Jane Doe/i })).toBeInTheDocument()
  })

  await userEvent.selectOptions(
    screen.getByLabelText('Select existing patient'),
    patientId
  )
}

async function completeStaffExistingPatientBookingForm() {
  await chooseExistingPatient('patient-1')
  await chooseDate('2099-05-10')
  await chooseSlot('9:00 AM')
}

async function openConfirmationDialog() {
  await userEvent.click(screen.getByRole('button', { name: /review booking/i }))
  return screen.findByRole('dialog')
}

describe('BookingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    setupFetchMock()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('shows no clinic selected fallback and back button', async () => {
    renderPage({
      locationState: null,
    })

    expect(screen.getByText('No clinic selected')).toBeInTheDocument()
    expect(
      screen.getByText('Please go back and select a clinic before booking.')
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /back/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/clinic')
  })

  test('renders clinic details and initial empty slot state', () => {
    renderPage()

    expect(screen.getAllByText(/Hillbrow Clinic/i).length).toBeGreaterThan(0)

    expect(screen.getByText(/Region F/i)).toBeInTheDocument()
    expect(screen.getByText('Book an Appointment')).toBeInTheDocument()
    expect(screen.getByText('Pick a date first')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /review booking/i })).toBeDisabled()
  })

  test('back and cancel buttons navigate to staff page', async () => {
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /^← Back$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^Cancel$/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/staff')
    expect(mockNavigate).toHaveBeenCalledTimes(2)
  })

  test('fetches and displays staff patient dropdown options', async () => {
    renderPage()

    expect(await screen.findByRole('option', { name: /Jane Doe/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /John Smith/i })).toBeInTheDocument()

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/users',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      })
    )
  })

  test('logs patient fetch failure without blocking staff booking page', async () => {
    setupFetchMock({
      patientsOk: false,
      patientsError: 'Could not load patients.',
    })

    renderPage()

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch patients:',
        'Could not load patients.'
      )
    })

    expect(screen.getByText('Book an Appointment')).toBeInTheDocument()
  })

  test('loads future slots after selecting a date', async () => {
    renderPage()

    await chooseDate('2099-05-10')

    expect(await screen.findByRole('button', { name: '9:00 AM' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '9:30 AM' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2:00 PM' })).toBeInTheDocument()

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/appointments/slots?clinic_id=clinic-1&date=2099-05-10'
    )
  })

  test('shows slot API error when available slots fail to load', async () => {
    setupFetchMock({
      slotsOk: false,
      slotsError: 'Slots unavailable today.',
    })

    renderPage()

    await chooseDate('2099-05-10')

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load slots')
    expect(screen.getByText('Slots unavailable today.')).toBeInTheDocument()
  })

  test('shows no slots message when backend returns no future slots', async () => {
    setupFetchMock({
      slots: [],
    })

    renderPage()

    await chooseDate('2099-05-10')

    expect(await screen.findByText('No slots available')).toBeInTheDocument()
    expect(
      screen.getByText('There are no available appointment slots for this date. Please try another day.')
    ).toBeInTheDocument()
  })

  test('resets selected slot when date changes', async () => {
    renderPage()

    await chooseDate('2099-05-10')
    const firstSlot = await screen.findByRole('button', { name: '9:00 AM' })

    await userEvent.click(firstSlot)

    expect(firstSlot).toHaveAttribute('aria-pressed', 'true')

    fireEvent.change(screen.getByLabelText('Appointment date'), {
      target: { value: '2099-05-11' },
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /review booking/i })).toBeDisabled()
    })
  })

  test('cannot proceed to confirmation without selecting a slot', async () => {
    renderPage()

    await chooseExistingPatient('patient-1')
    await chooseDate('2099-05-10')

    expect(screen.getByRole('button', { name: /review booking/i })).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('cannot proceed to confirmation with missing staff patient data', async () => {
    renderPage()

    await chooseDate('2099-05-10')
    await chooseSlot('9:00 AM')

    expect(screen.getByRole('button', { name: /review booking/i })).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('opens confirmation popup when staff booking details are complete', async () => {
    renderPage()

    await completeStaffExistingPatientBookingForm()
    const dialog = await openConfirmationDialog()

    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('Confirm Appointment')).toBeInTheDocument()
  })

  test('shows selected staff booking details in confirmation popup', async () => {
    renderPage()

    await completeStaffExistingPatientBookingForm()
    const dialog = await openConfirmationDialog()

    expect(within(dialog).getByText('Hillbrow Clinic')).toBeInTheDocument()
    expect(within(dialog).getByText('Sunday, 10 May 2099')).toBeInTheDocument()
    expect(within(dialog).getByText('9:00 AM')).toBeInTheDocument()
    expect(within(dialog).getByText('Jane Doe')).toBeInTheDocument()
  })

  test('closes confirmation popup with dialog cancel button', async () => {
    renderPage()

    await completeStaffExistingPatientBookingForm()
    const dialog = await openConfirmationDialog()

    await userEvent.click(
      within(dialog).getByRole('button', { name: /^Cancel$/i })
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('submits a valid staff booking for an existing patient and shows success feedback', async () => {
    renderPage()

    await completeStaffExistingPatientBookingForm()
    await openConfirmationDialog()
    await userEvent.click(screen.getByRole('button', { name: /^Confirm$/i }))

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

  test('success page back button returns to staff page', async () => {
    renderPage()

    await completeStaffExistingPatientBookingForm()
    await openConfirmationDialog()
    await userEvent.click(screen.getByRole('button', { name: /^Confirm$/i }))

    expect(await screen.findByText('Appointment Booked!')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /back to staff/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/staff')
  })

  test('shows API error feedback when appointment booking fails', async () => {
    setupFetchMock({
      appointmentOk: false,
      appointmentError: 'Selected slot is already booked.',
    })

    renderPage()

    await completeStaffExistingPatientBookingForm()
    await openConfirmationDialog()
    await userEvent.click(screen.getByRole('button', { name: /^Confirm$/i }))

    expect(
      (await screen.findAllByText(/Selected slot is already booked/i)).length
    ).toBeGreaterThan(0)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Appointment Booked!')).not.toBeInTheDocument()
  })

  test('allows staff to switch to new patient form and back to existing patient dropdown', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', {
      name: /\+ Add new patient instead/i,
    }))

    expect(screen.getByText('New Patient Details')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Full name'), 'Temporary Patient')
    await userEvent.type(screen.getByLabelText('Email address'), 'temp@example.com')

    await userEvent.click(screen.getByRole('button', {
      name: /select existing patient instead/i,
    }))

    expect(screen.getByLabelText('Select existing patient')).toBeInTheDocument()
    expect(screen.queryByText('New Patient Details')).not.toBeInTheDocument()
  })

  test('new patient form keeps review disabled when name and email are missing', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', {
      name: /\+ Add new patient instead/i,
    }))

    await chooseDate('2099-05-10')
    await chooseSlot('9:00 AM')

    expect(screen.getByRole('button', { name: /review booking/i })).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('new patient form keeps review disabled for invalid email', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', {
      name: /\+ Add new patient instead/i,
    }))

    await userEvent.type(screen.getByLabelText('Full name'), 'Bad Email Patient')
    await userEvent.type(screen.getByLabelText('Email address'), 'bad-email')
    await chooseDate('2099-05-10')
    await chooseSlot('9:00 AM')

    expect(screen.getByRole('button', { name: /review booking/i })).toBeDisabled()
  })

  test('staff can create a new patient and book for that patient', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', {
      name: /\+ Add new patient instead/i,
    }))

    await userEvent.type(screen.getByLabelText('Full name'), 'New Patient')
    await userEvent.type(screen.getByLabelText('Email address'), 'new@example.com')
    await chooseDate('2099-05-10')
    await chooseSlot('9:00 AM')

    await openConfirmationDialog()

    expect(screen.getByText('New Patient')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Confirm$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/patients',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: 'New Patient',
            email: 'new@example.com',
            created_by: 'staff-1',
          }),
        })
      )
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/appointments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            clinic_id: 'clinic-1',
            patient_id: 'new-patient-user-1',
            date: '2099-05-10',
            time: '09:00',
            booked_by: 'staff-1',
            is_new_patient: true,
          }),
        })
      )
    })

    expect(await screen.findByText('Appointment Booked!')).toBeInTheDocument()
  })

  test('shows error when staff new patient creation fails', async () => {
    setupFetchMock({
      createPatientOk: false,
      createPatientError: 'Email already exists.',
    })

    renderPage()

    await userEvent.click(await screen.findByRole('button', {
      name: /\+ Add new patient instead/i,
    }))

    await userEvent.type(screen.getByLabelText('Full name'), 'Duplicate Patient')
    await userEvent.type(screen.getByLabelText('Email address'), 'duplicate@example.com')
    await chooseDate('2099-05-10')
    await chooseSlot('9:00 AM')

    await openConfirmationDialog()
    await userEvent.click(screen.getByRole('button', { name: /^Confirm$/i }))

    expect(
      (await screen.findAllByText(/Email already exists/i)).length
    ).toBeGreaterThan(0)

    expect(screen.queryByText('Appointment Booked!')).not.toBeInTheDocument()
  })

  test('shows missing patient information when new patient response has no user id', async () => {
    setupFetchMock({
      createPatientResponse: {
        patient: {
          id: 'new-patient-row-1',
          full_name: 'New Patient',
        },
      },
    })

    renderPage()

    await userEvent.click(await screen.findByRole('button', {
      name: /\+ Add new patient instead/i,
    }))

    await userEvent.type(screen.getByLabelText('Full name'), 'New Patient')
    await userEvent.type(screen.getByLabelText('Email address'), 'new@example.com')
    await chooseDate('2099-05-10')
    await chooseSlot('9:00 AM')

    await openConfirmationDialog()
    await userEvent.click(screen.getByRole('button', { name: /^Confirm$/i }))

    expect(
      (await screen.findAllByText(/Missing patient information/i)).length
    ).toBeGreaterThan(0)

    expect(screen.queryByText('Appointment Booked!')).not.toBeInTheDocument()
  })

  test('patient mode does not show staff patient selector and books for logged-in patient', async () => {
    renderPage({
      auth: patientAuth,
      locationState: {
        clinic,
        bookingMode: 'patient',
        fromPage: 'Clinics',
        fromPath: '/clinic',
      },
    })

    expect(screen.queryByLabelText('Select existing patient')).not.toBeInTheDocument()

    await chooseDate('2099-05-10')
    await chooseSlot('9:00 AM')
    await openConfirmationDialog()

    expect(screen.queryByText('Patient')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Confirm$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/appointments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            clinic_id: 'clinic-1',
            patient_id: 'patient-self',
            date: '2099-05-10',
            time: '09:00',
            booked_by: 'patient-self',
            is_new_patient: false,
          }),
        })
      )
    })

    expect(await screen.findByText('Appointment Booked!')).toBeInTheDocument()
  })

  test('patient mode requires logged-in user before proceeding', async () => {
    renderPage({
      auth: {
        user: null,
        role: 'Patient',
      },
      locationState: {
        clinic,
        bookingMode: 'patient',
      },
    })

    await chooseDate('2099-05-10')
    await chooseSlot('9:00 AM')

    expect(screen.getByRole('button', { name: /review booking/i })).toBeDisabled()
  })

  test('date input has today as minimum selectable date', () => {
    renderPage()

    const dateInput = screen.getByLabelText('Appointment date')

    expect(dateInput).toHaveAttribute('min')
    expect(dateInput.getAttribute('min')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  test('uses patient clinic fallback navigation when no fromPath is provided', async () => {
  renderPage({
    auth: patientAuth,
    locationState: {
      clinic,
      bookingMode: 'patient',
    },
  })

  await userEvent.click(screen.getByRole('button', { name: /^← Back$/i }))

  expect(mockNavigate).toHaveBeenCalledWith('/clinic')
})


test('closes confirmation popup when overlay is clicked', async () => {
  renderPage()

  await completeStaffExistingPatientBookingForm()
  const dialog = await openConfirmationDialog()

  fireEvent.click(dialog)

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('keeps confirmation popup open when dialog content is clicked', async () => {
  renderPage()

  await completeStaffExistingPatientBookingForm()
  const dialog = await openConfirmationDialog()

  fireEvent.click(within(dialog).getByText('Confirm Appointment'))

  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('shows default slot error when slot response is not ok and has no error message', async () => {
  setupFetchMock({
    slotsOk: false,
    slotsError: undefined,
  })

  renderPage()

  await chooseDate('2099-05-10')

  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load slots')
})

test('shows default booking failure when appointment response is not ok and has no error message', async () => {
  setupFetchMock({
    appointmentOk: false,
    appointmentError: undefined,
  })

  renderPage()

  await completeStaffExistingPatientBookingForm()
  await openConfirmationDialog()
  await userEvent.click(screen.getByRole('button', { name: /^Confirm$/i }))

  expect(
    (await screen.findAllByText(/Booking failed\./i)).length
  ).toBeGreaterThan(0)
})

test('uses default create patient failure message when new patient creation response has no error', async () => {
  setupFetchMock({
    createPatientOk: false,
    createPatientError: undefined,
  })

  renderPage()

  await userEvent.click(
    await screen.findByRole('button', { name: /\+ Add new patient instead/i })
  )

  await userEvent.type(screen.getByLabelText('Full name'), 'New Patient')
  await userEvent.type(screen.getByLabelText('Email address'), 'new@example.com')
  await chooseDate('2099-05-10')
  await chooseSlot('9:00 AM')

  await openConfirmationDialog()
  await userEvent.click(screen.getByRole('button', { name: /^Confirm$/i }))

  expect(
    (await screen.findAllByText(/Failed to create patient\./i)).length
  ).toBeGreaterThan(0)
})

})