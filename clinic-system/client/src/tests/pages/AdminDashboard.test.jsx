import { render, screen, waitFor, within } from '@testing-library/react'
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
function makeNoShowReport(overrides = {}) {
  return {
    filters: {
      clinic_id: null,
      clinic_name: 'All clinics',
      start_date: null,
      end_date: null,
      date_range_label: 'All time',
    },
    summary: {
      scheduled_appointments: 10,
      completed_appointments: 6,
      cancelled_appointments: 1,
      no_show_appointments: 3,
      no_show_rate_percent: 30,
    },
    by_clinic: [
      {
        clinic_id: clinicId,
        clinic_name: 'Hillbrow Clinic',
        scheduled_appointments: 10,
        completed_appointments: 6,
        cancelled_appointments: 1,
        no_show_appointments: 3,
        no_show_rate_percent: 30,
      },
    ],
    ...overrides,
  }
}

function makeWaitTimeReport() {
  return {
    filters: {
      clinic_id: null,
      clinic_name: 'All clinics',
      start_date: null,
      end_date: null,
      date_range_label: 'All time',
    },
    summary: {
      overall_average_wait_time_minutes: null,
      queue_records_used: 0,
    },
    by_clinic: [],
    by_time_of_day: [],
  }
}
function makePopulatedWaitTimeReport(overrides = {}) {
  return {
    filters: {
      clinic_id: null,
      clinic_name: 'All clinics',
      start_date: null,
      end_date: null,
      date_range_label: 'All time',
    },
    summary: {
      overall_average_wait_time_minutes: 42,
      queue_records_used: 5,
    },
    by_clinic: [
      {
        clinic_id: clinicId,
        clinic_name: 'Hillbrow Clinic',
        average_wait_time_minutes: 42,
        queue_records_used: 5,
      },
    ],
    by_time_of_day: [
      {
        time_of_day: 'Morning',
        average_wait_time_minutes: 30,
        queue_records_used: 2,
      },
      {
        time_of_day: 'Afternoon',
        average_wait_time_minutes: 55,
        queue_records_used: 3,
      },
      {
        time_of_day: 'Evening',
        average_wait_time_minutes: null,
        queue_records_used: 0,
      },
      {
        time_of_day: 'Night',
        average_wait_time_minutes: null,
        queue_records_used: 0,
      },
    ],
    ...overrides,
  }
}
function makeCustomAppointmentReport(overrides = {}) {
  return {
    report_type: 'appointments',
    filters: {
      clinic_id: null,
      clinic_name: 'All clinics',
      start_date: null,
      end_date: null,
      date_range_label: 'All time',
      status: null,
      status_label: 'All statuses',
    },
    total_records: 1,
    records: [
      {
        id: 'appointment-1',
        patient_name: 'Jane Patient',
        clinic_id: clinicId,
        clinic_name: 'Hillbrow Clinic',
        appointment_date: '2026-05-11',
        appointment_time: '10:00',
        appointment_status: 'Confirmed',
        service: 'General Consultation',
      },
    ],
    ...overrides,
  }
}

function makeCustomQueueReport(overrides = {}) {
  return {
    report_type: 'queue',
    filters: {
      clinic_id: null,
      clinic_name: 'All clinics',
      start_date: null,
      end_date: null,
      date_range_label: 'All time',
      status: null,
      status_label: 'All statuses',
    },
    total_records: 1,
    records: [
      {
        id: 'queue-1',
        patient_name: 'Queue Patient',
        clinic_id: clinicId,
        clinic_name: 'Hillbrow Clinic',
        queue_position: 2,
        queue_status: 'Complete',
        joined_at: '2026-05-11T08:00:00.000Z',
        completed_at: '2026-05-11T08:45:00.000Z',
      },
    ],
    ...overrides,
  }
}
function mockFetch({
  roleRequests = [],
  roleError = null,
  clinics = makeClinics(),
  users = makeUsers(),
  noShowReport = makeNoShowReport(),
  noShowError = null,
  customReport = makeCustomAppointmentReport(),
  customReportError = null,
  waitTimeReport = makeWaitTimeReport(),
  waitTimeError = null,
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
    if (urlString.includes('/api/reports/no-shows')) {
  if (noShowError) {
    return Promise.resolve({
      ok: false,
      text: async () => JSON.stringify({ error: noShowError }),
    })
  }

  return Promise.resolve({
    ok: true,
    text: async () => JSON.stringify(noShowReport),
  })
}
if (urlString.includes('/api/reports/custom')) {
  if (customReportError) {
    return Promise.resolve({
      ok: false,
      text: async () => JSON.stringify({ error: customReportError }),
    })
  }

  return Promise.resolve({
    ok: true,
    text: async () => JSON.stringify(customReport),
  })
}
if (urlString.includes('/api/reports/average-wait-time')) {
  if (waitTimeError) {
    return Promise.resolve({
      ok: false,
      text: async () => JSON.stringify({ error: waitTimeError }),
    })
  }

  return Promise.resolve({
    ok: true,
    text: async () => JSON.stringify(waitTimeReport),
  })
}

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
async function openAnalyticsSection() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /analytics/i }))
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
   test('displays returned no-show report values in analytics section', async () => {
    mockFetch({
      noShowReport: makeNoShowReport({
        filters: {
          clinic_id: null,
          clinic_name: 'All clinics',
          start_date: null,
          end_date: null,
          date_range_label: 'All time',
        },
        summary: {
          scheduled_appointments: 12,
          completed_appointments: 8,
          cancelled_appointments: 1,
          no_show_appointments: 3,
          no_show_rate_percent: 25,
        },
      }),
    })

    render(<AdminDashboard />)
    await openAnalyticsSection()

    expect(await screen.findByRole('heading', { name: /no-show report/i })).toBeInTheDocument()

    expect(screen.getAllByText('All clinics').length).toBeGreaterThan(0)
    expect(screen.getAllByText('All time').length).toBeGreaterThan(0)

    expect(screen.getByText('Scheduled')).toBeInTheDocument()

    const noShowPanel = screen.getByRole('region', { name: /no-show report/i })
    expect(within(noShowPanel).getByText('Completed')).toBeInTheDocument()
    expect(within(noShowPanel).getByText('Cancelled')).toBeInTheDocument()

    expect(screen.getByText('No-shows')).toBeInTheDocument()
    expect(screen.getByText('No-show rate')).toBeInTheDocument()

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  test('fetches no-show report again when clinic and date filters change', async () => {
    const user = userEvent.setup()

    mockFetch()

    render(<AdminDashboard />)
    await openAnalyticsSection()

    const clinicSelects = await screen.findAllByLabelText('Clinic')
    const noShowClinicSelect = clinicSelects[0]

    const startDateInputs = screen.getAllByLabelText('Start date')
    const endDateInputs = screen.getAllByLabelText('End date')

    await user.selectOptions(noShowClinicSelect, clinicId)
    await user.type(startDateInputs[0], '2026-05-01')
    await user.type(endDateInputs[0], '2026-05-11')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/api/reports/no-shows?clinic_id=${clinicId}&start_date=2026-05-01&end_date=2026-05-11`
        ),
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        })
      )
    })
  })

  test('shows no-show report empty state when no appointments match', async () => {
    mockFetch({
      noShowReport: makeNoShowReport({
        summary: {
          scheduled_appointments: 0,
          completed_appointments: 0,
          cancelled_appointments: 0,
          no_show_appointments: 0,
          no_show_rate_percent: 0,
        },
        by_clinic: [],
      }),
    })

    render(<AdminDashboard />)
    await openAnalyticsSection()

    const noDataMessages = await screen.findAllByText('No data found.')
    expect(noDataMessages.length).toBeGreaterThan(0)

    expect(
      screen.getByText('No appointments match the selected clinic and date range.')
      ).toBeInTheDocument()
  })

  test('shows no-show report error when report request fails', async () => {
    mockFetch({
      noShowError: 'Failed to fetch no-show report',
    })

    render(<AdminDashboard />)
    await openAnalyticsSection()

    expect(await screen.findByText('Failed to fetch no-show report')).toBeInTheDocument()
  })

  test('exports displayed no-show report data as CSV', async () => {
    const user = userEvent.setup()
    const createObjectURL = jest.fn(() => 'blob:mock-url')
    const revokeObjectURL = jest.fn()
    const click = jest.fn()

    global.URL.createObjectURL = createObjectURL
    global.URL.revokeObjectURL = revokeObjectURL

    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName)

      if (tagName === 'a') {
        element.click = click
      }

      return element
    })

    mockFetch({
      noShowReport: makeNoShowReport({
        filters: {
          clinic_id: clinicId,
          clinic_name: 'Hillbrow Clinic',
          start_date: '2026-05-01',
          end_date: '2026-05-11',
          date_range_label: '2026-05-01 to 2026-05-11',
        },
        summary: {
          scheduled_appointments: 10,
          completed_appointments: 6,
          cancelled_appointments: 1,
          no_show_appointments: 3,
          no_show_rate_percent: 30,
        },
      }),
    })

    render(<AdminDashboard />)
    await openAnalyticsSection()

    const csvButtons = await screen.findAllByRole('button', { name: 'Export CSV' })
    await user.click(csvButtons[0])

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  test('exports displayed no-show report data as PDF', async () => {
    const user = userEvent.setup()
    const write = jest.fn()
    const close = jest.fn()
    const print = jest.fn()

    window.open = jest.fn(() => ({
      document: {
        write,
        close,
      },
      print,
    }))

    mockFetch({
      noShowReport: makeNoShowReport({
        filters: {
          clinic_id: clinicId,
          clinic_name: 'Hillbrow Clinic',
          start_date: '2026-05-01',
          end_date: '2026-05-11',
          date_range_label: '2026-05-01 to 2026-05-11',
        },
        summary: {
          scheduled_appointments: 10,
          completed_appointments: 6,
          cancelled_appointments: 1,
          no_show_appointments: 3,
          no_show_rate_percent: 30,
        },
      }),
    })

    render(<AdminDashboard />)
    await openAnalyticsSection()

    const pdfButtons = await screen.findAllByRole('button', { name: 'Export PDF' })
    await user.click(pdfButtons[0])

    expect(window.open).toHaveBeenCalledWith('', '_blank')
    expect(write).toHaveBeenCalledWith(expect.stringContaining('No-Show Report'))
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Hillbrow Clinic'))
    expect(write).toHaveBeenCalledWith(expect.stringContaining('2026-05-01 to 2026-05-11'))
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Total no-show appointments'))
    expect(write).toHaveBeenCalledWith(expect.stringContaining('30%'))
    expect(close).toHaveBeenCalled()
    expect(print).toHaveBeenCalled()
  })
  test('displays returned average wait time report values in analytics section', async () => {
  mockFetch({
    waitTimeReport: makePopulatedWaitTimeReport({
      summary: {
        overall_average_wait_time_minutes: 75,
        queue_records_used: 4,
      },
      by_clinic: [
        {
          clinic_id: clinicId,
          clinic_name: 'Hillbrow Clinic',
          average_wait_time_minutes: 75,
          queue_records_used: 4,
        },
      ],
      by_time_of_day: [
        {
          time_of_day: 'Morning',
          average_wait_time_minutes: 45,
          queue_records_used: 2,
        },
        {
          time_of_day: 'Afternoon',
          average_wait_time_minutes: 105,
          queue_records_used: 2,
        },
        {
          time_of_day: 'Evening',
          average_wait_time_minutes: null,
          queue_records_used: 0,
        },
        {
          time_of_day: 'Night',
          average_wait_time_minutes: null,
          queue_records_used: 0,
        },
      ],
    }),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  expect(
    await screen.findByRole('heading', { name: /average wait time report/i })
  ).toBeInTheDocument()

  expect(screen.getAllByText('All clinics').length).toBeGreaterThan(0)
  expect(screen.getAllByText('All time').length).toBeGreaterThan(0)

  expect(screen.getByText('Overall average wait time')).toBeInTheDocument()
  expect(screen.getByText('Queue records used')).toBeInTheDocument()
  expect(screen.getAllByText('1h 15m').length).toBeGreaterThan(0)
  expect(screen.getAllByText('4').length).toBeGreaterThan(0)

  expect(screen.getByText('By clinic')).toBeInTheDocument()
  expect(screen.getAllByText('Hillbrow Clinic').length).toBeGreaterThan(0)

  expect(screen.getByText('By time of day')).toBeInTheDocument()
  expect(screen.getAllByText('Morning').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Afternoon').length).toBeGreaterThan(0)
  expect(screen.getAllByText('45m').length).toBeGreaterThan(0)
  expect(screen.getAllByText('1h 45m').length).toBeGreaterThan(0)
})

test('fetches average wait time report again when clinic and date filters change', async () => {
  const user = userEvent.setup()

  mockFetch({
    waitTimeReport: makePopulatedWaitTimeReport(),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  const clinicSelects = await screen.findAllByLabelText('Clinic')
  const waitTimeClinicSelect = clinicSelects[1]

  const startDateInputs = screen.getAllByLabelText('Start date')
  const endDateInputs = screen.getAllByLabelText('End date')

  await user.selectOptions(waitTimeClinicSelect, clinicId)
  await user.type(startDateInputs[1], '2026-05-01')
  await user.type(endDateInputs[1], '2026-05-11')

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        `/api/reports/average-wait-time?clinic_id=${clinicId}&start_date=2026-05-01&end_date=2026-05-11`
      ),
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      })
    )
  })
})

test('shows average wait time empty state when no queue records match', async () => {
  mockFetch({
    waitTimeReport: makeWaitTimeReport(),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  expect(
    await screen.findByText('No queue records match the selected clinic and date range.')
  ).toBeInTheDocument()
})

test('shows average wait time report error when report request fails', async () => {
  mockFetch({
    waitTimeError: 'Failed to fetch average wait time report',
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  expect(
    await screen.findByText('Failed to fetch average wait time report')
  ).toBeInTheDocument()
})

test('exports displayed average wait time report data as CSV', async () => {
  const user = userEvent.setup()
  const createObjectURL = jest.fn(() => 'blob:mock-wait-url')
  const revokeObjectURL = jest.fn()
  const click = jest.fn()

  global.URL.createObjectURL = createObjectURL
  global.URL.revokeObjectURL = revokeObjectURL

  jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
    const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName)

    if (tagName === 'a') {
      element.click = click
    }

    return element
  })

  mockFetch({
    waitTimeReport: makePopulatedWaitTimeReport({
      filters: {
        clinic_id: clinicId,
        clinic_name: 'Hillbrow Clinic',
        start_date: '2026-05-01',
        end_date: '2026-05-11',
        date_range_label: '2026-05-01 to 2026-05-11',
      },
      summary: {
        overall_average_wait_time_minutes: 75,
        queue_records_used: 4,
      },
    }),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  const csvButtons = await screen.findAllByRole('button', { name: 'Export CSV' })
  await user.click(csvButtons[1])

  expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
  expect(click).toHaveBeenCalled()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-wait-url')
})

test('exports displayed average wait time report data as PDF', async () => {
  const user = userEvent.setup()
  const write = jest.fn()
  const close = jest.fn()
  const print = jest.fn()

  window.open = jest.fn(() => ({
    document: {
      write,
      close,
    },
    print,
  }))

  mockFetch({
    waitTimeReport: makePopulatedWaitTimeReport({
      filters: {
        clinic_id: clinicId,
        clinic_name: 'Hillbrow Clinic',
        start_date: '2026-05-01',
        end_date: '2026-05-11',
        date_range_label: '2026-05-01 to 2026-05-11',
      },
      summary: {
        overall_average_wait_time_minutes: 75,
        queue_records_used: 4,
      },
    }),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  const pdfButtons = await screen.findAllByRole('button', { name: 'Export PDF' })
  await user.click(pdfButtons[1])

  expect(window.open).toHaveBeenCalledWith('', '_blank')
  expect(write).toHaveBeenCalledWith(
    expect.stringContaining('Average Wait Time Report')
  )
  expect(write).toHaveBeenCalledWith(expect.stringContaining('Hillbrow Clinic'))
  expect(write).toHaveBeenCalledWith(
    expect.stringContaining('2026-05-01 to 2026-05-11')
  )
  expect(write).toHaveBeenCalledWith(
    expect.stringContaining('Overall average wait time')
  )
  expect(write).toHaveBeenCalledWith(expect.stringContaining('1h 15m'))
  expect(write).toHaveBeenCalledWith(expect.stringContaining('By clinic'))
  expect(write).toHaveBeenCalledWith(expect.stringContaining('By time of day'))
  expect(close).toHaveBeenCalled()
  expect(print).toHaveBeenCalled()
})
test('displays custom appointment report records after running report', async () => {
  const user = userEvent.setup()

  mockFetch({
    customReport: makeCustomAppointmentReport({
      filters: {
        clinic_id: clinicId,
        clinic_name: 'Hillbrow Clinic',
        start_date: '2026-05-01',
        end_date: '2026-05-11',
        date_range_label: '2026-05-01 to 2026-05-11',
        status: 'Confirmed',
        status_label: 'Confirmed',
      },
    }),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  expect(
    await screen.findByRole('heading', { name: /custom report builder/i })
  ).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /run report/i }))

  expect(await screen.findByText('Jane Patient')).toBeInTheDocument()
  expect(screen.getAllByText('Hillbrow Clinic').length).toBeGreaterThan(0)
  expect(screen.getByText('2026-05-11')).toBeInTheDocument()
  expect(screen.getByText('10:00')).toBeInTheDocument()
  expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0)
  expect(screen.getByText('General Consultation')).toBeInTheDocument()

  expect(screen.getAllByText('Report type').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Total records').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Appointments').length).toBeGreaterThan(0)
})

test('displays custom queue report records after selecting queue report type', async () => {
  const user = userEvent.setup()

  mockFetch({
    customReport: makeCustomQueueReport({
      filters: {
        clinic_id: clinicId,
        clinic_name: 'Hillbrow Clinic',
        start_date: '2026-05-01',
        end_date: '2026-05-11',
        date_range_label: '2026-05-01 to 2026-05-11',
        status: 'Complete',
        status_label: 'Complete',
      },
    }),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  await user.selectOptions(screen.getByLabelText('Report type'), 'queue')
  await user.click(screen.getByRole('button', { name: /run report/i }))

  expect(await screen.findByText('Queue Patient')).toBeInTheDocument()
  expect(screen.getAllByText('Hillbrow Clinic').length).toBeGreaterThan(0)
  expect(screen.getByText('2')).toBeInTheDocument()
  expect(screen.getAllByText('Complete').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Queue entries').length).toBeGreaterThan(0)

  expect(screen.getByText('Position')).toBeInTheDocument()
  expect(screen.getByText('Joined at')).toBeInTheDocument()
  expect(screen.getByText('Completed at')).toBeInTheDocument()
})

test('fetches custom report with selected filters when run report is clicked', async () => {
  const user = userEvent.setup()

  mockFetch({
    customReport: makeCustomAppointmentReport(),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  const clinicSelects = await screen.findAllByLabelText('Clinic')
  const customClinicSelect = clinicSelects[2]

  const startDateInputs = screen.getAllByLabelText('Start date')
  const endDateInputs = screen.getAllByLabelText('End date')

  await user.selectOptions(screen.getByLabelText('Report type'), 'appointments')
  await user.selectOptions(customClinicSelect, clinicId)
  await user.type(startDateInputs[2], '2026-05-01')
  await user.type(endDateInputs[2], '2026-05-11')
  await user.selectOptions(screen.getByLabelText('Status'), 'Confirmed')

  await user.click(screen.getByRole('button', { name: /run report/i }))

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        `/api/reports/custom?report_type=appointments&clinic_id=${clinicId}&start_date=2026-05-01&end_date=2026-05-11&status=Confirmed`
      ),
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      })
    )
  })
})

test('updates custom status options when report type changes', async () => {
  const user = userEvent.setup()

  mockFetch()

  render(<AdminDashboard />)
  await openAnalyticsSection()

  expect(screen.getByRole('option', { name: 'Confirmed' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Called' })).not.toBeInTheDocument()

  await user.selectOptions(screen.getByLabelText('Report type'), 'queue')

  expect(screen.getByRole('option', { name: 'Called' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'In Consultation' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Confirmed' })).not.toBeInTheDocument()
})

test('shows custom report empty state when no records match', async () => {
  const user = userEvent.setup()

  mockFetch({
    customReport: makeCustomAppointmentReport({
      total_records: 0,
      records: [],
    }),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  await user.click(screen.getByRole('button', { name: /run report/i }))

  expect(await screen.findByText('No records found.')).toBeInTheDocument()
  expect(
    screen.getByText('No appointments match the selected filters.')
  ).toBeInTheDocument()
})

test('shows custom report error when request fails', async () => {
  const user = userEvent.setup()

  mockFetch({
    customReportError: 'Failed to fetch custom report',
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  await user.click(screen.getByRole('button', { name: /run report/i }))

  expect(await screen.findByText('Failed to fetch custom report')).toBeInTheDocument()
})

test('exports displayed custom appointment report data as CSV', async () => {
  const user = userEvent.setup()
  const createObjectURL = jest.fn(() => 'blob:mock-custom-url')
  const revokeObjectURL = jest.fn()
  const click = jest.fn()

  global.URL.createObjectURL = createObjectURL
  global.URL.revokeObjectURL = revokeObjectURL

  jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
    const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName)

    if (tagName === 'a') {
      element.click = click
    }

    return element
  })

  mockFetch({
    customReport: makeCustomAppointmentReport({
      filters: {
        clinic_id: clinicId,
        clinic_name: 'Hillbrow Clinic',
        start_date: '2026-05-01',
        end_date: '2026-05-11',
        date_range_label: '2026-05-01 to 2026-05-11',
        status: 'Confirmed',
        status_label: 'Confirmed',
      },
    }),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  await user.click(screen.getByRole('button', { name: /run report/i }))

  const csvButtons = await screen.findAllByRole('button', { name: 'Export CSV' })
  await user.click(csvButtons[csvButtons.length - 1])

  expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
  expect(click).toHaveBeenCalled()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-custom-url')
})

test('exports displayed custom appointment report data as PDF', async () => {
  const user = userEvent.setup()
  const write = jest.fn()
  const close = jest.fn()
  const print = jest.fn()

  window.open = jest.fn(() => ({
    document: {
      write,
      close,
    },
    print,
  }))

  mockFetch({
    customReport: makeCustomAppointmentReport({
      filters: {
        clinic_id: clinicId,
        clinic_name: 'Hillbrow Clinic',
        start_date: '2026-05-01',
        end_date: '2026-05-11',
        date_range_label: '2026-05-01 to 2026-05-11',
        status: 'Confirmed',
        status_label: 'Confirmed',
      },
    }),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  await user.click(screen.getByRole('button', { name: /run report/i }))

  const pdfButtons = await screen.findAllByRole('button', { name: 'Export PDF' })
  await user.click(pdfButtons[pdfButtons.length - 1])

  expect(window.open).toHaveBeenCalledWith('', '_blank')
  expect(write).toHaveBeenCalledWith(
    expect.stringContaining('Custom Report – Appointments')
  )
  expect(write).toHaveBeenCalledWith(expect.stringContaining('Hillbrow Clinic'))
  expect(write).toHaveBeenCalledWith(
    expect.stringContaining('2026-05-01 to 2026-05-11')
  )
  expect(write).toHaveBeenCalledWith(expect.stringContaining('Confirmed'))
  expect(write).toHaveBeenCalledWith(expect.stringContaining('Jane Patient'))
  expect(write).toHaveBeenCalledWith(expect.stringContaining('General Consultation'))
  expect(close).toHaveBeenCalled()
  expect(print).toHaveBeenCalled()
})
  test('does not fetch dashboard data when there is no logged-in user id', () => {
    useAuth.mockReturnValue({ user: null })
    global.fetch = jest.fn()

    render(<AdminDashboard />)

    expect(global.fetch).not.toHaveBeenCalled()
  })
test('handles missing operating hours and service values when selecting clinic', async () => {
  const user = userEvent.setup()

  mockFetch({
    clinics: makeClinics({
      operating_hours: null,
      services: null,
      appointment_duration_minutes: null,
    }),
  })

  render(<AdminDashboard />)
  await openClinicDetailsSection()

  await selectClinic(user)

  await selectClinic(user)

expect(await screen.findByPlaceholderText(
  'Separate services with commas or new lines'
)).toBeInTheDocument()

expect(screen.getByPlaceholderText(
  'Separate services with commas or new lines'
)).toHaveValue('')

  expect(document.querySelector('#appointment-duration')).toHaveValue(null)

  expect(screen.getByLabelText(/monday opening time/i)).toHaveValue('07:30')
  expect(screen.getByLabelText(/monday closing time/i)).toHaveValue('16:30')
  expect(screen.getByLabelText(/saturday opening time/i)).toBeDisabled()
})
test('normalises operating hours when a day is missing from clinic data', async () => {
  const user = userEvent.setup()

  mockFetch({
    clinics: makeClinics({
      operating_hours: {
        monday: { open: '09:00', close: '15:00' },
      },
    }),
  })

  render(<AdminDashboard />)
  await openClinicDetailsSection()

  await selectClinic(user)

  expect(await screen.findByLabelText(/monday opening time/i)).toHaveValue('09:00')
  expect(screen.getByLabelText(/monday closing time/i)).toHaveValue('15:00')

  expect(screen.getByLabelText(/tuesday opening time/i)).toHaveValue('07:30')
  expect(screen.getByLabelText(/tuesday closing time/i)).toHaveValue('16:30')
})

test('saves closed operating day as blank open and close values', async () => {
  const user = userEvent.setup()

  mockFetch()

  render(<AdminDashboard />)
  await openClinicDetailsSection()

  await selectClinic(user)

  const mondayClosed = screen.getAllByLabelText(/closed/i)[0]
  await user.click(mondayClosed)

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Clinic updated successfully.')).toBeInTheDocument()

  const patchCall = global.fetch.mock.calls.find(([url, options]) => {
    return String(url).includes(`/api/clinics/${clinicId}`) && options?.method === 'PATCH'
  })

  const payload = JSON.parse(patchCall[1].body)

  expect(payload.operating_hours.monday).toEqual({
    open: '',
    close: '',
  })
})

test('exports displayed custom queue report data as CSV', async () => {
  const user = userEvent.setup()
  const createObjectURL = jest.fn(() => 'blob:mock-custom-queue-url')
  const revokeObjectURL = jest.fn()
  const click = jest.fn()

  global.URL.createObjectURL = createObjectURL
  global.URL.revokeObjectURL = revokeObjectURL

  jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
    const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName)

    if (tagName === 'a') {
      element.click = click
    }

    return element
  })

  mockFetch({
    customReport: makeCustomQueueReport({
      records: [
        {
          id: 'queue-1',
          patient_name: 'Queue Patient',
          clinic_id: clinicId,
          clinic_name: 'Hillbrow Clinic',
          queue_position: 2,
          queue_status: 'Complete',
          joined_at: 'not-a-real-date',
          completed_at: null,
        },
      ],
    }),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  await user.selectOptions(screen.getByLabelText('Report type'), 'queue')
  await user.click(screen.getByRole('button', { name: /run report/i }))

  expect(await screen.findByText('Queue Patient')).toBeInTheDocument()

  const csvButtons = await screen.findAllByRole('button', { name: 'Export CSV' })
  await user.click(csvButtons[csvButtons.length - 1])

  expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
  expect(click).toHaveBeenCalled()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-custom-queue-url')
})

test('exports displayed custom queue report data as PDF', async () => {
  const user = userEvent.setup()
  const write = jest.fn()
  const close = jest.fn()
  const print = jest.fn()

  window.open = jest.fn(() => ({
    document: {
      write,
      close,
    },
    print,
  }))

  mockFetch({
    customReport: makeCustomQueueReport({
      filters: {
        clinic_id: clinicId,
        clinic_name: 'Hillbrow Clinic',
        start_date: '2026-05-01',
        end_date: '2026-05-11',
        date_range_label: '2026-05-01 to 2026-05-11',
        status: 'Complete',
        status_label: 'Complete',
      },
      records: [
        {
          id: 'queue-1',
          patient_name: 'Queue Patient',
          clinic_id: clinicId,
          clinic_name: 'Hillbrow Clinic',
          queue_position: 2,
          queue_status: 'Complete',
          joined_at: 'not-a-real-date',
          completed_at: null,
        },
      ],
    }),
  })

  render(<AdminDashboard />)
  await openAnalyticsSection()

  await user.selectOptions(screen.getByLabelText('Report type'), 'queue')
  await user.click(screen.getByRole('button', { name: /run report/i }))

  expect(await screen.findByText('Queue Patient')).toBeInTheDocument()

  const pdfButtons = await screen.findAllByRole('button', { name: 'Export PDF' })
  await user.click(pdfButtons[pdfButtons.length - 1])

  expect(window.open).toHaveBeenCalledWith('', '_blank')
  expect(write).toHaveBeenCalledWith(
    expect.stringContaining('Custom Report – Queue entries')
  )
  expect(write).toHaveBeenCalledWith(expect.stringContaining('Queue Patient'))
  expect(write).toHaveBeenCalledWith(expect.stringContaining('not-a-real-date'))
  expect(write).toHaveBeenCalledWith(expect.stringContaining('Complete'))
  expect(close).toHaveBeenCalled()
  expect(print).toHaveBeenCalled()
})
})