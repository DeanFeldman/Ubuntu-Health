const DEFAULT_PREDICTED_WAIT_MINUTES = 15
const MIN_HISTORY_ROWS = 3
const K_NEAREST_NEIGHBOURS = 5

function getJohannesburgDateParts(dateInput = new Date()) {
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return null

  const formatter = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    weekday: 'long',
    hour: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)

  return {
    dayOfWeek: parts.find(part => part.type === 'weekday')?.value,
    hourOfDay: Number(parts.find(part => part.type === 'hour')?.value),
  }
}

function calculateWaitMinutes(joinedAt, calledAt) {
  const joined = new Date(joinedAt)
  const called = new Date(calledAt)

  if (Number.isNaN(joined.getTime()) || Number.isNaN(called.getTime())) return null

  const waitMinutes = Math.round((called.getTime() - joined.getTime()) / 60000)

  if (!Number.isFinite(waitMinutes) || waitMinutes < 0) return null
  return waitMinutes
}

function average(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return null

  return Math.round(
    numbers.reduce((total, value) => total + value, 0) / numbers.length
  )
}

const DAY_INDEX = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

function buildTimeFeatureVector({ dayOfWeek, hourOfDay }) {
  const dayIndex = DAY_INDEX[dayOfWeek]

  if (
    dayIndex == null ||
    !Number.isFinite(hourOfDay) ||
    hourOfDay < 0 ||
    hourOfDay > 23
  ) {
    return null
  }

  const hourAngle = (2 * Math.PI * hourOfDay) / 24
  const dayAngle = (2 * Math.PI * dayIndex) / 7

  return [
    Math.sin(hourAngle),
    Math.cos(hourAngle),
    Math.sin(dayAngle),
    Math.cos(dayAngle),
  ]
}

function calculateDistance(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) return Infinity
  if (vectorA.length !== vectorB.length) return Infinity

  const squaredDistance = vectorA.reduce((total, value, index) => {
    const difference = value - vectorB[index]
    return total + difference * difference
  }, 0)

  return Math.sqrt(squaredDistance)
}

function predictWithKnnRegression(trainingRows, currentDate = new Date()) {
  const currentDateParts = getJohannesburgDateParts(currentDate)
  const currentVector = buildTimeFeatureVector(currentDateParts || {})

  if (!currentVector || !Array.isArray(trainingRows)) {
    return null
  }

  const trainingExamples = trainingRows
    .map(row => {
      const rowDateParts = getJohannesburgDateParts(row.joined_at)
      const featureVector = buildTimeFeatureVector(rowDateParts || {})
      const waitMinutes = calculateWaitMinutes(row.joined_at, row.called_at)

      if (!featureVector || waitMinutes == null) return null

      return {
        featureVector,
        waitMinutes,
      }
    })
    .filter(Boolean)

  if (trainingExamples.length < MIN_HISTORY_ROWS) {
    return null
  }

  const nearestNeighbours = trainingExamples
    .map(example => ({
      ...example,
      distance: calculateDistance(currentVector, example.featureVector),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.min(K_NEAREST_NEIGHBOURS, trainingExamples.length))

  const weightedPrediction = nearestNeighbours.reduce(
    (result, neighbour) => {
      const weight = 1 / (neighbour.distance + 0.001)

      return {
        weightedTotal: result.weightedTotal + neighbour.waitMinutes * weight,
        totalWeight: result.totalWeight + weight,
      }
    },
    {
      weightedTotal: 0,
      totalWeight: 0,
    }
  )

  if (weightedPrediction.totalWeight <= 0) {
    return average(nearestNeighbours.map(neighbour => neighbour.waitMinutes))
  }

  return Math.round(weightedPrediction.weightedTotal / weightedPrediction.totalWeight)
}

function predictWaitTimeFromHistory(queueRows, currentDate = new Date()) {
  if (!Array.isArray(queueRows)) {
    return {
      predictedWaitMinutes: DEFAULT_PREDICTED_WAIT_MINUTES,
      basedOnRows: 0,
      fallbackUsed: true,
      strategy: 'default-fallback',
      message: 'Not enough historical queue data yet',
    }
  }

  const usableRows = queueRows.filter(row => {
    return calculateWaitMinutes(row.joined_at, row.called_at) != null
  })

  const knnPrediction = predictWithKnnRegression(usableRows, currentDate)

  if (knnPrediction != null) {
    return {
      predictedWaitMinutes: knnPrediction,
      basedOnRows: usableRows.length,
      fallbackUsed: false,
      strategy: 'knn-regression',
      message: null,
    }
  }

  if (usableRows.length >= MIN_HISTORY_ROWS) {
    return {
      predictedWaitMinutes: average(
        usableRows.map(row => calculateWaitMinutes(row.joined_at, row.called_at))
      ),
      basedOnRows: usableRows.length,
      fallbackUsed: false,
      strategy: 'historical-average-fallback',
      message: 'Prediction used historical average because there were not enough similar records',
    }
  }

  return {
    predictedWaitMinutes: DEFAULT_PREDICTED_WAIT_MINUTES,
    basedOnRows: usableRows.length,
    fallbackUsed: true,
    strategy: 'default-fallback',
    message: 'Not enough historical queue data yet',
  }
}

module.exports = {
  DEFAULT_PREDICTED_WAIT_MINUTES,
  calculateDistance,
  calculateWaitMinutes,
  getJohannesburgDateParts,
  buildTimeFeatureVector,
  predictWithKnnRegression,
  predictWaitTimeFromHistory,
}