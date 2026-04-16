/*

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QueuePage from '../pages/QueuePage'
import { useAuth } from '../context/AuthContext'

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

describe('QueuePage confirmation flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    useAuth.mockReturnValue({
      user: { id: 'patient-123' },
    })

    localStorage.clear()
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
      },
    })

    window.__API_BASE__ = 'http://localhost:8080'
    global.fetch = jest.fn()
  })

  afterEach(() => {
    delete window.__API_BASE__
  })

  // Popup should appear with the correct clinic details
  test('shows confirmation modal with correct clinic details', async () => {
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

  // Cancel should close the popup and not trigger a join request
  test('cancel closes modal and does not send join request', async () => {
    const user = userEvent.setup()

    fetch.mockResolvedValue({
      status: 404,
      ok: false,
      json: async () => ({
        error: 'No active queue entry found for this patient',
      }),
    })

    render(<QueuePage />)

    const cancelBtn = await screen.findByRole('button', { name: 'Cancel' })
    await user.click(cancelBtn)

    expect(screen.queryByText('Join virtual queue?')).not.toBeInTheDocument()

    const joinCalls = fetch.mock.calls.filter(
      (call) => call[0] === 'http://localhost:8080/api/queue/clinic-123/join'
    )

    expect(joinCalls).toHaveLength(0)
  })

  // Confirm should send the join request and show success feedback
  test('confirm sends join request and shows success feedback', async () => {
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

    const confirmBtn = await screen.findByRole('button', { name: 'Confirm' })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/queue/clinic-123/join',
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

  // Duplicate-entry errors should be shown clearly
  test('shows duplicate-entry error feedback when join returns 409', async () => {
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
        status: 409,
        ok: false,
        json: async () => ({
          error: 'Patient already has an active queue entry',
        }),
      })

    render(<QueuePage />)

    const confirmBtn = await screen.findByRole('button', { name: 'Confirm' })
    await user.click(confirmBtn)

    expect(
      await screen.findByText('Patient already has an active queue entry')
    ).toBeInTheDocument()
  })

  // Invalid-request errors should also be shown clearly
  test('shows invalid-request error feedback when join returns 400', async () => {
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
        status: 400,
        ok: false,
        json: async () => ({
          error: 'Invalid queue join request',
        }),
      })

    render(<QueuePage />)

    const confirmBtn = await screen.findByRole('button', { name: 'Confirm' })
    await user.click(confirmBtn)

    expect(
      await screen.findByText('Invalid queue join request')
    ).toBeInTheDocument()
  })
})
*/
