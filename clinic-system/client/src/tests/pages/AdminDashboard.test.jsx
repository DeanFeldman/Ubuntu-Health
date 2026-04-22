import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminDashboard from '../../pages/AdminDashboard'
import { useAuth } from '../../context/AuthContext'
import getApiBase from '../../lib/getApiBase'

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../lib/getApiBase', () => jest.fn())

const clinicId = '11111111-1111-1111-1111-111111111111'
const otherStaffId = '22222222-2222-2222-2222-222222222222'
const assignedStaffId = '44444444-4444-4444-4444-444444444444'
const adminId = '33333333-3333-3333-3333-333333333333'
//create data we will use in our tests - a clinic and some users (one assigned staff, one unassigned staff and one admin)

function makeClinics() {
  return [
    {
      id: clinicId,
      name: 'Hillbrow Clinic',
      facility_type: 'Clinic',
      province: 'Gauteng',
      district: 'Johannesburg',
      municipality: 'Region F',
      services: ['General Consultation', 'HIV Testing'],
      operating_hours: {
        monday: { open: '08:00', close: '16:00' },
        tuesday: { open: '08:00', close: '16:00' },
        wednesday: { open: '08:00', close: '16:00' },
        thursday: { open: '08:00', close: '16:00' },
        friday: { open: '08:00', close: '16:00' },
        saturday: { open: '', close: '' },
        sunday: { open: '', close: '' },
      },
    },
  ]
}

function makeUsers() {
  return [
    {
      id: otherStaffId,
      full_name: 'Sam Staff',
      role: 'Clinic Staff',
      clinic_id: null,
    },
    {
      id: assignedStaffId,
      full_name: 'Assigned Staff',
      role: 'Clinic Staff',
      clinic_id: clinicId,
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      full_name: 'Admin User',
      role: 'Admin',
      clinic_id: null,
    },
  ]
}

function mockFetch({
  roleRequests = [],
  roleError = null,
  clinics = makeClinics(),
  users = makeUsers(),
  clinicsError = null,
  usersError = null,
  approveOk = true,
  rejectOk = true,
  assignOk = true,
  assignError = 'Failed to assign staff to clinic',
  unassignOk = true,
  unassignError = 'Failed to unassign staff from clinic',
  patchClinicOk = true,
  patchClinicError = 'Failed to update clinic',
} = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    const method = options.method || 'GET'
    const urlString = String(url)

    if (
      urlString.includes('/role-requests?') &&
      !urlString.includes('/approve') &&
      !urlString.includes('/reject')
    ) {
      if (roleError) {
        return Promise.resolve({
          ok: false,
          text: async () => JSON.stringify({ error: roleError }),
        })
      }

      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ requests: roleRequests }),
      })
    }

    if (urlString.includes('/role-requests/') && urlString.includes('/approve')) {
      return Promise.resolve({
        ok: approveOk,
        text: async () =>
          JSON.stringify(approveOk ? {} : { error: 'Failed to approve role request' }),
      })
    }

    if (urlString.includes('/role-requests/') && urlString.includes('/reject')) {
      return Promise.resolve({
        ok: rejectOk,
        text: async () =>
          JSON.stringify(rejectOk ? {} : { error: 'Failed to reject role request' }),
      })
    }

    if (urlString.endsWith('/api/clinics') && method === 'GET') {
      if (clinicsError) {
        return Promise.resolve({
          ok: false,
          text: async () => JSON.stringify({ error: clinicsError }),
        })
      }

      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ clinics }),
      })
    }

    if (urlString.endsWith('/api/users') && method === 'GET') {
      if (usersError) {
        return Promise.resolve({
          ok: false,
          text: async () => JSON.stringify({ error: usersError }),
        })
      }

      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ users }),
      })
    }

    if (urlString.includes(`/api/users/${otherStaffId}/assign-clinic`) && method === 'PATCH') {
      return Promise.resolve({
        ok: assignOk,
        text: async () =>
          JSON.stringify(
            assignOk
              ? { message: 'Sam Staff assigned to Hillbrow Clinic' }
              : { error: assignError }
          ),
      })
    }

    if (urlString.includes(`/api/users/${assignedStaffId}/unassign-clinic`) && method === 'PATCH') {
      return Promise.resolve({
        ok: unassignOk,
        text: async () =>
          JSON.stringify(
            unassignOk
              ? { message: 'Assigned Staff unassigned from clinic' }
              : { error: unassignError }
          ),
      })
    }

    if (urlString.includes(`/api/clinics/${clinicId}`) && method === 'PATCH') {
      return Promise.resolve({
        ok: patchClinicOk,
        text: async () =>
          JSON.stringify(
            patchClinicOk
              ? {
                  clinic: {
                    ...clinics[0],
                    facility_type: 'Hospital',
                    services: ['General Consultation', 'TB Treatment'],
                    operating_hours: clinics[0].operating_hours,
                  },
                }
              : { error: patchClinicError }
          ),
      })
    }

    return Promise.resolve({
      ok: true,
      text: async () => JSON.stringify({}),
    })
  })
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    useAuth.mockReturnValue({
      user: { id: adminId },
    })

    getApiBase.mockReturnValue('http://localhost:8080')

    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('shows loading state initially', () => {
    mockFetch()

    render(<AdminDashboard />)

    expect(screen.getByText('Loading role requests...')).toBeInTheDocument()
  })

  test('shows empty state when no role requests', async () => {
    mockFetch({ roleRequests: [] })

    render(<AdminDashboard />)

    expect(await screen.findByText('No pending role requests.')).toBeInTheDocument()
  })

  test('renders role request data when available', async () => {
    mockFetch({
      roleRequests: [
        {
          id: 'req-1',
          requested_role: 'Staff',
          created_at: '2026-01-01',
          users: {
            full_name: 'Test Admin',
            email: 'test@example.com',
            role: 'Patient',
          },
        },
      ],
    })

    render(<AdminDashboard />)

    expect(await screen.findByText('Test Admin')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('Patient')).toBeInTheDocument()
    expect(screen.getAllByText('Staff').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })

  test('approves a role request', async () => {
    const user = userEvent.setup()

    mockFetch({
      roleRequests: [
        {
          id: 'req-1',
          requested_role: 'Staff',
          created_at: '2026-01-01',
          users: {
            full_name: 'Test Admin',
            email: 'test@example.com',
            role: 'Patient',
          },
        },
      ],
    })

    render(<AdminDashboard />)

    const approveBtn = await screen.findByRole('button', { name: 'Approve' })
    await user.click(approveBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/approve'),
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })

    expect(await screen.findByText('Role request approved.')).toBeInTheDocument()
  })

  test('rejects a role request', async () => {
    const user = userEvent.setup()

    mockFetch({
      roleRequests: [
        {
          id: 'req-1',
          requested_role: 'Staff',
          created_at: '2026-01-01',
          users: {
            full_name: 'Test Admin',
            email: 'test@example.com',
            role: 'Patient',
          },
        },
      ],
    })

    render(<AdminDashboard />)

    const rejectBtn = await screen.findByRole('button', { name: 'Reject' })
    await user.click(rejectBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/reject'),
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })

    expect(await screen.findByText('Role request rejected.')).toBeInTheDocument()
  })

  test('shows error message when role requests API fails', async () => {
    mockFetch({ roleError: 'Failed to load role requests' })

    render(<AdminDashboard />)

    expect(await screen.findByText('Failed to load role requests')).toBeInTheDocument()
  })

  test('shows clinic empty state before a clinic is selected', async () => {
    mockFetch()

    render(<AdminDashboard />)

    expect(await screen.findByText('Select a clinic to get started')).toBeInTheDocument()
    expect(screen.queryByText('Edit clinic')).not.toBeInTheDocument()
  })

  test('shows clinic configuration when a clinic is selected', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)

    const clinicSelect = await screen.findByLabelText('Choose a clinic')
    await user.selectOptions(clinicSelect, clinicId)

    expect(await screen.findByDisplayValue('Clinic')).toBeInTheDocument()
    expect(screen.getByDisplayValue('General Consultation, HIV Testing')).toBeInTheDocument()
    expect(screen.getByText('Assigned Staff')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unassign' })).toBeInTheDocument()
  })

  test('shows empty assigned staff state correctly', async () => {
    const user = userEvent.setup()

    mockFetch({
      users: [
        {
          id: otherStaffId,
          full_name: 'Sam Staff',
          role: 'Clinic Staff',
          clinic_id: null,
        },
      ],
    })

    render(<AdminDashboard />)

    const clinicSelect = await screen.findByLabelText('Choose a clinic')
    await user.selectOptions(clinicSelect, clinicId)

    expect(await screen.findByText('No staff assigned yet.')).toBeInTheDocument()
  })

  test('disables add staff button until a staff member is selected', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)

    await user.selectOptions(await screen.findByLabelText('Choose a clinic'), clinicId)

    expect(screen.getByRole('button', { name: 'Add staff' })).toBeDisabled()
  })

  test('assigns staff to a clinic and shows confirmation', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)

    await user.selectOptions(await screen.findByLabelText('Choose a clinic'), clinicId)
    await user.selectOptions(screen.getByLabelText('Add staff member'), otherStaffId)
    await user.click(screen.getByRole('button', { name: 'Add staff' }))

    expect(await screen.findByText('Sam Staff assigned to Hillbrow Clinic')).toBeInTheDocument()
  })

  test('shows assign staff error feedback when backend rejects assignment', async () => {
    const user = userEvent.setup()
    mockFetch({ assignOk: false, assignError: 'Selected user is not staff' })

    render(<AdminDashboard />)

    await user.selectOptions(await screen.findByLabelText('Choose a clinic'), clinicId)
    await user.selectOptions(screen.getByLabelText('Add staff member'), otherStaffId)
    await user.click(screen.getByRole('button', { name: 'Add staff' }))

    expect(await screen.findByText('Selected user is not staff')).toBeInTheDocument()
  })

  test('unassigns staff from a clinic and shows confirmation', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)

    await user.selectOptions(await screen.findByLabelText('Choose a clinic'), clinicId)
    await user.click(await screen.findByRole('button', { name: 'Unassign' }))

    expect(await screen.findByText('Assigned Staff unassigned from clinic')).toBeInTheDocument()
  })

  test('shows unassign error feedback when backend rejects removal', async () => {
    const user = userEvent.setup()
    mockFetch({ unassignOk: false, unassignError: 'Staff member is not assigned to a clinic' })

    render(<AdminDashboard />)

    await user.selectOptions(await screen.findByLabelText('Choose a clinic'), clinicId)
    await user.click(await screen.findByRole('button', { name: 'Unassign' }))

    expect(await screen.findByText('Staff member is not assigned to a clinic')).toBeInTheDocument()
  })

  test('allows editing clinic name field', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)

    await user.selectOptions(await screen.findByLabelText('Choose a clinic'), clinicId)

    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Hillbrow Clinic')

    expect(nameInput).toHaveValue('Updated Hillbrow Clinic')
  })

  test('disables time inputs when a day is marked closed', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)

    await user.selectOptions(await screen.findByLabelText('Choose a clinic'), clinicId)

    const mondayClosed = screen.getAllByLabelText(/closed/i)[0]
    const mondayOpen = screen.getByLabelText(/monday opening time/i)
    const mondayClose = screen.getByLabelText(/monday closing time/i)

    expect(mondayOpen).not.toBeDisabled()
    expect(mondayClose).not.toBeDisabled()

    await user.click(mondayClosed)

    expect(mondayOpen).toBeDisabled()
    expect(mondayClose).toBeDisabled()
  })

  test('shows clinic update success feedback and updated values', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)

    await user.selectOptions(await screen.findByLabelText('Choose a clinic'), clinicId)

    await user.clear(screen.getByLabelText('Facility type'))
    await user.type(screen.getByLabelText('Facility type'), 'Hospital')

    const servicesInput = screen.getByPlaceholderText(
      'Separate services with commas or new lines'
    )
    await user.clear(servicesInput)
    await user.type(servicesInput, 'General Consultation, TB Treatment')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Clinic updated successfully.')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Hospital')).toBeInTheDocument()
    })
  })

  test('shows clinic update error feedback when backend rejects invalid services', async () => {
    const user = userEvent.setup()
    mockFetch({ patchClinicOk: false, patchClinicError: 'Invalid services list' })

    render(<AdminDashboard />)

    await user.selectOptions(await screen.findByLabelText('Choose a clinic'), clinicId)

    const servicesInput = screen.getByPlaceholderText(
      'Separate services with commas or new lines'
    )
    await user.clear(servicesInput)
    await user.type(servicesInput, '@@@')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Invalid services list')).toBeInTheDocument()
  })

  test('shows clinic update error feedback when backend rejects invalid operating hours', async () => {
    const user = userEvent.setup()
    mockFetch({ patchClinicOk: false, patchClinicError: 'Invalid operating hours' })

    render(<AdminDashboard />)

    await user.selectOptions(await screen.findByLabelText('Choose a clinic'), clinicId)

    const mondayClosingTime = screen.getByLabelText(/monday closing time/i)
    await user.clear(mondayClosingTime)
    await user.type(mondayClosingTime, '07:00')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Invalid operating hours')).toBeInTheDocument()
  })

  test('changing clinic selection clears previous feedback messages', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)

    const clinicSelect = await screen.findByLabelText('Choose a clinic')
    await user.selectOptions(clinicSelect, clinicId)
    await user.selectOptions(screen.getByLabelText('Add staff member'), otherStaffId)
    await user.click(screen.getByRole('button', { name: 'Add staff' }))

    expect(await screen.findByText('Sam Staff assigned to Hillbrow Clinic')).toBeInTheDocument()

    await user.selectOptions(clinicSelect, '')
    await user.selectOptions(clinicSelect, clinicId)

    expect(screen.queryByText('Sam Staff assigned to Hillbrow Clinic')).not.toBeInTheDocument()
  })

  test('shows API route not found when server returns html', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        text: async () => '<html>Not found</html>',
      })
    )

    render(<AdminDashboard />)

    const alerts = await screen.findAllByRole('alert')
expect(alerts.some(el => el.textContent.includes('API route not found'))).toBe(true)
  })

  test('shows error when clinics fail to load', async () => {
    mockFetch({ clinicsError: 'Failed to load clinics' })

    render(<AdminDashboard />)

    expect(await screen.findByText('Failed to load clinics')).toBeInTheDocument()
  })

  test('shows error when users fail to load', async () => {
    mockFetch({ usersError: 'Failed to load users' })

    render(<AdminDashboard />)

    expect(await screen.findByText('Failed to load users')).toBeInTheDocument()
  })
})