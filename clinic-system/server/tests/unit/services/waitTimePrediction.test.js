const {
  DEFAULT_PREDICTED_WAIT_MINUTES,
  calculateDistance,
  calculateWaitMinutes,
  buildTimeFeatureVector,
  predictWithKnnRegression,
  predictWaitTimeFromHistory,
} = require('../../../src/waitTimePrediction')

describe('waitTimePrediction unit tests', () => {
  describe('calculateWaitMinutes', () => {
    test('calculates wait time in whole minutes when joined_at and called_at are valid', () => {
      const result = calculateWaitMinutes(
        '2026-05-11T08:00:00.000Z',
        '2026-05-11T08:25:00.000Z'
      )

      expect(result).toBe(25)
    })

    test('returns 0 when patient is called at the same time they joined', () => {
      const result = calculateWaitMinutes(
        '2026-05-11T08:00:00.000Z',
        '2026-05-11T08:00:00.000Z'
      )

      expect(result).toBe(0)
    })

    test('returns null when joined_at is invalid', () => {
      const result = calculateWaitMinutes(
        'not-a-date',
        '2026-05-11T08:25:00.000Z'
      )

      expect(result).toBeNull()
    })

    test('returns null when called_at is invalid', () => {
      const result = calculateWaitMinutes(
        '2026-05-11T08:00:00.000Z',
        'not-a-date'
      )

      expect(result).toBeNull()
    })

    test('returns null when called_at is before joined_at', () => {
      const result = calculateWaitMinutes(
        '2026-05-11T08:30:00.000Z',
        '2026-05-11T08:00:00.000Z'
      )

      expect(result).toBeNull()
    })
  })

  describe('buildTimeFeatureVector', () => {
    test('builds a four-value cyclic feature vector for valid day and hour', () => {
      const result = buildTimeFeatureVector({
        dayOfWeek: 'Monday',
        hourOfDay: 8,
      })

      expect(result).toHaveLength(4)

      result.forEach(value => {
        expect(Number.isFinite(value)).toBe(true)
      })
    })

    test('returns null for invalid day of week', () => {
      const result = buildTimeFeatureVector({
        dayOfWeek: 'Funday',
        hourOfDay: 8,
      })

      expect(result).toBeNull()
    })

    test('returns null for hour below 0', () => {
      const result = buildTimeFeatureVector({
        dayOfWeek: 'Monday',
        hourOfDay: -1,
      })

      expect(result).toBeNull()
    })

    test('returns null for hour above 23', () => {
      const result = buildTimeFeatureVector({
        dayOfWeek: 'Monday',
        hourOfDay: 24,
      })

      expect(result).toBeNull()
    })
  })

  describe('calculateDistance', () => {
    test('calculates Euclidean distance between equal-length vectors', () => {
      const result = calculateDistance([0, 0], [3, 4])

      expect(result).toBe(5)
    })

    test('returns 0 for identical vectors', () => {
      const result = calculateDistance([1, 2, 3], [1, 2, 3])

      expect(result).toBe(0)
    })

    test('returns Infinity when vectors have different lengths', () => {
      const result = calculateDistance([1, 2], [1, 2, 3])

      expect(result).toBe(Infinity)
    })

    test('returns Infinity when inputs are not arrays', () => {
      const result = calculateDistance(null, [1, 2])

      expect(result).toBe(Infinity)
    })
  })

  describe('predictWithKnnRegression', () => {
    const currentDate = '2026-05-11T08:00:00.000Z'

    test('returns null when training rows are not an array', () => {
      const result = predictWithKnnRegression(null, currentDate)

      expect(result).toBeNull()
    })

    test('returns null when there are fewer than 3 usable history rows', () => {
      const rows = [
        {
          joined_at: '2026-05-05T08:00:00.000Z',
          called_at: '2026-05-05T08:10:00.000Z',
        },
        {
          joined_at: '2026-05-06T08:00:00.000Z',
          called_at: '2026-05-06T08:20:00.000Z',
        },
      ]

      const result = predictWithKnnRegression(rows, currentDate)

      expect(result).toBeNull()
    })

    test('returns a numeric prediction when enough valid history exists', () => {
      const rows = [
        {
          joined_at: '2026-05-04T08:00:00.000Z',
          called_at: '2026-05-04T08:10:00.000Z',
        },
        {
          joined_at: '2026-05-05T08:00:00.000Z',
          called_at: '2026-05-05T08:20:00.000Z',
        },
        {
          joined_at: '2026-05-06T08:00:00.000Z',
          called_at: '2026-05-06T08:30:00.000Z',
        },
      ]

      const result = predictWithKnnRegression(rows, currentDate)

      expect(Number.isFinite(result)).toBe(true)
      expect(result).toBeGreaterThanOrEqual(0)
    })

    test('ignores invalid history rows and still predicts from valid rows', () => {
      const rows = [
        {
          joined_at: 'bad-date',
          called_at: '2026-05-04T08:10:00.000Z',
        },
        {
          joined_at: '2026-05-04T08:00:00.000Z',
          called_at: '2026-05-04T08:10:00.000Z',
        },
        {
          joined_at: '2026-05-05T08:00:00.000Z',
          called_at: '2026-05-05T08:20:00.000Z',
        },
        {
          joined_at: '2026-05-06T08:00:00.000Z',
          called_at: '2026-05-06T08:30:00.000Z',
        },
      ]

      const result = predictWithKnnRegression(rows, currentDate)

      expect(Number.isFinite(result)).toBe(true)
    })
  })

  describe('predictWaitTimeFromHistory', () => {
    const currentDate = '2026-05-11T08:00:00.000Z'

    test('uses default fallback when queueRows is not an array', () => {
      const result = predictWaitTimeFromHistory(null, currentDate)

      expect(result).toEqual({
        predictedWaitMinutes: DEFAULT_PREDICTED_WAIT_MINUTES,
        basedOnRows: 0,
        fallbackUsed: true,
        strategy: 'default-fallback',
        message: 'Not enough historical queue data yet',
      })
    })

    test('uses default fallback for an empty queue history', () => {
      const result = predictWaitTimeFromHistory([], currentDate)

      expect(result.predictedWaitMinutes).toBe(DEFAULT_PREDICTED_WAIT_MINUTES)
      expect(result.basedOnRows).toBe(0)
      expect(result.fallbackUsed).toBe(true)
      expect(result.strategy).toBe('default-fallback')
      expect(result.message).toBe('Not enough historical queue data yet')
    })

    test('uses default fallback when there are fewer than 3 usable rows', () => {
      const rows = [
        {
          joined_at: '2026-05-04T08:00:00.000Z',
          called_at: '2026-05-04T08:10:00.000Z',
        },
        {
          joined_at: '2026-05-05T08:00:00.000Z',
          called_at: '2026-05-05T08:20:00.000Z',
        },
      ]

      const result = predictWaitTimeFromHistory(rows, currentDate)

      expect(result.predictedWaitMinutes).toBe(DEFAULT_PREDICTED_WAIT_MINUTES)
      expect(result.basedOnRows).toBe(2)
      expect(result.fallbackUsed).toBe(true)
      expect(result.strategy).toBe('default-fallback')
      expect(result.message).toBe('Not enough historical queue data yet')
    })

    test('uses KNN regression when enough historical queue data exists', () => {
      const rows = [
        {
          joined_at: '2026-05-04T08:00:00.000Z',
          called_at: '2026-05-04T08:10:00.000Z',
        },
        {
          joined_at: '2026-05-05T08:00:00.000Z',
          called_at: '2026-05-05T08:20:00.000Z',
        },
        {
          joined_at: '2026-05-06T08:00:00.000Z',
          called_at: '2026-05-06T08:30:00.000Z',
        },
      ]

      const result = predictWaitTimeFromHistory(rows, currentDate)

      expect(Number.isFinite(result.predictedWaitMinutes)).toBe(true)
      expect(result.basedOnRows).toBe(3)
      expect(result.fallbackUsed).toBe(false)
      expect(result.strategy).toBe('knn-regression')
      expect(result.message).toBeNull()
    })

    test('filters out invalid rows before deciding whether enough history exists', () => {
      const rows = [
        {
          joined_at: 'bad-date',
          called_at: '2026-05-04T08:10:00.000Z',
        },
        {
          joined_at: '2026-05-04T08:00:00.000Z',
          called_at: '2026-05-04T08:10:00.000Z',
        },
        {
          joined_at: '2026-05-05T08:00:00.000Z',
          called_at: '2026-05-05T08:20:00.000Z',
        },
      ]

      const result = predictWaitTimeFromHistory(rows, currentDate)

      expect(result.predictedWaitMinutes).toBe(DEFAULT_PREDICTED_WAIT_MINUTES)
      expect(result.basedOnRows).toBe(2)
      expect(result.fallbackUsed).toBe(true)
      expect(result.strategy).toBe('default-fallback')
    })

    test('ignores negative wait times and falls back safely', () => {
      const rows = [
        {
          joined_at: '2026-05-04T08:30:00.000Z',
          called_at: '2026-05-04T08:00:00.000Z',
        },
      ]

      const result = predictWaitTimeFromHistory(rows, currentDate)

      expect(result.predictedWaitMinutes).toBe(DEFAULT_PREDICTED_WAIT_MINUTES)
      expect(result.basedOnRows).toBe(0)
      expect(result.fallbackUsed).toBe(true)
      expect(result.strategy).toBe('default-fallback')
    })

    test('handles a clinic with no historical records safely', () => {
      const result = predictWaitTimeFromHistory([], currentDate)

      expect(result).toMatchObject({
        predictedWaitMinutes: DEFAULT_PREDICTED_WAIT_MINUTES,
        basedOnRows: 0,
        fallbackUsed: true,
        strategy: 'default-fallback',
      })
    })
  })
  describe('extra coverage for waitTimePrediction edge cases', () => {
  test('uses historical average fallback when KNN cannot build a current feature vector', () => {
    const rows = [
      {
        joined_at: '2026-05-04T08:00:00.000Z',
        called_at: '2026-05-04T08:10:00.000Z',
      },
      {
        joined_at: '2026-05-05T08:00:00.000Z',
        called_at: '2026-05-05T08:20:00.000Z',
      },
      {
        joined_at: '2026-05-06T08:00:00.000Z',
        called_at: '2026-05-06T08:30:00.000Z',
      },
    ]

    const result = predictWaitTimeFromHistory(rows, 'not-a-current-date')

    expect(result).toEqual({
      predictedWaitMinutes: 20,
      basedOnRows: 3,
      fallbackUsed: false,
      strategy: 'historical-average-fallback',
      message:
        'Prediction used historical average because there were not enough similar records',
    })
  })

  test('rounds historical average fallback to the nearest minute', () => {
    const rows = [
      {
        joined_at: '2026-05-04T08:00:00.000Z',
        called_at: '2026-05-04T08:10:00.000Z',
      },
      {
        joined_at: '2026-05-05T08:00:00.000Z',
        called_at: '2026-05-05T08:11:00.000Z',
      },
      {
        joined_at: '2026-05-06T08:00:00.000Z',
        called_at: '2026-05-06T08:12:00.000Z',
      },
    ]

    const result = predictWaitTimeFromHistory(rows, 'invalid-date')

    expect(result.predictedWaitMinutes).toBe(11)
    expect(result.basedOnRows).toBe(3)
    expect(result.fallbackUsed).toBe(false)
    expect(result.strategy).toBe('historical-average-fallback')
  })

  test('returns null from KNN when current date is invalid', () => {
    const rows = [
      {
        joined_at: '2026-05-04T08:00:00.000Z',
        called_at: '2026-05-04T08:10:00.000Z',
      },
      {
        joined_at: '2026-05-05T08:00:00.000Z',
        called_at: '2026-05-05T08:20:00.000Z',
      },
      {
        joined_at: '2026-05-06T08:00:00.000Z',
        called_at: '2026-05-06T08:30:00.000Z',
      },
    ]

    const result = predictWithKnnRegression(rows, 'not-a-date')

    expect(result).toBeNull()
  })

  test('returns null from KNN when all training rows are unusable', () => {
    const rows = [
      {
        joined_at: 'bad-date',
        called_at: '2026-05-04T08:10:00.000Z',
      },
      {
        joined_at: '2026-05-05T08:30:00.000Z',
        called_at: '2026-05-05T08:00:00.000Z',
      },
      {
        joined_at: null,
        called_at: null,
      },
    ]

    const result = predictWithKnnRegression(rows, '2026-05-11T08:00:00.000Z')

    expect(result).toBeNull()
  })
})
})