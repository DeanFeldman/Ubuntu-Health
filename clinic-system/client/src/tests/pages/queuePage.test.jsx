import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QueuePage from '../../pages/QueuePage'
import { useAuth } from '../../context/AuthContext'

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../components/QueueNotifications', () => () => null)

jest.mock('../../lib/getApiBase', () => jest.fn(() => 'http://localhost:8080'))

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

describe('QueuePage join flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()

    useAuth.mockReturnValue({
      user: { id: 'patient-123', role: 'Patient' },
    })

    localStorage.setItem('selectedClinicId', 'clinic-123')

    Object.defineProperty(window, 'history', {
      writable: true,
      value: {
        ...window.history,
        state: {
          usr: {
            clinic: {
              id: 'clinic-123',
              name: 'Test Clinic',
              municipality: 'Cape Town',
              district: 'Metro',
            },
          },
        },
        replaceState: jest.fn(),
      },
    })

    global.fetch = jest.fn()
  })

  test('popup appears with correct clinic details', async () => {
    fetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
      json: async () => ({
        error: 'No active queue entry found for this patient',
      }),
    })

    render(<QueuePage />)

    expect(await screen.findByText('Join virtual queue?')).toBeInTheDocument()
    expect(screen.getByText('Test Clinic')).toBeInTheDocument()
    expect(screen.getByText('Cape Town, Metro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  test('cancel closes popup and does not send join request', async () => {
    const user = userEvent.setup()

    fetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
      json: async () => ({
        error: 'No active queue entry found for this patient',
      }),
    })

    render(<QueuePage />)

    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByText('Join virtual queue?')).not.toBeInTheDocument()
    })

    const joinCalls = fetch.mock.calls.filter(([url, options]) => {
      return (
        String(url).includes('/api/queue/clinic-123/join') &&
        options?.method === 'POST'
      )
    })

    expect(joinCalls).toHaveLength(0)
  })

  test('confirm joins correct clinic and shows success feedback', async () => {
    const user = userEvent.setup()

    fetch
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({
          error: 'No active queue entry found for this patient',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          entry: {
            id: 'entry-1',
            clinic_id: 'clinic-123',
            patient_id: 'patient-123',
            clinic_name: 'Test Clinic',
            position: 1,
            status: 'Waiting',
            joined_at: '2026-04-16T10:00:00.000Z',
          },
        }),
      })

    render(<QueuePage />)

    await user.click(await screen.findByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/queue/clinic-123/join'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: 'patient-123',
            confirmed: true,
          }),
        })
      )
    })

    expect(
      await screen.findByText('You have joined the queue at Test Clinic.')
    ).toBeInTheDocument()
  })

  test('empty state shows when no active queue and no pending clinic', async () => {
    localStorage.removeItem('selectedClinicId')

    Object.defineProperty(window, 'history', {
      writable: true,
      value: {
        ...window.history,
        state: { usr: {} },
        replaceState: jest.fn(),
      },
    })

    render(<QueuePage />)

    expect(await screen.findByText('Queue is empty')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Browse clinics' })
    ).toBeInTheDocument()
  })

  test('displays estimated wait time returned by backend', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          queue: [
            {
              id: 'entry-1',
              clinic_id: 'clinic-123',
              patient_id: 'patient-123',
              clinic_name: 'Test Clinic',
              position: 2,
              status: 'Waiting',
              joined_at: '2026-04-16T10:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          position: 2,
          patientsAhead: 1,
          appointmentDuration: 15,
          staffCount: 1,
          estimatedWaitTime: 15,
        }),
      })

    render(<QueuePage />)

    expect(await screen.findByText('Estimated wait')).toBeInTheDocument()
    expect(screen.getByText('15 min')).toBeInTheDocument()

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/queue/clinic-123/estimated-wait-time/patient-123'),
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      })
    )
  })

  test('hides estimated wait row when backend wait time request fails', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          queue: [
            {
              id: 'entry-1',
              clinic_id: 'clinic-123',
              patient_id: 'patient-123',
              clinic_name: 'Test Clinic',
              position: 2,
              status: 'Waiting',
              joined_at: '2026-04-16T10:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Failed to fetch estimated wait time' }),
      })

    render(<QueuePage />)

    expect(await screen.findByText('Track your live queue position.')).toBeInTheDocument()
    expect(screen.queryByText('Estimated wait')).not.toBeInTheDocument()
  })

//   test('staff can request clinic access from the join modal', async () => {
//   const user = userEvent.setup()

//   useAuth.mockReturnValue({
//     user: { id: 'staff-123', role: 'Staff' },
//   })

//   localStorage.setItem('selectedClinicId', 'clinic-123')

//   Object.defineProperty(window, 'history', {
//     writable: true,
//     value: {
//       ...window.history,
//       state: {
//         usr: {
//           clinic: {
//             id: 'clinic-123',
//             name: 'Test Clinic',
//             municipality: 'Cape Town',
//             district: 'Metro',
//           },
//         },
//       },
//       replaceState: jest.fn(),
//     },
//   })

//   fetch
//     .mockResolvedValueOnce({
//       status: 404,
//       ok: false,
//       json: async () => ({
//         error: 'No active queue entry found for this patient',
//       }),
//     })
//     .mockResolvedValueOnce({
//       ok: true,
//       status: 200,
//       json: async () => ({ success: true }),
//     })

//   render(<QueuePage />)

//   const requestBtn = await screen.findByRole('button', {
//     name: 'Request staff access for this clinic',
//   })

//   await user.click(requestBtn)

//   await waitFor(() => {
//     expect(fetch).toHaveBeenCalledWith(
//       expect.stringContaining('/api/clinic-requests'),
//       expect.objectContaining({
//         method: 'POST',
//         headers: expect.objectContaining({
//           'Content-Type': 'application/json',
//           Accept: 'application/json',
//         }),
//         body: JSON.stringify({
//           staff_user_id: 'staff-123',
//           clinic_id: 'clinic-123',
//         }),
//       })
//     )
//   })

//   expect(
//     await screen.findByText('Clinic access request sent for Test Clinic.')
//   ).toBeInTheDocument()
// })

test('patient does not see clinic access request button in the join modal', async () => {
  useAuth.mockReturnValue({
    user: { id: 'patient-123', role: 'Patient' },
  })

  fetch.mockResolvedValueOnce({
    status: 404,
    ok: false,
    json: async () => ({
      error: 'No active queue entry found for this patient',
    }),
  })

  render(<QueuePage />)

  await screen.findByText('Join virtual queue?')

  expect(
    screen.queryByRole('button', {
      name: 'Request staff access for this clinic',
    })
  ).not.toBeInTheDocument()
})

test('browse clinics button navigates to clinic page from empty state', async () => {
  const user = userEvent.setup()

  localStorage.removeItem('selectedClinicId')

  Object.defineProperty(window, 'history', {
    writable: true,
    value: {
      ...window.history,
      state: { usr: {} },
      replaceState: jest.fn(),
    },
  })

  render(<QueuePage />)

  const browseBtn = await screen.findByRole('button', {
    name: 'Browse clinics',
  })

  await user.click(browseBtn)

  expect(mockNavigate).toHaveBeenCalledWith('/clinic')
})
})
