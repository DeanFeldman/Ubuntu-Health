import { render, screen } from '@testing-library/react'
import QueueNotifications from '../../components/QueueNotifications'
import { useAuth } from '../../context/AuthContext'

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

    // Silence console output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore console after each test
    jest.restoreAllMocks()
  })

//Test 1: Empty state
  test('shows empty state when no queue entry is provided', async () => {
    global.fetch = jest.fn()

    render(<QueueNotifications queueEntry={null} />)

    expect(
      await screen.findByText('No queue notifications yet.')
    ).toBeInTheDocument()

    expect(global.fetch).not.toHaveBeenCalled()
  })

  //Test 2: API error handling
  test('renders notifications when API returns data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
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

    expect(
      screen.queryByText('No queue notifications yet.')
    ).not.toBeInTheDocument()
  })

  //Test 3: New notification popup
  test('shows popup for a new notification', async () => {
    global.fetch = jest.fn().mockResolvedValue({
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

  //Test 4: Avoid duplicate popups
  test('does not popup duplicate notification that was already displayed', async () => {
    localStorage.setItem(
      'queueNotificationsDisplayed:queue-3',
      JSON.stringify(['notif-3'])
    )

    global.fetch = jest.fn().mockResolvedValue({
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

  //Test 5: API error handling
  test('shows error message when notifications fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
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
})