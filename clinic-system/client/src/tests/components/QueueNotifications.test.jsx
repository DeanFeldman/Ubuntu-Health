import { render, screen } from '@testing-library/react'
import QueueNotifications from '../../components/QueueNotifications'
import { useAuth } from '../../context/AuthContext'
import { act } from '@testing-library/react'

//Mock authentication context so tests control the logged-in user
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

// Mock API base helper to avoid import.meta issues in Jest
jest.mock('../../lib/getApiBase', () => jest.fn(() => 'http://localhost:8080'))

describe('QueueNotifications', () => {
  beforeEach(() => {
    // Reset mocks and storage before each test
    jest.clearAllMocks()
    localStorage.clear()

    // Provide a default authenticated user
    useAuth.mockReturnValue({
      user: { id: 'patient-1' },
    })

    //Mock browser Notification API- This allows us to test notification triggering without real browser popups
    global.Notification = jest.fn()
    global.Notification.permission = 'granted'
    global.Notification.requestPermission = jest.fn().mockResolvedValue('granted')

    global.fetch = jest.fn()

    // Silence console output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore console after each test
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  //Test 1: Empty state
  test('shows empty state when no queue entry is provided', async () => {
    render(<QueueNotifications queueEntry={null} />)

    expect(
      await screen.findByText('No queue notifications yet.')
    ).toBeInTheDocument()

    expect(global.fetch).not.toHaveBeenCalled()
  })

  //Test 2: Missing user handling
  test('shows empty state and does not fetch when user is missing', async () => {
    useAuth.mockReturnValue({ user: null })

    render(<QueueNotifications queueEntry={{ id: 'queue-1' }} />)

    expect(
      await screen.findByText('No queue notifications yet.')
    ).toBeInTheDocument()

    expect(global.fetch).not.toHaveBeenCalled()
  })

  //Test 3 Successful API response rendering
  test('renders notifications when API returns data', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [
          {
            id: 'notif-1',
            type: 'POSITION_1',
            created_at: '2026-04-20T10:00:00',
          },
        ],
      }),
    })

    render(<QueueNotifications queueEntry={{ id: 'queue-1' }} />)

    const matches = await screen.findAllByText('You are next in line')
    expect(matches.length).toBeGreaterThan(0)

    // Ensure correct API endpoint is called
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/queue-notifications/patient-1?queue_entry_id=queue-1'
    )

    expect(
      screen.queryByText('No queue notifications yet.')
    ).not.toBeInTheDocument()
  })

  //Test 4: New notification popup
  test('shows popup for a new notification', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [
          {
            id: 'notif-2',
            type: 'POSITION_2',
            created_at: '2026-04-20T10:05:00',
          },
        ],
      }),
    })

    render(<QueueNotifications queueEntry={{ id: 'queue-2' }} />)

    // Appears twice: once in list, once in popup
    expect(
      await screen.findAllByText('You are now 2nd in the queue')
    ).toHaveLength(2)

    // Verify browser notification was triggered
    expect(global.Notification).toHaveBeenCalledWith(
      'Ubuntu Health queue update',
      expect.objectContaining({
        body: 'You are now 2nd in the queue',
      })
    )
  })

  //Test 5: Avoid duplicate popups
  test('does not popup duplicate notification that was already displayed', async () => {
    localStorage.setItem(
      'queueNotificationsDisplayed:queue-3',
      JSON.stringify(['notif-3'])
    )

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [
          {
            id: 'notif-3',
            type: 'POSITION_3',
            created_at: '2026-04-20T10:10:00',
          },
        ],
      }),
    })

    render(<QueueNotifications queueEntry={{ id: 'queue-3' }} />)

    // Still appears in list
    expect(
      await screen.findByText('You are now 3rd in the queue')
    ).toBeInTheDocument()

    // But no popup or browser notification
    expect(global.Notification).not.toHaveBeenCalled()

    // Only one instance (no popup duplication)
    expect(
      screen.getAllByText('You are now 3rd in the queue')
    ).toHaveLength(1)
  })

  //Test 6: Invalid localStorage handling
  test('ignores invalid stored notification ids', async () => {
    localStorage.setItem('queueNotificationsDisplayed:queue-5', 'not-json')

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [
          {
            id: 'notif-5',
            type: 'POSITION_2',
            created_at: '2026-04-20T10:15:00',
          },
        ],
      }),
    })

    render(<QueueNotifications queueEntry={{ id: 'queue-5' }} />)

    // Should still show popup since invalid storage is ignored
    expect(
      await screen.findAllByText('You are now 2nd in the queue')
    ).toHaveLength(2)

    expect(global.Notification).toHaveBeenCalled()
  })

  //Test 7: Empty notifications from API
  test('shows empty state when API returns no notifications', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [],
      }),
    })

    render(<QueueNotifications queueEntry={{ id: 'queue-6' }} />)

    expect(
      await screen.findByText('No queue notifications yet.')
    ).toBeInTheDocument()
  })

  //Test 8: API error handling
  test('shows error message when notifications fetch fails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Could not load queue notifications.',
      }),
    })

    render(<QueueNotifications queueEntry={{ id: 'queue-4' }} />)

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent('Could not load queue notifications.')
  })

  //Test 9: Popup timeout behaviour

test('hides popup after timeout', async () => {
  jest.useFakeTimers()

  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      notifications: [
        {
          id: 'notif-7',
          type: 'POSITION_2',
          created_at: '2026-04-20T10:20:00',
        },
      ],
    }),
  })

  render(<QueueNotifications queueEntry={{ id: 'queue-7' }} />)

  expect(
    await screen.findAllByText('You are now 2nd in the queue')
  ).toHaveLength(2)

  act(() => {
    jest.advanceTimersByTime(5000)
  })

  expect(
    screen.getAllByText('You are now 2nd in the queue')
  ).toHaveLength(1)
})
})