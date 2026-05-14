function buildDateRangeLabel(startDate, endDate) {
  if (startDate && endDate) return `${startDate} to ${endDate}`
  if (startDate) return `From ${startDate}`
  if (endDate) return `Up to ${endDate}`
  return 'All time'
}

function roundAverage(sum, count) {
  if (!count) return null
  return Number((sum / count).toFixed(2))
}

function getWaitMinutes(entry) {
  if (!entry?.joined_at || !entry?.called_at) return null

  const joinedAt = new Date(entry.joined_at)
  const calledAt = new Date(entry.called_at)

  if (
    Number.isNaN(joinedAt.getTime()) ||
    Number.isNaN(calledAt.getTime()) ||
    calledAt < joinedAt
  ) {
    return null
  }

  return (calledAt - joinedAt) / 60000
}

function getHourInSouthAfrica(dateValue) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null

  const hourPart = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .find((part) => part.type === 'hour')

  const hour = Number(hourPart?.value)
  return Number.isFinite(hour) ? hour % 24 : null
}

function getTimeOfDay(dateValue) {
  const hour = getHourInSouthAfrica(dateValue)

  if (hour === null) return null
  if (hour >= 5 && hour <= 11) return 'Morning'
  if (hour >= 12 && hour <= 16) return 'Afternoon'
  if (hour >= 17 && hour <= 20) return 'Evening'
  return 'Night'
}

function addAggregateValue(aggregate, waitMinutes) {
  aggregate.sum += waitMinutes
  aggregate.count += 1
}

function buildAverageWaitTimeReport({
  entries,
  clinicsById,
  selectedClinic,
  filters,
}) {
  const safeEntries = Array.isArray(entries) ? entries : []
  const safeClinicsById = clinicsById || {}
  const safeFilters = filters || {}

  const byClinic = {}
  const timeOfDayOrder = ['Morning', 'Afternoon', 'Evening', 'Night']
  const byTimeOfDay = Object.fromEntries(
    timeOfDayOrder.map((timeOfDay) => [
      timeOfDay,
      {
        sum: 0,
        count: 0,
      },
    ])
  )
  const summary = {
    sum: 0,
    count: 0,
  }

  for (const entry of safeEntries) {
    const waitMinutes = getWaitMinutes(entry)
    if (waitMinutes === null) continue

    const clinicId = entry.clinic_id || null
    const clinicName = safeClinicsById[clinicId]?.name || 'Unknown clinic'

    if (!byClinic[clinicId]) {
      byClinic[clinicId] = {
        clinic_id: clinicId,
        clinic_name: clinicName,
        sum: 0,
        count: 0,
      }
    }

    addAggregateValue(summary, waitMinutes)
    addAggregateValue(byClinic[clinicId], waitMinutes)

    const timeOfDay = getTimeOfDay(entry.joined_at)
    if (timeOfDay) {
      addAggregateValue(byTimeOfDay[timeOfDay], waitMinutes)
    }
  }

  if (selectedClinic && !byClinic[selectedClinic.id]) {
    byClinic[selectedClinic.id] = {
      clinic_id: selectedClinic.id,
      clinic_name: selectedClinic.name,
      sum: 0,
      count: 0,
    }
  }

  return {
    filters: {
      clinic_id: safeFilters.clinicId || null,
      clinic_name: selectedClinic?.name || 'All clinics',
      start_date: safeFilters.startDate || null,
      end_date: safeFilters.endDate || null,
      date_range_label: buildDateRangeLabel(
        safeFilters.startDate,
        safeFilters.endDate
      ),
    },
    summary: {
      overall_average_wait_time_minutes: roundAverage(summary.sum, summary.count),
      queue_records_used: summary.count,
    },
    by_clinic: Object.values(byClinic)
      .sort((a, b) => (a.clinic_name || '').localeCompare(b.clinic_name || ''))
      .map((clinicAggregate) => ({
        clinic_id: clinicAggregate.clinic_id,
        clinic_name: clinicAggregate.clinic_name,
        average_wait_time_minutes: roundAverage(
          clinicAggregate.sum,
          clinicAggregate.count
        ),
        queue_records_used: clinicAggregate.count,
      })),
    by_time_of_day: timeOfDayOrder.map((timeOfDay) => ({
      time_of_day: timeOfDay,
      average_wait_time_minutes: roundAverage(
        byTimeOfDay[timeOfDay].sum,
        byTimeOfDay[timeOfDay].count
      ),
      queue_records_used: byTimeOfDay[timeOfDay].count,
    })),
  }
}

module.exports = {
  buildDateRangeLabel,
  roundAverage,
  getWaitMinutes,
  getHourInSouthAfrica,
  getTimeOfDay,
  buildAverageWaitTimeReport,
}