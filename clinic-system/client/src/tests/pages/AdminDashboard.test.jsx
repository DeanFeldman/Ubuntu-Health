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
const adminId = '33333333-3333-3333-3333-333333333333'
const assignedStaffId = '44444444-4444-4444-4444-444444444444'

function makeClinics(overrides = {}) {
  return [
    {
      id: clinicId,
      name: 'Hillbrow Clinic',
      facility_type: 'Clinic',
      province: 'Gauteng',
      district: 'Johannesburg',
      municipality: 'Region F',
      services: ['General Consultation', 'HIV Testing'],
      appointment_duration_minutes: 15,
      operating_hours: {
        monday: { open: '08:00', close: '16:00' },
        tuesday: { open: '08:00', close: '16:00' },
        wednesday: { open: '08:00', close: '16:00' },
        thursday: { open: '08:00', close: '16:00' },
        friday: { open: '08:00', close: '16:00' },
        saturday: { open: '', close: '' },
        sunday: { open: '', close: '' },
      },
      ...overrides,
    },
  ]
}

function makeUsers() {
  return [
    {
      id: otherStaffId,
      full_name: 'Sam Staff',
      role: 'Staff',
      clinic_id: null,
    },
    {
      id: assignedStaffId,
      full_name: 'Assigned Staff',
      role: 'Staff',
      clinic_id: clinicId,
    },
    {
      id: adminId,
      full_name: 'Admin User',
      role: 'Admin',
      clinic_id: null,
    },
    {
      id: 'patient-1',
      full_name: 'Patient User',
      role: 'Patient',
      clinic_id: null,
    },
  ]
}

function makeRoleRequest(overrides = {}) {
  return {
    id: 'req-1',
    requested_role: 'Staff',
    created_at: '2026-01-01',
    users: {
      full_name: 'Test Admin',
      email: 'test@example.com',
      role: 'Patient',
    },
    ...overrides,
  }
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
  patchedClinic = null,
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
          JSON.stringify(
            approveOk ? {} : { error: 'Failed to approve role request' }
          ),
      })
    }

    if (urlString.includes('/role-requests/') && urlString.includes('/reject')) {
      return Promise.resolve({
        ok: rejectOk,
        text: async () =>
          JSON.stringify(
            rejectOk ? {} : { error: 'Failed to reject role request' }
          ),
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

    if (
      urlString.includes(`/api/users/${otherStaffId}/assign-clinic`) &&
      method === 'PATCH'
    ) {
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

    if (
      urlString.includes(`/api/users/${assignedStaffId}/unassign-clinic`) &&
      method === 'PATCH'
    ) {
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
                  clinic:
                    patchedClinic ||
                    {
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

async function openRoleRequestsSection() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /role requests/i }))
  return user
}

async function openClinicDetailsSection() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /clinic details/i }))
  return user
}

async function selectClinic(user) {
  await user.selectOptions(await screen.findByLabelText('Choose a clinic'), clinicId)
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

  test('shows overview section initially with summary counts', async () => {
    mockFetch({
      roleRequests: [makeRoleRequest()],
    })

    render(<AdminDashboard />)

    expect(screen.getByRole('button', { name: /^overview$/i })).toBeInTheDocument()
    expect(screen.getByText('Pending requests')).toBeInTheDocument()
    expect(screen.getByText('Unassigned staff')).toBeInTheDocument()

    await waitFor(() => {
  expect(screen.getAllByText('1').length).toBeGreaterThan(0)
})
  })



  test('shows empty state when no role requests exist', async () => {
    mockFetch({ roleRequests: [] })

    render(<AdminDashboard />)
    await openRoleRequestsSection()

    expect(await screen.findByText('No pending role requests.')).toBeInTheDocument()
    expect(screen.getByText('Everything is up to date for now.')).toBeInTheDocument()
  })

  test('renders role request data when available', async () => {
    mockFetch({
      roleRequests: [makeRoleRequest()],
    })

    render(<AdminDashboard />)
    await openRoleRequestsSection()

    expect(await screen.findByText('Test Admin')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('Patient')).toBeInTheDocument()
    expect(screen.getAllByText('Staff').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })

  test('uses fallback labels when role request user data is missing', async () => {
    mockFetch({
      roleRequests: [
        makeRoleRequest({
          users: null,
        }),
      ],
    })

    render(<AdminDashboard />)
    await openRoleRequestsSection()

    expect(await screen.findByText('Unknown user')).toBeInTheDocument()
    expect(screen.getByText('No email')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  test('approves a role request and removes it from the table', async () => {
    const user = userEvent.setup()

    mockFetch({
      roleRequests: [makeRoleRequest()],
    })

    render(<AdminDashboard />)
    await openRoleRequestsSection()

    await user.click(await screen.findByRole('button', { name: 'Approve' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/approve'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ admin_id: adminId }),
        })
      )
    })

    expect(await screen.findByText('Role request approved.')).toBeInTheDocument()
    expect(screen.queryByText('Test Admin')).not.toBeInTheDocument()
  })

  test('rejects a role request and removes it from the table', async () => {
    const user = userEvent.setup()

    mockFetch({
      roleRequests: [makeRoleRequest()],
    })

    render(<AdminDashboard />)
    await openRoleRequestsSection()

    await user.click(await screen.findByRole('button', { name: 'Reject' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/reject'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ admin_id: adminId }),
        })
      )
    })

    expect(await screen.findByText('Role request rejected.')).toBeInTheDocument()
    expect(screen.queryByText('Test Admin')).not.toBeInTheDocument()
  })

  test('shows role request loading error', async () => {
    mockFetch({ roleError: 'Failed to load role requests' })

    render(<AdminDashboard />)
    await openRoleRequestsSection()

    expect(await screen.findByText('Failed to load role requests')).toBeInTheDocument()
  })

  test('shows feedback when approving a role request fails', async () => {
    const user = userEvent.setup()

    mockFetch({
      approveOk: false,
      roleRequests: [makeRoleRequest()],
    })

    render(<AdminDashboard />)
    await openRoleRequestsSection()

    await user.click(await screen.findByRole('button', { name: 'Approve' }))

    expect(await screen.findByText('Failed to approve role request')).toBeInTheDocument()
    expect(screen.getByText('Test Admin')).toBeInTheDocument()
  })

  test('shows feedback when rejecting a role request fails', async () => {
    const user = userEvent.setup()

    mockFetch({
      rejectOk: false,
      roleRequests: [makeRoleRequest()],
    })

    render(<AdminDashboard />)
    await openRoleRequestsSection()

    await user.click(await screen.findByRole('button', { name: 'Reject' }))

    expect(await screen.findByText('Failed to reject role request')).toBeInTheDocument()
    expect(screen.getByText('Test Admin')).toBeInTheDocument()
  })

  test('shows clinic empty state before a clinic is selected', async () => {
    mockFetch()

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    expect(await screen.findByText('Select a clinic to get started')).toBeInTheDocument()
    expect(screen.queryByText('Edit clinic')).not.toBeInTheDocument()
  })

  test('shows clinic configuration when a clinic is selected', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

    expect(await screen.findByDisplayValue('Clinic')).toBeInTheDocument()
    expect(screen.getByDisplayValue('General Consultation, HIV Testing')).toBeInTheDocument()
    expect(screen.getByDisplayValue('15')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unassign' })).toBeInTheDocument()
  })

  test('normalises string operating hours when selecting a clinic', async () => {
    const user = userEvent.setup()

    mockFetch({
      clinics: makeClinics({
        operating_hours: {
          monday: '08:30 - 15:30',
          tuesday: 'closed',
        },
      }),
    })

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

    expect(await screen.findByLabelText(/monday opening time/i)).toHaveValue('08:30')
    expect(screen.getByLabelText(/monday closing time/i)).toHaveValue('15:30')
    expect(screen.getByLabelText(/tuesday opening time/i)).toBeDisabled()
    expect(screen.getByLabelText(/tuesday closing time/i)).toBeDisabled()
  })

  test('shows empty assigned staff state correctly', async () => {
    const user = userEvent.setup()

    mockFetch({
      users: [
        {
          id: otherStaffId,
          full_name: 'Sam Staff',
          role: 'Staff',
          clinic_id: null,
        },
      ],
    })

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

    expect(await screen.findByText('No staff assigned yet.')).toBeInTheDocument()
  })

  test('filters non-staff users out of staff assignment dropdown', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

    expect(screen.getByRole('option', { name: 'Sam Staff' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Admin User' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Patient User' })).not.toBeInTheDocument()
  })

  test('disables add staff button until a staff member is selected', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

    expect(screen.getByRole('button', { name: 'Add staff' })).toBeDisabled()
  })

  test('assigns staff to a clinic and shows confirmation', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)
    await user.selectOptions(screen.getByLabelText('Add staff member'), otherStaffId)
    await user.click(screen.getByRole('button', { name: 'Add staff' }))

    expect(await screen.findByText('Sam Staff assigned to Hillbrow Clinic')).toBeInTheDocument()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/users/${otherStaffId}/assign-clinic`),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            admin_id: adminId,
            clinic_id: clinicId,
          }),
        })
      )
    })
  })

  test('shows assign staff error feedback when backend rejects assignment', async () => {
    const user = userEvent.setup()
    mockFetch({ assignOk: false, assignError: 'Selected user is not staff' })

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)
    await user.selectOptions(screen.getByLabelText('Add staff member'), otherStaffId)
    await user.click(screen.getByRole('button', { name: 'Add staff' }))

    expect(await screen.findByText('Selected user is not staff')).toBeInTheDocument()
  })

  test('unassigns staff from a clinic and updates the staff list', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

    expect(screen.getByText('Assigned Staff')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Unassign' }))

    expect(await screen.findByText('Assigned Staff unassigned from clinic')).toBeInTheDocument()
    expect(await screen.findByText('No staff assigned yet.')).toBeInTheDocument()
  })

  test('shows unassign error feedback when backend rejects removal', async () => {
    const user = userEvent.setup()
    mockFetch({
      unassignOk: false,
      unassignError: 'Staff member is not assigned to a clinic',
    })

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)
    await user.click(await screen.findByRole('button', { name: 'Unassign' }))

    expect(
      await screen.findByText('Staff member is not assigned to a clinic')
    ).toBeInTheDocument()
  })

  test('allows editing clinic location and profile fields', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

    const nameInput = screen.getByLabelText('Name')
    const provinceInput = screen.getByLabelText('Province')
    const districtInput = screen.getByLabelText('District')
    const municipalityInput = screen.getByLabelText('Municipality')

    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Hillbrow Clinic')

    await user.clear(provinceInput)
    await user.type(provinceInput, 'Western Cape')

    await user.clear(districtInput)
    await user.type(districtInput, 'Cape Town')

    await user.clear(municipalityInput)
    await user.type(municipalityInput, 'Metro')

    expect(nameInput).toHaveValue('Updated Hillbrow Clinic')
    expect(provinceInput).toHaveValue('Western Cape')
    expect(districtInput).toHaveValue('Cape Town')
    expect(municipalityInput).toHaveValue('Metro')
  })

  test('disables time inputs when a day is marked closed', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

    const mondayClosed = screen.getAllByLabelText(/closed/i)[0]
    const mondayOpen = screen.getByLabelText(/monday opening time/i)
    const mondayClose = screen.getByLabelText(/monday closing time/i)

    expect(mondayOpen).not.toBeDisabled()
    expect(mondayClose).not.toBeDisabled()

    await user.click(mondayClosed)

    expect(mondayOpen).toBeDisabled()
    expect(mondayClose).toBeDisabled()
  })

  test('re-enables operating hours when a closed day is reopened', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

    const saturdayClosed = screen.getAllByLabelText(/closed/i)[5]
    const saturdayOpen = screen.getByLabelText(/saturday opening time/i)
    const saturdayClose = screen.getByLabelText(/saturday closing time/i)

    expect(saturdayOpen).toBeDisabled()
    expect(saturdayClose).toBeDisabled()

    await user.click(saturdayClosed)

    expect(saturdayOpen).not.toBeDisabled()
    expect(saturdayClose).not.toBeDisabled()

    await user.type(saturdayOpen, '09:00')
    await user.type(saturdayClose, '12:00')

    expect(saturdayOpen).toHaveValue('09:00')
    expect(saturdayClose).toHaveValue('12:00')
  })

  test('saves clinic changes with formatted services, duration, and operating hours', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

    await user.clear(screen.getByLabelText('Facility type'))
    await user.type(screen.getByLabelText('Facility type'), 'Hospital')

    await user.clear(document.querySelector('#appointment-duration'))
    await user.type(document.querySelector('#appointment-duration'), '20')

    const servicesInput = screen.getByPlaceholderText(
      'Separate services with commas or new lines'
    )

    await user.clear(servicesInput)
    await user.type(servicesInput, 'General Consultation, TB Treatment')

    const mondayClosingTime = screen.getByLabelText(/monday closing time/i)
    await user.clear(mondayClosingTime)
    await user.type(mondayClosingTime, '17:00')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Clinic updated successfully.')).toBeInTheDocument()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:8080/api/clinics/${clinicId}`,
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"appointment_duration_minutes":20'),
        })
      )
    })

    const patchCall = global.fetch.mock.calls.find(([url, options]) => {
      return (
        String(url).includes(`/api/clinics/${clinicId}`) &&
        options?.method === 'PATCH'
      )
    })

    const payload = JSON.parse(patchCall[1].body)

    expect(payload).toEqual(
      expect.objectContaining({
        admin_id: adminId,
        facility_type: 'Hospital',
        appointment_duration_minutes: 20,
        services: ['General Consultation', 'TB Treatment'],
      })
    )

    expect(payload.operating_hours.monday).toEqual({
      open: '08:00',
      close: '17:00',
    })
  })

  test('saves blank appointment duration as null', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

    const durationInput = document.querySelector('#appointment-duration')
    await user.clear(durationInput)

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Clinic updated successfully.')).toBeInTheDocument()

    const patchCall = global.fetch.mock.calls.find(([url, options]) => {
      return (
        String(url).includes(`/api/clinics/${clinicId}`) &&
        options?.method === 'PATCH'
      )
    })

    const payload = JSON.parse(patchCall[1].body)

    expect(payload.appointment_duration_minutes).toBeNull()
  })

  test('shows clinic update error feedback when backend rejects invalid services', async () => {
    const user = userEvent.setup()
    mockFetch({
      patchClinicOk: false,
      patchClinicError: 'Invalid services list',
    })

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

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
    mockFetch({
      patchClinicOk: false,
      patchClinicError: 'Invalid operating hours',
    })

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

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
    await openClinicDetailsSection()

    const clinicSelect = await screen.findByLabelText('Choose a clinic')

    await user.selectOptions(clinicSelect, clinicId)
    await user.selectOptions(screen.getByLabelText('Add staff member'), otherStaffId)
    await user.click(screen.getByRole('button', { name: 'Add staff' }))

    expect(await screen.findByText('Sam Staff assigned to Hillbrow Clinic')).toBeInTheDocument()

    await user.selectOptions(clinicSelect, '')
    await user.selectOptions(clinicSelect, clinicId)

    expect(screen.queryByText('Sam Staff assigned to Hillbrow Clinic')).not.toBeInTheDocument()
  })

  test('shows read-only clinic location fields for the selected clinic', async () => {
    const user = userEvent.setup()
    mockFetch()

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    await selectClinic(user)

    expect(screen.getByDisplayValue('Gauteng')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Johannesburg')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Region F')).toBeInTheDocument()
  })

  test('shows error when clinics fail to load', async () => {
    mockFetch({ clinicsError: 'Failed to load clinics' })

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    expect(await screen.findByText('Failed to load clinics')).toBeInTheDocument()
  })

  test('shows error when users fail to load', async () => {
    mockFetch({ usersError: 'Failed to load users' })

    render(<AdminDashboard />)
    await openClinicDetailsSection()

    expect(await screen.findByText('Failed to load users')).toBeInTheDocument()
  })

  test('shows API route not found when server returns html', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        text: async () => '<html>Not found</html>',
      })
    )

    render(<AdminDashboard />)
    await openRoleRequestsSection()

    const alerts = await screen.findAllByRole('alert')

    expect(
      alerts.some((element) => element.textContent.includes('API route not found'))
    ).toBe(true)
  })

  test('shows invalid JSON error when server returns plain text', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        text: async () => 'not-json-response',
      })
    )

    render(<AdminDashboard />)
    await openRoleRequestsSection()

    const alerts = await screen.findAllByRole('alert')

    expect(
      alerts.some((element) =>
        element.textContent.includes('Server did not return valid JSON')
      )
    ).toBe(true)
  })

  test('does not fetch dashboard data when there is no logged-in user id', () => {
    useAuth.mockReturnValue({ user: null })
    global.fetch = jest.fn()

    render(<AdminDashboard />)

    expect(global.fetch).not.toHaveBeenCalled()
  })
})