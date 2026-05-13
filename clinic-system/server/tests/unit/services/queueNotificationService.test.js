const {
  checkAndTriggerNotifications,
  configureQueueNotificationService,
  createNotification,
  getQueueNotificationRows,
} = require('../../../src/queueNotificationService')

const baseEntry = {
  id: 'entry-1',
  clinic_id: 'clinic-1',
  patient_id: 'patient-1',
  status: 'Waiting',
  position: 4,
}

function queueEntry(overrides = {}) {
  return {
    ...baseEntry,
    ...overrides,
  }
}

function createMockSupabase({ data = { id: 'notification-1' }, error = null } = {}) {
  const single = jest.fn().mockResolvedValue({
    data,
    error,
  })

  const select = jest.fn(() => ({
    single,
  }))

  const insert = jest.fn(() => ({
    select,
  }))

  const from = jest.fn(() => ({
    insert,
  }))

  return {
    supabase: { from },
    from,
    insert,
    select,
    single,
  }
}

describe('queueNotificationService', () => {
  afterEach(() => {
    configureQueueNotificationService(null)
    jest.clearAllMocks()
  })

  describe('getQueueNotificationRows', () => {
    test.each([
      [4, 3, 'POSITION_3', 3],
      [3, 2, 'POSITION_2', 2],
      [2, 1, 'POSITION_1', 1],
      [5, 1, 'POSITION_1', 1],
    ])(
      'detects movement from position %i to position %i',
      (oldPosition, newPosition, type, position) => {
        const rows = getQueueNotificationRows(
          [queueEntry({ position: oldPosition })],
          [queueEntry({ position: newPosition })]
        )

        expect(rows).toEqual([
          {
            queue_entry_id: 'entry-1',
            patient_id: 'patient-1',
            clinic_id: 'clinic-1',
            type,
            position,
          },
        ])
      }
    )

    test('detects status transition from Waiting to In Consultation', () => {
      const rows = getQueueNotificationRows(
        [queueEntry({ status: 'Waiting', position: 4 })],
        [queueEntry({ status: 'In Consultation', position: 4 })]
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

    test('can return both position and consultation notifications for the same entry', () => {
      const rows = getQueueNotificationRows(
        [queueEntry({ status: 'Waiting', position: 4 })],
        [queueEntry({ status: 'In Consultation', position: 3 })]
      )

      expect(rows).toEqual([
        {
          queue_entry_id: 'entry-1',
          patient_id: 'patient-1',
          clinic_id: 'clinic-1',
          type: 'POSITION_3',
          position: 3,
        },
        {
          queue_entry_id: 'entry-1',
          patient_id: 'patient-1',
          clinic_id: 'clinic-1',
          type: 'IN_CONSULTATION',
          position: null,
        },
      ])
    })

    test('does not notify when position is unchanged', () => {
      const rows = getQueueNotificationRows(
        [queueEntry({ position: 3 })],
        [queueEntry({ position: 3 })]
      )

      expect(rows).toEqual([])
    })

    test('does not notify when position moves away from the front', () => {
      const rows = getQueueNotificationRows(
        [queueEntry({ position: 2 })],
        [queueEntry({ position: 3 })]
      )

      expect(rows).toEqual([])
    })

    test('does not notify when new position is outside the top three', () => {
      const rows = getQueueNotificationRows(
        [queueEntry({ position: 5 })],
        [queueEntry({ position: 4 })]
      )

      expect(rows).toEqual([])
    })

    test('does not notify when there is no previous entry', () => {
      const rows = getQueueNotificationRows(
        [],
        [queueEntry({ position: 2 })]
      )

      expect(rows).toEqual([])
    })

    test.each([
      null,
      undefined,
      '',
      'invalid',
      2.5,
    ])('ignores invalid new position value %s', (position) => {
      const rows = getQueueNotificationRows(
        [queueEntry({ position: 4 })],
        [queueEntry({ position })]
      )

      expect(rows).toEqual([])
    })

    test('does not notify completed entries', () => {
      const rows = getQueueNotificationRows(
        [queueEntry({ position: 4 })],
        [queueEntry({ position: 3, status: 'Complete' })]
      )

      expect(rows).toEqual([])
    })

    test('does not notify when non-waiting entry enters consultation', () => {
      const rows = getQueueNotificationRows(
        [queueEntry({ status: 'Called' })],
        [queueEntry({ status: 'In Consultation' })]
      )

      expect(rows).toEqual([])
    })

    test('does not duplicate consultation notifications', () => {
      const rows = getQueueNotificationRows(
        [queueEntry({ status: 'In Consultation' })],
        [queueEntry({ status: 'In Consultation' })]
      )

      expect(rows).toEqual([])
    })

    test('does not notify when a new consultation entry has no waiting history', () => {
      const rows = getQueueNotificationRows(
        [],
        [queueEntry({ status: 'In Consultation' })]
      )

      expect(rows).toEqual([])
    })

    test('ignores queue entries without IDs when building old queue lookup', () => {
      const rows = getQueueNotificationRows(
        [queueEntry({ id: null, position: 4 })],
        [queueEntry({ id: 'entry-1', position: 3 })]
      )

      expect(rows).toEqual([])
    })

    test('handles missing queue arrays', () => {
      expect(getQueueNotificationRows()).toEqual([])
      expect(getQueueNotificationRows(null, null)).toEqual([])
    })
  })

  describe('checkAndTriggerNotifications', () => {
    test('returns empty array when there are no notifications to create', async () => {
      const rows = await checkAndTriggerNotifications(
        [queueEntry({ position: 3 })],
        [queueEntry({ position: 3 })]
      )

      expect(rows).toEqual([])
    })

    test('creates detected queue notification rows', async () => {
      const { supabase, from, insert } = createMockSupabase({
        data: { id: 'notification-1' },
      })

      configureQueueNotificationService(supabase)

      const rows = await checkAndTriggerNotifications(
        [queueEntry({ position: 4 })],
        [queueEntry({ position: 3 })]
      )

      expect(from).toHaveBeenCalledWith('queue_notifications')
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          queue_entry_id: 'entry-1',
          patient_id: 'patient-1',
          clinic_id: 'clinic-1',
          type: 'POSITION_3',
          position: 3,
          created_at: expect.any(String),
        })
      )
      expect(rows).toEqual([{ id: 'notification-1' }])
    })

    test('creates one row for each detected notification', async () => {
      const single = jest
        .fn()
        .mockResolvedValueOnce({
          data: { id: 'position-notification' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'status-notification' },
          error: null,
        })

      const insert = jest.fn(() => ({
        select: () => ({
          single,
        }),
      }))

      const from = jest.fn(() => ({
        insert,
      }))

      configureQueueNotificationService({ from })

      const rows = await checkAndTriggerNotifications(
        [queueEntry({ status: 'Waiting', position: 4 })],
        [queueEntry({ status: 'In Consultation', position: 3 })]
      )

      expect(insert).toHaveBeenCalledTimes(2)
      expect(rows).toEqual([
        { id: 'position-notification' },
        { id: 'status-notification' },
      ])
    })

    test('throws when service is not configured and notifications need to be created', async () => {
      configureQueueNotificationService(null)

      await expect(
        checkAndTriggerNotifications(
          [queueEntry({ position: 4 })],
          [queueEntry({ position: 3 })]
        )
      ).rejects.toThrow('Queue notification service is not configured')
    })
  })

  describe('createNotification', () => {
    test('inserts a queue notification row', async () => {
      const { supabase, from, insert } = createMockSupabase({
        data: { id: 'notification-1' },
      })

      configureQueueNotificationService(supabase)

      const notification = {
        queue_entry_id: 'entry-1',
        patient_id: 'patient-1',
        clinic_id: 'clinic-1',
        type: 'POSITION_3',
        position: 3,
      }

      const created = await createNotification(notification)

      expect(from).toHaveBeenCalledWith('queue_notifications')
      expect(insert).toHaveBeenCalledWith({
        queue_entry_id: 'entry-1',
        patient_id: 'patient-1',
        clinic_id: 'clinic-1',
        type: 'POSITION_3',
        position: 3,
        created_at: expect.any(String),
      })
      expect(created).toEqual({ id: 'notification-1' })
    })

    test('returns original notification when insert succeeds without returned data', async () => {
      const { supabase } = createMockSupabase({
        data: null,
        error: null,
      })

      configureQueueNotificationService(supabase)

      const notification = {
        queue_entry_id: 'entry-1',
        patient_id: 'patient-1',
        clinic_id: 'clinic-1',
        type: 'POSITION_1',
        position: 1,
      }

      await expect(createNotification(notification)).resolves.toEqual(notification)
    })

    test('always inserts a new notification row for each event', async () => {
      const single = jest
        .fn()
        .mockResolvedValueOnce({
          data: { id: 'notification-1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'notification-2' },
          error: null,
        })

      const insert = jest.fn(() => ({
        select: () => ({
          single,
        }),
      }))

      const from = jest.fn(() => ({
        insert,
      }))

      configureQueueNotificationService({
        from,
      })

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

    test('throws when service is not configured', async () => {
      configureQueueNotificationService(null)

      await expect(
        createNotification({
          queue_entry_id: 'entry-1',
          patient_id: 'patient-1',
          clinic_id: 'clinic-1',
          type: 'POSITION_1',
          position: 1,
        })
      ).rejects.toThrow('Queue notification service is not configured')
    })

  test('throws when database insert fails', async () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {})

  try {
    const { supabase } = createMockSupabase({
      data: null,
      error: new Error('DB error'),
    })

    configureQueueNotificationService(supabase)

    await expect(
      createNotification({
        queue_entry_id: 'entry-1',
        patient_id: 'patient-1',
        clinic_id: 'clinic-1',
        type: 'POSITION_1',
        position: 1,
      })
    ).rejects.toThrow('DB error')
  } finally {
    consoleErrorSpy.mockRestore()
  }
})
})
})
