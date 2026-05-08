import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PatientDashboard from '../../pages/PatientDashboard'
import { useAuth } from '../../context/AuthContext'

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

function mockFetch({ clinics = [], error = false } = {}) {
  global.fetch = jest.fn(() => {
    if (error) {
      return Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({}),
      })
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({ clinics }),
    })
  })
}

const baseClinic = {
  id: 'clinic-1',
  name: 'Test Clinic',
  municipality: 'Cape Town',
  district: 'Metro',
  province: 'Western Cape',
  facility_type: 'Clinic',
  address: '123 Main Road',
  services: ['General Care', 'Vaccination'],
}

describe('PatientDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    useAuth.mockReturnValue({
      user: { id: 'patient-1' },
      loading: false,
    })

    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('shows loading state initially', async () => {
    mockFetch({ clinics: [] })

    render(<PatientDashboard />)

    expect(screen.getByText('Loading clinics…')).toBeInTheDocument()
  })

  test('shows empty state when no clinics match', async () => {
    mockFetch({ clinics: [] })

    render(<PatientDashboard />)

    expect(
      await screen.findByText('No clinics match your search. Try adjusting your filters.')
    ).toBeInTheDocument()
  })

  test('renders clinic data when available', async () => {
    mockFetch({ clinics: [baseClinic] })

    render(<PatientDashboard />)

    expect(await screen.findByText('Test Clinic')).toBeInTheDocument()
    expect(screen.getByText('Cape Town, Metro, Western Cape')).toBeInTheDocument()
    expect(screen.getByText('123 Main Road')).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: /Join queue at Test Clinic/i })
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: /Book appointment at Test Clinic/i })
    ).toBeInTheDocument()
  })

  test('renders clinic services when available', async () => {
    mockFetch({ clinics: [baseClinic] })

    render(<PatientDashboard />)

    const clinicCard = await screen.findByText('Test Clinic')

// get the actual card container
const card = clinicCard.closest('article')

expect(within(card).getByText('General Care')).toBeInTheDocument()
expect(within(card).getByText('Vaccination')).toBeInTheDocument()
  })

  test('navigates to queue when join button is clicked', async () => {
    const user = userEvent.setup()

    mockFetch({ clinics: [baseClinic] })

    render(<PatientDashboard />)

    await user.click(
      await screen.findByRole('button', { name: /Join queue at Test Clinic/i })
    )

    expect(mockNavigate).toHaveBeenCalledWith('/queue', {
      state: {
        clinic: expect.objectContaining({
          id: 'clinic-1',
          name: 'Test Clinic',
        }),
      },
    })
  })

  test('navigates to patient booking mode when book appointment button is clicked', async () => {
    const user = userEvent.setup()

    mockFetch({ clinics: [baseClinic] })

    render(<PatientDashboard />)

    await user.click(
      await screen.findByRole('button', { name: /Book appointment at Test Clinic/i })
    )

expect(mockNavigate).toHaveBeenCalledWith('/booking', {
  state: {
    clinic: expect.objectContaining({
      id: 'clinic-1',
      name: 'Test Clinic',
    }),
    bookingMode: 'patient',
    fromPage: 'Clinics',
    fromPath: '/clinic',
  },
})

  })

  test('filters clinics by search text', async () => {
    const user = userEvent.setup()

    mockFetch({
      clinics: [
        baseClinic,
        {
          id: 'clinic-2',
          name: 'Other Clinic',
          municipality: 'Durban',
          district: 'eThekwini',
          province: 'KwaZulu-Natal',
          facility_type: 'Hospital',
          address: '45 Beach Road',
          services: [],
        },
      ],
    })

    render(<PatientDashboard />)

    expect(await screen.findByText('Test Clinic')).toBeInTheDocument()
    expect(screen.getByText('Other Clinic')).toBeInTheDocument()

    await user.type(
      screen.getByPlaceholderText(/Name, municipality or address/i),
      'Cape Town'
    )

    expect(screen.getByText('Test Clinic')).toBeInTheDocument()
    expect(screen.queryByText('Other Clinic')).not.toBeInTheDocument()
  })

  test('filters clinics by province', async () => {
    const user = userEvent.setup()

    mockFetch({
      clinics: [
        {
          ...baseClinic,
          id: 'clinic-1',
          name: 'Cape Clinic',
          province: 'Western Cape',
        },
        {
          ...baseClinic,
          id: 'clinic-2',
          name: 'Durban Clinic',
          municipality: 'Durban',
          district: 'eThekwini',
          province: 'KwaZulu-Natal',
        },
      ],
    })

    render(<PatientDashboard />)

    expect(await screen.findByText('Cape Clinic')).toBeInTheDocument()
    expect(screen.getByText('Durban Clinic')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Province'), 'Western Cape')

    expect(screen.getByText('Cape Clinic')).toBeInTheDocument()
    expect(screen.queryByText('Durban Clinic')).not.toBeInTheDocument()
  })

  test('filters clinics by district', async () => {
    const user = userEvent.setup()

    mockFetch({
      clinics: [
        { ...baseClinic, id: 'clinic-1', name: 'Metro Clinic', district: 'Metro' },
        { ...baseClinic, id: 'clinic-2', name: 'Rural Clinic', district: 'Rural' },
      ],
    })

    render(<PatientDashboard />)

    expect(await screen.findByText('Metro Clinic')).toBeInTheDocument()
    expect(screen.getByText('Rural Clinic')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('District'), 'Metro')

    expect(screen.getByText('Metro Clinic')).toBeInTheDocument()
    expect(screen.queryByText('Rural Clinic')).not.toBeInTheDocument()
  })

  test('filters clinics by municipality', async () => {
    const user = userEvent.setup()

    mockFetch({
      clinics: [
        { ...baseClinic, id: 'clinic-1', name: 'Cape Clinic', municipality: 'Cape Town' },
        { ...baseClinic, id: 'clinic-2', name: 'Bellville Clinic', municipality: 'Bellville' },
      ],
    })

    render(<PatientDashboard />)

    expect(await screen.findByText('Cape Clinic')).toBeInTheDocument()
    expect(screen.getByText('Bellville Clinic')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Municipality'), 'Cape Town')

    expect(screen.getByText('Cape Clinic')).toBeInTheDocument()
    expect(screen.queryByText('Bellville Clinic')).not.toBeInTheDocument()
  })

  test('filters clinics by facility type', async () => {
    const user = userEvent.setup()

    mockFetch({
      clinics: [
        { ...baseClinic, id: 'clinic-1', name: 'Standard Clinic', facility_type: 'Clinic' },
        { ...baseClinic, id: 'clinic-2', name: 'Community Centre', facility_type: 'CHC' },
      ],
    })

    render(<PatientDashboard />)

    expect(await screen.findByText('Standard Clinic')).toBeInTheDocument()
    expect(screen.getByText('Community Centre')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Facility type'), 'Clinic')

    expect(screen.getByText('Standard Clinic')).toBeInTheDocument()
    expect(screen.queryByText('Community Centre')).not.toBeInTheDocument()
  })

  test('filters clinics by service', async () => {
    const user = userEvent.setup()

    mockFetch({
      clinics: [
        {
          ...baseClinic,
          id: 'clinic-1',
          name: 'Vaccination Clinic',
          services: ['Vaccination'],
        },
        {
          ...baseClinic,
          id: 'clinic-2',
          name: 'Dental Clinic',
          services: ['Dental Care'],
        },
      ],
    })

    render(<PatientDashboard />)

    expect(await screen.findByText('Vaccination Clinic')).toBeInTheDocument()
    expect(screen.getByText('Dental Clinic')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Service'), 'Vaccination')

    expect(screen.getByText('Vaccination Clinic')).toBeInTheDocument()
    expect(screen.queryByText('Dental Clinic')).not.toBeInTheDocument()
  })

  test('shows no matching clinics after filters remove all results', async () => {
    const user = userEvent.setup()

    mockFetch({ clinics: [baseClinic] })

    render(<PatientDashboard />)

    expect(await screen.findByText('Test Clinic')).toBeInTheDocument()

    await user.type(
      screen.getByPlaceholderText(/Name, municipality or address/i),
      'No matching clinic'
    )

    expect(
      screen.getByText('No clinics match your search. Try adjusting your filters.')
    ).toBeInTheDocument()
  })

  test('renders clinic even when optional fields are missing', async () => {
    mockFetch({
      clinics: [
        {
          id: 'clinic-1',
          name: 'Minimal Clinic',
          municipality: 'Cape Town',
          district: 'Metro',
          province: 'Western Cape',
          facility_type: 'Clinic',
        },
      ],
    })

    render(<PatientDashboard />)

    expect(await screen.findByText('Minimal Clinic')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Join queue at Minimal Clinic/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Book appointment at Minimal Clinic/i })
    ).toBeInTheDocument()
  })

  test('shows error message when clinic fetch fails', async () => {
    mockFetch({ error: true })

    render(<PatientDashboard />)

    expect(await screen.findByText(/Failed to load clinics/i)).toBeInTheDocument()
  })
})