const {
  getClinicCloseTimeForDate,
  findMissedAppointmentIds,
  buildAutoNoShowResponse,
} = require('../../../src/appointmentAutoNoShowValidation')

const mondayClinic = {
  operating_hours: {
    monday: {
      open: '08:00',
      close: '17:00',
    },
  },
}

describe('appointmentAutoNoShowValidation', () => {
  describe('getClinicCloseTimeForDate', () => {
    test('returns close time plus two hours for the appointment day', () => {
      const result = getClinicCloseTimeForDate(
        mondayClinic,
        '2099-05-11T09:00:00.000Z'
      )

      expect(result).toBeInstanceOf(Date)
      expect(result.getHours()).toBe(19)
      expect(result.getMinutes()).toBe(0)
    })

    test('supports alternate close field names', () => {
      const clinic = {
        operating_hours: {
          monday: {
            end_time: '16:30',
          },
        },
      }

      const result = getClinicCloseTimeForDate(
        clinic,
        '2099-05-11T09:00:00.000Z'
      )

      expect(result).toBeInstanceOf(Date)
      expect(result.getHours()).toBe(18)
      expect(result.getMinutes()).toBe(30)
    })

    test('supports short day keys', () => {
      const clinic = {
        operating_hours: {
          mon: {
            close: '15:00',
          },
        },
      }

      const result = getClinicCloseTimeForDate(
        clinic,
        '2099-05-11T09:00:00.000Z'
      )

      expect(result).toBeInstanceOf(Date)
      expect(result.getHours()).toBe(17)
      expect(result.getMinutes()).toBe(0)
    })

    test('returns null for missing clinic or slot datetime', () => {
      expect(
        getClinicCloseTimeForDate(null, '2099-05-11T09:00:00.000Z')
      ).toBeNull()

      expect(getClinicCloseTimeForDate(mondayClinic, null)).toBeNull()
    })

    test('returns null for invalid slot datetime', () => {
      expect(getClinicCloseTimeForDate(mondayClinic, 'not-a-date')).toBeNull()
    })

    test('returns null when clinic has no hours for appointment day', () => {
      const clinic = {
        operating_hours: {
          tuesday: {
            close: '17:00',
          },
        },
      }

      expect(
        getClinicCloseTimeForDate(clinic, '2099-05-11T09:00:00.000Z')
      ).toBeNull()
    })

    test('returns null when clinic day has no close time', () => {
      const clinic = {
        operating_hours: {
          monday: {
            open: '08:00',
          },
        },
      }

      expect(
        getClinicCloseTimeForDate(clinic, '2099-05-11T09:00:00.000Z')
      ).toBeNull()
    })

    test('returns null when close time cannot be parsed', () => {
      const clinic = {
        operating_hours: {
          monday: {
            close: 'bad-time',
          },
        },
      }

      expect(
        getClinicCloseTimeForDate(clinic, '2099-05-11T09:00:00.000Z')
      ).toBeNull()
    })
  })

  describe('findMissedAppointmentIds', () => {
    test('returns appointment IDs where current time is after clinic close grace period', () => {
      const result = findMissedAppointmentIds({
        appointments: [
          {
            id: 'appointment-1',
            clinic_id: 'clinic-1',
            slot_id: 'slot-1',
          },
          {
            id: 'appointment-2',
            clinic_id: 'clinic-1',
            slot_id: 'slot-2',
          },
        ],
        slotsById: {
          'slot-1': {
            slot_datetime: '2099-05-11T09:00:00.000Z',
          },
          'slot-2': {
            slot_datetime: '2099-05-11T10:00:00.000Z',
          },
        },
        clinicsById: {
          'clinic-1': mondayClinic,
        },
        now: new Date('2099-05-11T17:00:00.000Z'),
      })

      expect(result).toEqual(['appointment-1', 'appointment-2'])
    })

    test('does not return appointments before clinic close grace period', () => {
      const result = findMissedAppointmentIds({
        appointments: [
          {
            id: 'appointment-1',
            clinic_id: 'clinic-1',
            slot_id: 'slot-1',
          },
        ],
        slotsById: {
          'slot-1': {
            slot_datetime: '2099-05-11T09:00:00.000Z',
          },
        },
        clinicsById: {
          'clinic-1': mondayClinic,
        },
        now: new Date('2099-05-11T16:59:59.000Z'),
      })

      expect(result).toEqual([])
    })

    test('uses single clinic argument when provided', () => {
      const result = findMissedAppointmentIds({
        appointments: [
          {
            id: 'appointment-1',
            clinic_id: 'clinic-1',
            slot_id: 'slot-1',
          },
        ],
        slotsById: {
          'slot-1': {
            slot_datetime: '2099-05-11T09:00:00.000Z',
          },
        },
        clinic: mondayClinic,
        now: new Date('2099-05-11T17:00:00.000Z'),
      })

      expect(result).toEqual(['appointment-1'])
    })

    test('skips appointments without slot datetime or clinic', () => {
      const result = findMissedAppointmentIds({
        appointments: [
          {
            id: 'missing-slot',
            clinic_id: 'clinic-1',
            slot_id: 'slot-missing',
          },
          {
            id: 'missing-clinic',
            clinic_id: 'clinic-missing',
            slot_id: 'slot-1',
          },
        ],
        slotsById: {
          'slot-1': {
            slot_datetime: '2099-05-11T09:00:00.000Z',
          },
        },
        clinicsById: {
          'clinic-1': mondayClinic,
        },
        now: new Date('2099-05-11T17:00:00.000Z'),
      })

      expect(result).toEqual([])
    })

    test('skips appointments when no auto no-show time can be calculated', () => {
      const result = findMissedAppointmentIds({
        appointments: [
          {
            id: 'appointment-1',
            clinic_id: 'clinic-1',
            slot_id: 'slot-1',
          },
        ],
        slotsById: {
          'slot-1': {
            slot_datetime: '2099-05-11T09:00:00.000Z',
          },
        },
        clinicsById: {
          'clinic-1': {
            operating_hours: {
              monday: {
                open: '08:00',
              },
            },
          },
        },
        now: new Date('2099-05-11T17:00:00.000Z'),
      })

      expect(result).toEqual([])
    })

    test('handles default empty inputs', () => {
      expect(findMissedAppointmentIds()).toEqual([])
    })
  })

  describe('buildAutoNoShowResponse', () => {
    test('returns no missed appointments response for empty updates', () => {
      expect(buildAutoNoShowResponse()).toEqual({
        message: 'No missed appointments found',
        updatedCount: 0,
        appointments: [],
      })
    })

    test('returns updated appointment response', () => {
      const appointments = [
        {
          id: 'appointment-1',
          status: 'No-show',
        },
      ]

      expect(buildAutoNoShowResponse(appointments)).toEqual({
        message: '1 appointment(s) marked as No-show',
        updatedCount: 1,
        appointments,
      })
    })
  })
})