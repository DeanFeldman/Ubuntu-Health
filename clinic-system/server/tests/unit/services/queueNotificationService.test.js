const {
  checkAndTriggerNotifications,
  configureQueueNotificationService,
  createNotification,
  getQueueNotificationRows,
} = require('../../../src/queueNotificationService')

const baseEntry = {
  clinic_id: 'clinic-1',
  patient_id: 'patient-1',
  status: 'Waiting',
}

describe('queue notification transition detection', () => {
  // Verifies the core business rule: notify only when an existing patient enters a top 3 slot.
  test('detects movement into position 3', () => {
    const rows = getQueueNotificationRows(
      [{ ...baseEntry, id: 'entry-1', position: 4 }],
      [{ ...baseEntry, id: 'entry-1', position: 3 }]
    )

    expect(rows).toEqual([
      {
        queue_entry_id: 'entry-1',
        patient_id: 'patient-1',
        clinic_id: 'clinic-1',
        type: 'POSITION_3',
        position: 3,
      },
    ])
  })

  // A large jump should produce the current actionable position, not multiple stale alerts.
  test('detects position jumps into the final reached trigger position only', () => {
    const rows = getQueueNotificationRows(
      [{ ...baseEntry, id: 'entry-1', position: 5 }],
      [{ ...baseEntry, id: 'entry-1', position: 1 }]
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      queue_entry_id: 'entry-1',
      patient_id: 'patient-1',
      type: 'POSITION_1',
      position: 1,
    })
  })

  test('detects movement from position 2 to position 1', () => {
    const rows = getQueueNotificationRows(
      [{ ...baseEntry, id: 'entry-1', position: 2 }],
      [{ ...baseEntry, id: 'entry-1', position: 1 }]
    )

    expect(rows).toEqual([
      {
        queue_entry_id: 'entry-1',
        patient_id: 'patient-1',
        clinic_id: 'clinic-1',
        type: 'POSITION_1',
        position: 1,
      },
    ])
  })

  // Prevents duplicates on polling, queue reordering, and initial page loads without history.
  test('does not notify when position is unchanged, moves backward, or has no previous state', () => {
    const rows = getQueueNotificationRows(
      [
        { ...baseEntry, id: 'unchanged', position: 3 },
        { ...baseEntry, id: 'backward', position: 1 },
      ],
      [
        { ...baseEntry, id: 'unchanged', position: 3 },
        { ...baseEntry, id: 'backward', position: 2 },
        { ...baseEntry, id: 'new-entry', position: 2 },
      ]
    )

    expect(rows).toEqual([])
  })

  // Completed rows can remain in snapshots briefly, but should not prompt the patient.
  test('does not notify completed entries', () => {
    const rows = getQueueNotificationRows(
      [
        { ...baseEntry, id: 'complete', position: 4 },
      ],
      [
        { ...baseEntry, id: 'complete', position: 3, status: 'Complete' },
      ]
    )

    expect(rows).toEqual([])
  })

  // Status notifications are transition-based so "In Consultation" is announced once.
  test('detects status transition into consultation', () => {
    const rows = getQueueNotificationRows(
      [{ ...baseEntry, id: 'entry-1', position: 4, status: 'Waiting' }],
      [{ ...baseEntry, id: 'entry-1', position: 4, status: 'In Consultation' }]
    )

    expect(rows).toEqual([
      {
        queue_entry_id: 'entry-1',
        patient_id: 'patient-1',
        clinic_id: 'clinic-1',
        type: 'IN_CONSULTATION',
        position: null,
      },
    ])
  })

  test('does not notify when a non-waiting entry enters consultation', () => {
    const rows = getQueueNotificationRows(
      [{ ...baseEntry, id: 'entry-1', position: 4, status: 'Called' }],
      [{ ...baseEntry, id: 'entry-1', position: 4, status: 'In Consultation' }]
    )

    expect(rows).toEqual([])
  })
})

describe('checkAndTriggerNotifications', () => {
  // Confirms detected transition events are persisted with the fields clients consume.
  test('creates detected queue notification rows', async () => {
    const single = jest.fn().mockResolvedValue({
      data: { id: 'notification-1' },
      error: null,
    })
    const insert = jest.fn(() => ({ select: () => ({ single }) }))
    const builder = {
      insert,
    }
    const from = jest.fn(() => builder)

    configureQueueNotificationService({ from })

    const rows = await checkAndTriggerNotifications(
      [{ ...baseEntry, id: 'entry-1', position: 4 }],
      [{ ...baseEntry, id: 'entry-1', position: 3 }]
    )

    expect(from).toHaveBeenCalledWith('queue_notifications')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      queue_entry_id: 'entry-1',
      patient_id: 'patient-1',
      clinic_id: 'clinic-1',
      type: 'POSITION_3',
      position: 3,
    }))
    expect(insert.mock.calls[0][0].created_at).toEqual(expect.any(String))
    expect(rows).toEqual([{ id: 'notification-1' }])
  })

  // Queue notifications are immutable events; repeated events create history rows instead of updates.
  test('always inserts a new notification row for each event', async () => {
    const single = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: 'notification-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'notification-2' }, error: null })
    const insert = jest.fn(() => ({ select: () => ({ single }) }))
    const builder = {
      insert,
    }
    const from = jest.fn(() => builder)

    configureQueueNotificationService({ from })

    const notification = {
      queue_entry_id: 'entry-1',
      patient_id: 'patient-1',
      clinic_id: 'clinic-1',
      type: 'POSITION_3',
      position: 3,
    }
    const firstCreated = await createNotification(notification)
    const secondCreated = await createNotification(notification)

    expect(firstCreated).toEqual({ id: 'notification-1' })
    expect(secondCreated).toEqual({ id: 'notification-2' })
    expect(insert).toHaveBeenCalledTimes(2)
  })
})

describe('queue notification additional edge cases', () => {
  const baseEntry = {
    clinic_id: 'clinic-1',
    patient_id: 'patient-1',
    status: 'Waiting',
  }

  // Invalid positions represent unknown state and should not be treated as queue progress.
  test('ignores invalid position values', () => {
    const rows = getQueueNotificationRows(
      [{ ...baseEntry, id: 'entry-1', position: 4 }],
      [{ ...baseEntry, id: 'entry-1', position: 'invalid' }]
    )

    expect(rows).toEqual([])
  })

  // Only the top 3 positions are notification-worthy, even when the patient moves forward.
  test('does not notify for positions outside 1-3', () => {
    const rows = getQueueNotificationRows(
      [{ ...baseEntry, id: 'entry-1', position: 5 }],
      [{ ...baseEntry, id: 'entry-1', position: 4 }]
    )

    expect(rows).toEqual([])
  })

  // Empty old queues model queue resets or first fetches; no historical transition exists yet.
  test('does not notify when no previous entry exists', () => {
    const rows = getQueueNotificationRows(
      [],
      [{ ...baseEntry, id: 'entry-1', position: 2 }]
    )

    expect(rows).toEqual([])
  })

  // Higher numeric positions mean the patient moved farther from the front of the queue.
  test('does not notify when position increases (wrong direction)', () => {
    const rows = getQueueNotificationRows(
      [{ ...baseEntry, id: 'entry-1', position: 2 }],
      [{ ...baseEntry, id: 'entry-1', position: 3 }]
    )

    expect(rows).toEqual([])
  })

  test('does not notify when status becomes Complete', () => {
    const rows = getQueueNotificationRows(
      [{ ...baseEntry, id: 'entry-1', position: 4 }],
      [{ ...baseEntry, id: 'entry-1', position: 3, status: 'Complete' }]
    )

    expect(rows).toEqual([])
  })

  // Repeated status snapshots must not create duplicate consultation alerts.
  test('does not duplicate consultation notifications', () => {
    const rows = getQueueNotificationRows(
      [{ ...baseEntry, id: 'entry-1', status: 'In Consultation' }],
      [{ ...baseEntry, id: 'entry-1', status: 'In Consultation' }]
    )

    expect(rows).toEqual([])
  })

  test('does not notify when a new consultation entry has no waiting history', () => {
    const rows = getQueueNotificationRows(
      [],
      [{ ...baseEntry, id: 'entry-1', status: 'In Consultation' }]
    )

    expect(rows).toEqual([])
  })
})

describe('queue notification error handling', () => {
  // Missing configuration is only fatal when a transition actually needs persistence.
  test('throws error if service is not configured and notifications need to be created', async () => {
  configureQueueNotificationService(null)

  const oldQueue = [
    {
      id: 'entry-1',
      clinic_id: 'clinic-1',
      patient_id: 'patient-1',
      status: 'Waiting',
      position: 4,
    },
  ]

  const newQueue = [
    {
      id: 'entry-1',
      clinic_id: 'clinic-1',
      patient_id: 'patient-1',
      status: 'Waiting',
      position: 3,
    },
  ]

  await expect(
    checkAndTriggerNotifications(oldQueue, newQueue)
  ).rejects.toThrow('Queue notification service is not configured')
})
  test('createNotification throws on database error', async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: new Error('DB error'),
    })

    const insert = jest.fn(() => ({
      select: () => ({ single }),
    }))

    const from = jest.fn(() => ({ insert }))

    configureQueueNotificationService({ from })

    await expect(
      createNotification({
        queue_entry_id: 'entry-1',
        patient_id: 'patient-1',
        clinic_id: 'clinic-1',
        type: 'POSITION_1',
        position: 1,
      })
    ).rejects.toThrow()
  })
})
