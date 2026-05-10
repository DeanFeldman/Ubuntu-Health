const {
  getClinicCloseTimeForDate,
  findMissedAppointmentIds,
  buildAutoNoShowResponse,
} = require('../../../src/appointmentAutoNoShowValidation')

const MONDAY_SLOT_DATETIME = '2099-05-11T09:00:00.000Z'

const mondayClinic = {
  operating_hours: {
    monday: {
      open: '08:00',
      close: '17:00',
    },
  },
}

function appointment(overrides = {}) {
  return {
    id: 'appointment-1',
    clinic_id: 'clinic-1',
    slot_id: 'slot-1',
    ...overrides,
  }
}

function slotsById(slotDatetime = MONDAY_SLOT_DATETIME) {
  return {
    'slot-1': {
      slot_datetime: slotDatetime,
    },
  }
}

describe('appointmentAutoNoShowValidation', () => {
  describe('getClinicCloseTimeForDate', () => {
    test('returns clinic close time plus two hours for the appointment day', () => {
      const result = getClinicCloseTimeForDate(
        mondayClinic,
        MONDAY_SLOT_DATETIME
      )

      expect(result).toBeInstanceOf(Date)
      expect(result.getHours()).toBe(19)
      expect(result.getMinutes()).toBe(0)
    })

    test.each([
      ['close', '17:00', 19, 0],
      ['end', '16:00', 18, 0],
      ['end_time', '16:30', 18, 30],
      ['closing_time', '15:45', 17, 45],
    ])(
      'supports %s as a clinic closing time field',
      (fieldName, closeTime, expectedHour, expectedMinute) => {
        const clinic = {
          operating_hours: {
            monday: {
              [fieldName]: closeTime,
            },
          },
        }

        const result = getClinicCloseTimeForDate(
          clinic,
          MONDAY_SLOT_DATETIME
        )

        expect(result).toBeInstanceOf(Date)
        expect(result.getHours()).toBe(expectedHour)
        expect(result.getMinutes()).toBe(expectedMinute)
      }
    )

    test('supports short weekday keys', () => {
      const clinic = {
        operating_hours: {
          mon: {
            close: '15:00',
          },
        },
      }

      const result = getClinicCloseTimeForDate(
        clinic,
        MONDAY_SLOT_DATETIME
      )

      expect(result).toBeInstanceOf(Date)
      expect(result.getHours()).toBe(17)
      expect(result.getMinutes()).toBe(0)
    })

    test('returns null when clinic is missing', () => {
      expect(
        getClinicCloseTimeForDate(null, MONDAY_SLOT_DATETIME)
      ).toBeNull()
    })

    test('returns null when slot datetime is missing', () => {
      expect(getClinicCloseTimeForDate(mondayClinic, null)).toBeNull()
    })

    test('returns null when slot datetime is invalid', () => {
      expect(getClinicCloseTimeForDate(mondayClinic, 'not-a-date')).toBeNull()
    })

    test('returns null when clinic has no hours for the appointment day', () => {
      const clinic = {
        operating_hours: {
          tuesday: {
            close: '17:00',
          },
        },
      }

      expect(
        getClinicCloseTimeForDate(clinic, MONDAY_SLOT_DATETIME)
      ).toBeNull()
    })

    test('returns null when the clinic day has no close time', () => {
      const clinic = {
        operating_hours: {
          monday: {
            open: '08:00',
          },
        },
      }

      expect(
        getClinicCloseTimeForDate(clinic, MONDAY_SLOT_DATETIME)
      ).toBeNull()
    })

    test('returns null when the close time cannot be parsed', () => {
      const clinic = {
        operating_hours: {
          monday: {
            close: 'bad-time',
          },
        },
      }

      expect(
        getClinicCloseTimeForDate(clinic, MONDAY_SLOT_DATETIME)
      ).toBeNull()
    })
  })

  describe('findMissedAppointmentIds', () => {
    test('returns appointment IDs when now is after clinic close plus grace period', () => {
      const autoNoShowTime = getClinicCloseTimeForDate(
        mondayClinic,
        MONDAY_SLOT_DATETIME
      )

      const result = findMissedAppointmentIds({
        appointments: [
          appointment({ id: 'appointment-1', slot_id: 'slot-1' }),
          appointment({ id: 'appointment-2', slot_id: 'slot-2' }),
        ],
        slotsById: {
          'slot-1': {
            slot_datetime: MONDAY_SLOT_DATETIME,
          },
          'slot-2': {
            slot_datetime: '2099-05-11T10:00:00.000Z',
          },
        },
        clinicsById: {
          'clinic-1': mondayClinic,
        },
        now: new Date(autoNoShowTime.getTime() + 1),
      })

      expect(result).toEqual(['appointment-1', 'appointment-2'])
    })

    test('does not return appointments before clinic close plus grace period', () => {
      const autoNoShowTime = getClinicCloseTimeForDate(
        mondayClinic,
        MONDAY_SLOT_DATETIME
      )

      const result = findMissedAppointmentIds({
        appointments: [appointment()],
        slotsById: slotsById(),
        clinicsById: {
          'clinic-1': mondayClinic,
        },
        now: new Date(autoNoShowTime.getTime() - 1),
      })

      expect(result).toEqual([])
    })

    test('includes appointments exactly at clinic close plus grace period', () => {
      const autoNoShowTime = getClinicCloseTimeForDate(
        mondayClinic,
        MONDAY_SLOT_DATETIME
      )

      const result = findMissedAppointmentIds({
        appointments: [appointment()],
        slotsById: slotsById(),
        clinicsById: {
          'clinic-1': mondayClinic,
        },
        now: autoNoShowTime,
      })

      expect(result).toEqual(['appointment-1'])
    })

    test('uses single clinic argument when provided', () => {
      const autoNoShowTime = getClinicCloseTimeForDate(
        mondayClinic,
        MONDAY_SLOT_DATETIME
      )

      const result = findMissedAppointmentIds({
        appointments: [appointment()],
        slotsById: slotsById(),
        clinic: mondayClinic,
        now: new Date(autoNoShowTime.getTime() + 1),
      })

      expect(result).toEqual(['appointment-1'])
    })

    test('skips appointments without a matching slot datetime', () => {
      const autoNoShowTime = getClinicCloseTimeForDate(
        mondayClinic,
        MONDAY_SLOT_DATETIME
      )

      const result = findMissedAppointmentIds({
        appointments: [
          appointment({
            id: 'missing-slot',
            slot_id: 'missing-slot-id',
          }),
        ],
        slotsById: slotsById(),
        clinicsById: {
          'clinic-1': mondayClinic,
        },
        now: new Date(autoNoShowTime.getTime() + 1),
      })

      expect(result).toEqual([])
    })

    test('skips appointments without a matching clinic', () => {
      const autoNoShowTime = getClinicCloseTimeForDate(
        mondayClinic,
        MONDAY_SLOT_DATETIME
      )

      const result = findMissedAppointmentIds({
        appointments: [
          appointment({
            id: 'missing-clinic',
            clinic_id: 'missing-clinic-id',
          }),
        ],
        slotsById: slotsById(),
        clinicsById: {
          'clinic-1': mondayClinic,
        },
        now: new Date(autoNoShowTime.getTime() + 1),
      })

      expect(result).toEqual([])
    })

    test('skips appointments when auto no-show time cannot be calculated', () => {
      const autoNoShowTime = getClinicCloseTimeForDate(
        mondayClinic,
        MONDAY_SLOT_DATETIME
      )

      const clinicWithoutCloseTime = {
        operating_hours: {
          monday: {
            open: '08:00',
          },
        },
      }

      const result = findMissedAppointmentIds({
        appointments: [appointment()],
        slotsById: slotsById(),
        clinicsById: {
          'clinic-1': clinicWithoutCloseTime,
        },
        now: new Date(autoNoShowTime.getTime() + 1),
      })

      expect(result).toEqual([])
    })

    test('handles default empty inputs', () => {
      expect(findMissedAppointmentIds()).toEqual([])
    })
  })

  describe('buildAutoNoShowResponse', () => {
    test('returns no missed appointments response when no appointments were updated', () => {
      expect(buildAutoNoShowResponse()).toEqual({
        message: 'No missed appointments found',
        updatedCount: 0,
        appointments: [],
      })
    })

    test('returns updated appointment response when appointments were marked no-show', () => {
      const updatedAppointments = [
        {
          id: 'appointment-1',
          status: 'No-show',
        },
        {
          id: 'appointment-2',
          status: 'No-show',
        },
      ]

      expect(buildAutoNoShowResponse(updatedAppointments)).toEqual({
        message: '2 appointment(s) marked as No-show',
        updatedCount: 2,
        appointments: updatedAppointments,
      })
    })
  })
})