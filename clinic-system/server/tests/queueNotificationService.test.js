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

  test('does not notify completed or in-consultation entries', () => {
    const rows = getQueueNotificationRows(
      [
        { ...baseEntry, id: 'complete', position: 4 },
        { ...baseEntry, id: 'consultation', position: 4 },
      ],
      [
        { ...baseEntry, id: 'complete', position: 3, status: 'Complete' },
        { ...baseEntry, id: 'consultation', position: 3, status: 'In Consultation' },
      ]
    )

    expect(rows).toEqual([])
  })
})

describe('checkAndTriggerNotifications', () => {
  test('creates detected queue notification rows', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
    const single = jest.fn().mockResolvedValue({
      data: { id: 'notification-1' },
      error: null,
    })
    const insert = jest.fn(() => ({ select: () => ({ single }) }))
    const builder = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      maybeSingle,
      insert,
    }
    const from = jest.fn(() => builder)

    configureQueueNotificationService({ from })

    const rows = await checkAndTriggerNotifications(
      [{ ...baseEntry, id: 'entry-1', position: 4 }],
      [{ ...baseEntry, id: 'entry-1', position: 3 }]
    )

    expect(from).toHaveBeenCalledWith('queue_notifications')
    expect(insert).toHaveBeenCalledWith({
      queue_entry_id: 'entry-1',
      patient_id: 'patient-1',
      clinic_id: 'clinic-1',
      type: 'POSITION_3',
      position: 3,
    })
    expect(rows).toEqual([{ id: 'notification-1' }])
  })

  test('does not insert when the notification already exists', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: 'existing-notification' },
      error: null,
    })
    const insert = jest.fn()
    const builder = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      maybeSingle,
      insert,
    }
    const from = jest.fn(() => builder)

    configureQueueNotificationService({ from })

    const created = await createNotification({
      queue_entry_id: 'entry-1',
      patient_id: 'patient-1',
      clinic_id: 'clinic-1',
      type: 'POSITION_3',
      position: 3,
    })

    expect(created).toBeNull()
    expect(insert).not.toHaveBeenCalled()
  })
})
