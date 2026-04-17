const {
  checkAndTriggerNotifications,
  configureQueueNotificationService,
  createNotification,
  getQueueNotificationRows,
} = require('../src/queueNotificationService')

const baseEntry = {
  clinic_id: 'clinic-1',
  patient_id: 'patient-1',
  status: 'Waiting',
}

describe('queue notification transition detection', () => {
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
})

describe('checkAndTriggerNotifications', () => {
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
