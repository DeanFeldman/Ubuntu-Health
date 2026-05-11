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

function setHistoryClinic(clinic = null) {
  Object.defineProperty(window, 'history', {
    writable: true,
    value: {
      ...window.history,
      state: clinic
        ? {
            usr: {
              clinic,
            },
          }
        : {
            usr: {},
          },
      replaceState: jest.fn(),
    },
  })
}

function mockQueueFetchResponse({
  queue = [],
  ok = true,
  status = 200,
  error = 'Failed to load queue',
} = {}) {
  fetch.mockResolvedValueOnce({
    ok,
    status,
    json: async () => (ok ? { queue } : { error }),
  })
}

function mockWaitTimeFetchResponse({
  ok = true,
  status = 200,
  estimatedWaitTime = null,
  message,
  predictedWaitTime = null,
  predictionBasedOnRows = 0,
  predictionMessage,
} = {}) {
  fetch.mockResolvedValueOnce({
    ok,
    status,
    json: async () =>
      ok
        ? {
            estimatedWaitTime,
            message,
            predictedWaitTime,
            predictionBasedOnRows,
            predictionMessage,
          }
        : {
            error: 'Failed to fetch estimated wait time',
          },
  })
}

describe('QueuePage join flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
    localStorage.clear()
    sessionStorage.clear()

    useAuth.mockReturnValue({
      user: { id: 'patient-123', role: 'Patient' },
    })

    localStorage.setItem('selectedClinicId', 'clinic-123')

    setHistoryClinic({
      id: 'clinic-123',
      name: 'Test Clinic',
      municipality: 'Cape Town',
      district: 'Metro',
    })

    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('popup appears with correct clinic details', async () => {
    mockQueueFetchResponse({
      ok: false,
      status: 404,
      error: 'No active queue entry found for this patient',
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

    mockQueueFetchResponse({
      ok: false,
      status: 404,
      error: 'No active queue entry found for this patient',
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

    mockQueueFetchResponse({
      ok: false,
      status: 404,
      error: 'No active queue entry found for this patient',
    })

    fetch.mockResolvedValueOnce({
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

test('confirm join handles duplicate active queue from backend', async () => {
  jest.useFakeTimers()
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

  mockQueueFetchResponse({
    ok: false,
    status: 404,
    error: 'No active queue entry found for this patient',
  })

  fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({
      error: 'Patient already has an active queue entry',
      existingEntry: {
        id: 'entry-1',
        clinic_id: 'clinic-123',
        patient_id: 'patient-123',
        position: 1,
        status: 'Waiting',
        joined_at: '2026-04-16T10:00:00.000Z',
      },
    }),
  })

  mockQueueFetchResponse({
    queue: [
      {
        id: 'entry-1',
        clinic_id: 'clinic-123',
        patient_id: 'patient-123',
        clinic_name: 'Test Clinic',
        position: 1,
        status: 'Waiting',
        joined_at: '2026-04-16T10:00:00.000Z',
      },
    ],
  })

  mockWaitTimeFetchResponse({
    estimatedWaitTime: 0,
    predictedWaitTime: 15,
  })

  render(<QueuePage />)

  await user.click(await screen.findByRole('button', { name: 'Confirm' }))

  expect(
    await screen.findByText('You are already in a queue. Loading your current queue...')
  ).toBeInTheDocument()

  jest.advanceTimersByTime(800)

  await waitFor(() => {
    expect(localStorage.getItem('selectedClinicId')).toBe('clinic-123')
  })
})

  test('confirm join shows validation error from backend', async () => {
    const user = userEvent.setup()

    mockQueueFetchResponse({
      ok: false,
      status: 404,
      error: 'No active queue entry found for this patient',
    })

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Queue join must be confirmed by the patient',
      }),
    })

    render(<QueuePage />)

    await user.click(await screen.findByRole('button', { name: 'Confirm' }))

    expect(
      (await screen.findAllByText('Queue join must be confirmed by the patient'))
        .length
    ).toBeGreaterThan(0)
  })

  test('empty state shows when no active queue and no pending clinic', async () => {
    localStorage.removeItem('selectedClinicId')
    setHistoryClinic(null)

    render(<QueuePage />)

    expect(await screen.findByText('Queue is empty')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Browse clinics' })
    ).toBeInTheDocument()
  })

  test('browse clinics button navigates to clinic page from empty state', async () => {
    const user = userEvent.setup()

    localStorage.removeItem('selectedClinicId')
    setHistoryClinic(null)

    render(<QueuePage />)

    const browseBtn = await screen.findByRole('button', {
      name: 'Browse clinics',
    })

    await user.click(browseBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/clinic')
  })

  test('shows fetch error when queue lookup fails', async () => {
    mockQueueFetchResponse({
      ok: false,
      status: 500,
      error: 'Queue service unavailable',
    })

    render(<QueuePage />)

    expect(await screen.findByText('Queue service unavailable')).toBeInTheDocument()
  })

  test('displays estimated wait time returned by backend', async () => {
    mockQueueFetchResponse({
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
    })

    fetch.mockResolvedValueOnce({
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
    mockQueueFetchResponse({
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
    })

    mockWaitTimeFetchResponse({
      ok: false,
      status: 500,
    })

    render(<QueuePage />)

    expect(await screen.findByText('Track your live queue position.')).toBeInTheDocument()
    expect(screen.queryByText('Estimated wait')).not.toBeInTheDocument()
  })

  test('uses estimated wait message when backend says estimate unavailable', async () => {
    mockQueueFetchResponse({
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
    })

    mockWaitTimeFetchResponse({
      estimatedWaitTime: null,
      message: 'Estimate not available',
    })

    render(<QueuePage />)

    expect(await screen.findByText('Estimated wait')).toBeInTheDocument()
    expect(screen.getByText('Estimate not available')).toBeInTheDocument()
  })

  test('shows people ahead when patient is not first in visible queue', async () => {
    mockQueueFetchResponse({
      queue: [
        {
          id: 'entry-ahead',
          clinic_id: 'clinic-123',
          patient_id: 'other-patient',
          clinic_name: 'Test Clinic',
          position: 1,
          status: 'Waiting',
          joined_at: '2026-04-16T09:50:00.000Z',
        },
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
    })

    mockWaitTimeFetchResponse({
      estimatedWaitTime: 15,
    })

    render(<QueuePage />)

    expect(await screen.findByText('People ahead')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('15 min')).toBeInTheDocument()
  })

  test('shows called banner when patient status is Called', async () => {
    mockQueueFetchResponse({
      queue: [
        {
          id: 'entry-1',
          clinic_id: 'clinic-123',
          patient_id: 'patient-123',
          clinic_name: 'Test Clinic',
          position: 1,
          status: 'Called',
          joined_at: '2026-04-16T10:00:00.000Z',
        },
      ],
    })

    mockWaitTimeFetchResponse({
      estimatedWaitTime: 0,
    })

    render(<QueuePage />)

    expect(
      await screen.findByText("It's your turn! Please proceed to the reception desk.")
    ).toBeInTheDocument()

    expect(screen.getByText('Called — please proceed')).toBeInTheDocument()
    expect(screen.getByText('Updates automatically every 30 seconds.')).toBeInTheDocument()
  })

  test('shows in consultation state with position zero', async () => {
    mockQueueFetchResponse({
      queue: [
        {
          id: 'entry-1',
          clinic_id: 'clinic-123',
          patient_id: 'patient-123',
          clinic_name: 'Test Clinic',
          position: 3,
          status: 'In Consultation',
          joined_at: '2026-04-16T10:00:00.000Z',
        },
      ],
    })

    mockWaitTimeFetchResponse({
      estimatedWaitTime: null,
    })

    render(<QueuePage />)

    expect(await screen.findByText('You are currently being seen.')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /leave queue/i })).not.toBeInTheDocument()
  })

  test('patient does not see clinic access request button in the join modal', async () => {
    useAuth.mockReturnValue({
      user: { id: 'patient-123', role: 'Patient' },
    })

    mockQueueFetchResponse({
      ok: false,
      status: 404,
      error: 'No active queue entry found for this patient',
    })

    render(<QueuePage />)

    await screen.findByText('Join virtual queue?')

    expect(
      screen.queryByRole('button', {
        name: 'Request staff access for this clinic',
      })
    ).not.toBeInTheDocument()
  })

  test('leave queue deletes queue entry and navigates back to clinics', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

    mockQueueFetchResponse({
      queue: [
        {
          id: 'entry-1',
          clinic_id: 'clinic-123',
          patient_id: 'patient-123',
          clinic_name: 'Test Clinic',
          position: 1,
          status: 'Waiting',
          joined_at: '2026-04-16T10:00:00.000Z',
        },
      ],
    })

    mockWaitTimeFetchResponse({
      estimatedWaitTime: 0,
    })

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Removed' }),
    })

    render(<QueuePage />)

    await user.click(await screen.findByRole('button', { name: /leave queue/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/queue/clinic-123/entry/entry-1',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })

    expect(await screen.findByText('You have been removed from the queue.')).toBeInTheDocument()

    jest.advanceTimersByTime(2000)

    expect(mockNavigate).toHaveBeenCalledWith('/clinic')
  })

  test('shows error when leaving queue fails', async () => {
    const user = userEvent.setup()

    mockQueueFetchResponse({
      queue: [
        {
          id: 'entry-1',
          clinic_id: 'clinic-123',
          patient_id: 'patient-123',
          clinic_name: 'Test Clinic',
          position: 1,
          status: 'Waiting',
          joined_at: '2026-04-16T10:00:00.000Z',
        },
      ],
    })

    mockWaitTimeFetchResponse({
      estimatedWaitTime: 0,
    })

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Could not leave queue' }),
    })

    render(<QueuePage />)

    await user.click(await screen.findByRole('button', { name: /leave queue/i }))

    expect(
      (await screen.findAllByText('Could not leave queue')).length
    ).toBeGreaterThan(0)
  })


test('shows empty state when queue has no entry for current patient', async () => {
  mockQueueFetchResponse({
    queue: [
      {
        id: 'entry-other',
        clinic_id: 'clinic-123',
        patient_id: 'other-patient',
        clinic_name: 'Test Clinic',
        position: 1,
        status: 'Waiting',
        joined_at: '2026-04-16T10:00:00.000Z',
      },
    ],
  })

  render(<QueuePage />)

  expect(await screen.findByText('Queue is empty')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Browse clinics' })).toBeInTheDocument()
})

test('shows served queue entry state', async () => {
  mockQueueFetchResponse({
    queue: [
      {
        id: 'entry-1',
        clinic_id: 'clinic-123',
        patient_id: 'patient-123',
        clinic_name: 'Test Clinic',
        position: 1,
        status: 'Served',
        joined_at: '2026-04-16T10:00:00.000Z',
      },
    ],
  })

  mockWaitTimeFetchResponse({
    estimatedWaitTime: null,
  })

  render(<QueuePage />)

  expect(await screen.findByText('Served')).toBeInTheDocument()
  expect(screen.getAllByText('Test Clinic').length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: /leave queue/i })).not.toBeInTheDocument()
  expect(screen.queryByText('Updates automatically every 30 seconds.')).not.toBeInTheDocument()
})

test('shows skipped queue entry state', async () => {
  mockQueueFetchResponse({
    queue: [
      {
        id: 'entry-1',
        clinic_id: 'clinic-123',
        patient_id: 'patient-123',
        clinic_name: 'Test Clinic',
        position: 1,
        status: 'Skipped',
        joined_at: '2026-04-16T10:00:00.000Z',
      },
    ],
  })

  mockWaitTimeFetchResponse({
    estimatedWaitTime: null,
  })

  render(<QueuePage />)

  expect(await screen.findByText('Skipped')).toBeInTheDocument()
  expect(screen.getAllByText('Test Clinic').length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: /leave queue/i })).not.toBeInTheDocument()
})

test('shows error when leave queue cannot find entry id', async () => {
  const user = userEvent.setup()

  mockQueueFetchResponse({
    queue: [
      {
        clinic_id: 'clinic-123',
        patient_id: 'patient-123',
        clinic_name: 'Test Clinic',
        position: 1,
        status: 'Waiting',
        joined_at: '2026-04-16T10:00:00.000Z',
      },
    ],
  })

  mockWaitTimeFetchResponse({
    estimatedWaitTime: 0,
  })

  render(<QueuePage />)

  await user.click(await screen.findByRole('button', { name: /leave queue/i }))

  expect(
    (await screen.findAllByText('Could not find your queue entry.')).length
  ).toBeGreaterThan(0)
})

test('confirm join shows generic backend error for unexpected failure', async () => {
  const user = userEvent.setup()

  mockQueueFetchResponse({
    ok: false,
    status: 404,
    error: 'No active queue entry found for this patient',
  })

  fetch.mockResolvedValueOnce({
    ok: false,
    status: 500,
    json: async () => ({
      error: 'Queue insert failed',
    }),
  })

  render(<QueuePage />)

  await user.click(await screen.findByRole('button', { name: 'Confirm' }))

  expect(
    (await screen.findAllByText('Queue insert failed')).length
  ).toBeGreaterThan(0)
})

test('fetches clinic name when queue entry and pending clinic do not include clinic name', async () => {
  setHistoryClinic({
    id: 'clinic-123',
    municipality: 'Cape Town',
    district: 'Metro',
  })

  mockQueueFetchResponse({
    queue: [
      {
        id: 'entry-1',
        clinic_id: 'clinic-123',
        patient_id: 'patient-123',
        position: 1,
        status: 'Waiting',
        joined_at: '2026-04-16T10:00:00.000Z',
      },
    ],
  })

  mockWaitTimeFetchResponse({
    estimatedWaitTime: 10,
  })

  fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      clinic: {
        id: 'clinic-123',
        name: 'Fetched Clinic Name',
      },
    }),
  })

  render(<QueuePage />)

  expect(await screen.findByText('Fetched Clinic Name')).toBeInTheDocument()

  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:8080/api/clinics/clinic-123',
    expect.objectContaining({
      headers: { Accept: 'application/json' },
    })
  )
})

test('continues when estimated wait request throws', async () => {
  mockQueueFetchResponse({
    queue: [
      {
        id: 'entry-1',
        clinic_id: 'clinic-123',
        patient_id: 'patient-123',
        clinic_name: 'Test Clinic',
        position: 1,
        status: 'Waiting',
        joined_at: '2026-04-16T10:00:00.000Z',
      },
    ],
  })

  fetch.mockRejectedValueOnce(new Error('wait service down'))

  render(<QueuePage />)

  expect(await screen.findByText('Track your live queue position.')).toBeInTheDocument()
  expect(screen.queryByText('Estimated wait')).not.toBeInTheDocument()
})

test('confirm join shows missing clinic or user error', async () => {
  const user = userEvent.setup()

  useAuth.mockReturnValue({
    user: null,
  })

  mockQueueFetchResponse({
    ok: false,
    status: 404,
    error: 'No active queue entry found for this patient',
  })

  render(<QueuePage />)

  await user.click(await screen.findByRole('button', { name: 'Confirm' }))

  expect(
    (await screen.findAllByText('Missing clinic or user ID')).length
  ).toBeGreaterThan(0)
})

test('confirm join shows generic error when join request fails unexpectedly', async () => {
  const user = userEvent.setup()

  mockQueueFetchResponse({
    ok: false,
    status: 404,
    error: 'No active queue entry found for this patient',
  })

  fetch.mockResolvedValueOnce({
    ok: false,
    status: 500,
    json: async () => ({
      error: 'Database insert failed',
    }),
  })

  render(<QueuePage />)

  await user.click(await screen.findByRole('button', { name: 'Confirm' }))

  expect(
    (await screen.findAllByText('Database insert failed')).length
  ).toBeGreaterThan(0)
})

test('leave queue shows error when selected clinic id is missing', async () => {
  const user = userEvent.setup()

  mockQueueFetchResponse({
    queue: [
      {
        id: 'entry-1',
        clinic_id: 'clinic-123',
        patient_id: 'patient-123',
        clinic_name: 'Test Clinic',
        position: 1,
        status: 'Waiting',
        joined_at: '2026-04-16T10:00:00.000Z',
      },
    ],
  })

  mockWaitTimeFetchResponse({
    estimatedWaitTime: 0,
  })

  render(<QueuePage />)

  localStorage.removeItem('selectedClinicId')

  await user.click(await screen.findByRole('button', { name: /leave queue/i }))

  expect(
    (await screen.findAllByText('Could not find your queue entry.')).length
  ).toBeGreaterThan(0)
})
})