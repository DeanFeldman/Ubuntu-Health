jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}))

const nodemailer = require('nodemailer')

const {
  buildAppointmentConfirmationEmail,
  sendAppointmentConfirmationEmail,
  buildAppointmentCancellationEmail,
  sendAppointmentCancellationEmail,
  buildAppointmentRescheduleEmail,
  sendAppointmentRescheduleEmail,
} = require('../../../src/emailService')

describe('emailService', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.GMAIL_USER
    delete process.env.GMAIL_APP_PASSWORD
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('buildAppointmentConfirmationEmail', () => {
    test('builds appointment confirmation email with appointment details', () => {
      const email = buildAppointmentConfirmationEmail({
        patientName: 'Jane Patient',
        clinicName: 'Ubuntu Clinic',
        date: '2099-05-11',
        time: '09:30',
      })

      expect(email.subject).toBe('Appointment Confirmation — Ubuntu Clinic')
      expect(email.text).toContain('Hi Jane Patient,')
      expect(email.text).toContain('Your appointment has been confirmed.')
      expect(email.text).toContain('Clinic:  Ubuntu Clinic')
      expect(email.text).toContain('Date:    2099-05-11')
      expect(email.text).toContain('Time:    09:30')
      expect(email.text).toContain('Ubuntu Health')
    })

    test('uses fallback values when appointment details are missing', () => {
      const email = buildAppointmentConfirmationEmail({})

      expect(email.subject).toBe('Appointment Confirmation — the clinic')
      expect(email.text).toContain('Hi Patient,')
      expect(email.text).toContain('Clinic:  the clinic')
      expect(email.text).toContain('Date:    Unknown date')
      expect(email.text).toContain('Time:    Unknown time')
    })

    test('trims the generated email body', () => {
      const email = buildAppointmentConfirmationEmail({
        patientName: 'Jane Patient',
        clinicName: 'Ubuntu Clinic',
        date: '2099-05-11',
        time: '09:30',
      })

      expect(email.text.startsWith('Hi Jane Patient,')).toBe(true)
      expect(email.text.endsWith('Ubuntu Health')).toBe(true)
    })
  })

  describe('sendAppointmentConfirmationEmail', () => {
    test('skips sending when recipient email is missing', async () => {
      const result = await sendAppointmentConfirmationEmail({
        to: '',
        patientName: 'Jane Patient',
        clinicName: 'Ubuntu Clinic',
        date: '2099-05-11',
        time: '09:30',
      })

      expect(result).toEqual({
        sent: false,
        reason: 'no_email',
      })

      expect(nodemailer.createTransport).not.toHaveBeenCalled()
    })

    test('skips sending when Gmail credentials are missing', async () => {
      const result = await sendAppointmentConfirmationEmail({
        to: 'jane@example.com',
        patientName: 'Jane Patient',
        clinicName: 'Ubuntu Clinic',
        date: '2099-05-11',
        time: '09:30',
      })

      expect(result).toEqual({
        sent: false,
        reason: 'no_credentials',
      })

      expect(nodemailer.createTransport).not.toHaveBeenCalled()
    })

    test('sends confirmation email when recipient and credentials exist', async () => {
      process.env.GMAIL_USER = 'ubuntu@example.com'
      process.env.GMAIL_APP_PASSWORD = 'app-password'

      const sendMail = jest.fn().mockResolvedValue({
        messageId: 'email-123',
      })

      nodemailer.createTransport.mockReturnValue({
        sendMail,
      })

      const result = await sendAppointmentConfirmationEmail({
        to: 'jane@example.com',
        patientName: 'Jane Patient',
        clinicName: 'Ubuntu Clinic',
        date: '2099-05-11',
        time: '09:30',
      })

      expect(result).toEqual({
        sent: true,
        id: 'email-123',
      })

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        service: 'gmail',
        auth: {
          user: 'ubuntu@example.com',
          pass: 'app-password',
        },
      })

      expect(sendMail).toHaveBeenCalledWith({
        from: 'Ubuntu Health <ubuntu@example.com>',
        to: 'jane@example.com',
        subject: 'Appointment Confirmation — Ubuntu Clinic',
        text: expect.stringContaining('Hi Jane Patient,'),
      })
    })

    test('returns exception result when email sending fails', async () => {
      process.env.GMAIL_USER = 'ubuntu@example.com'
      process.env.GMAIL_APP_PASSWORD = 'app-password'

      const error = new Error('SMTP failed')
      const sendMail = jest.fn().mockRejectedValue(error)

      nodemailer.createTransport.mockReturnValue({
        sendMail,
      })

      const result = await sendAppointmentConfirmationEmail({
        to: 'jane@example.com',
        patientName: 'Jane Patient',
        clinicName: 'Ubuntu Clinic',
        date: '2099-05-11',
        time: '09:30',
      })

      expect(result).toEqual({
        sent: false,
        reason: 'exception',
        error,
      })

      expect(sendMail).toHaveBeenCalled()
    })
  })

  describe('buildAppointmentCancellationEmail', () => {
    test('builds appointment cancellation email with appointment details', () => {
      const email = buildAppointmentCancellationEmail({
        patientName: 'Jane Patient',
        clinicName: 'Ubuntu Clinic',
        date: '2099-05-11',
        time: '09:30',
      })

      expect(email.subject).toBe('Appointment Cancelled — Ubuntu Clinic')
      expect(email.text).toContain('Hi Jane Patient,')
      expect(email.text).toContain('Your appointment has been cancelled.')
      expect(email.text).toContain('Clinic:  Ubuntu Clinic')
      expect(email.text).toContain('Date:    2099-05-11')
      expect(email.text).toContain('Time:    09:30')
      expect(email.text).toContain(
        'If you did not request this cancellation or would like to rebook'
      )
      expect(email.text).toContain('Ubuntu Health')
    })

    test('uses fallback values when cancellation appointment details are missing', () => {
      const email = buildAppointmentCancellationEmail({})

      expect(email.subject).toBe('Appointment Cancelled — the clinic')
      expect(email.text).toContain('Hi Patient,')
      expect(email.text).toContain('Your appointment has been cancelled.')
      expect(email.text).toContain('Clinic:  the clinic')
      expect(email.text).toContain('Date:    Unknown date')
      expect(email.text).toContain('Time:    Unknown time')
    })

    test('trims the generated cancellation email body', () => {
      const email = buildAppointmentCancellationEmail({
        patientName: 'Jane Patient',
        clinicName: 'Ubuntu Clinic',
        date: '2099-05-11',
        time: '09:30',
      })

      expect(email.text.startsWith('Hi Jane Patient,')).toBe(true)
      expect(email.text.endsWith('Ubuntu Health')).toBe(true)
    })
  })

  describe('sendAppointmentCancellationEmail', () => {
    test('skips cancellation email when recipient email is missing', async () => {
      const result = await sendAppointmentCancellationEmail({
        to: '',
        patientName: 'Jane Patient',
        clinicName: 'Ubuntu Clinic',
        date: '2099-05-11',
        time: '09:30',
      })

      expect(result).toEqual({
        sent: false,
        reason: 'no_email',
      })

      expect(nodemailer.createTransport).not.toHaveBeenCalled()
    })

    test('skips cancellation email when Gmail credentials are missing', async () => {
      const result = await sendAppointmentCancellationEmail({
        to: 'jane@example.com',
        patientName: 'Jane Patient',
        clinicName: 'Ubuntu Clinic',
        date: '2099-05-11',
        time: '09:30',
      })

      expect(result).toEqual({
        sent: false,
        reason: 'no_credentials',
      })

      expect(nodemailer.createTransport).not.toHaveBeenCalled()
    })

    test('sends cancellation email when recipient and credentials exist', async () => {
      process.env.GMAIL_USER = 'ubuntu@example.com'
      process.env.GMAIL_APP_PASSWORD = 'app-password'

      const sendMail = jest.fn().mockResolvedValue({
        messageId: 'cancel-email-123',
      })

      nodemailer.createTransport.mockReturnValue({
        sendMail,
      })

      const result = await sendAppointmentCancellationEmail({
        to: 'jane@example.com',
        patientName: 'Jane Patient',
        clinicName: 'Ubuntu Clinic',
        date: '2099-05-11',
        time: '09:30',
      })

      expect(result).toEqual({
        sent: true,
        id: 'cancel-email-123',
      })

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        service: 'gmail',
        auth: {
          user: 'ubuntu@example.com',
          pass: 'app-password',
        },
      })

      expect(sendMail).toHaveBeenCalledWith({
        from: 'Ubuntu Health <ubuntu@example.com>',
        to: 'jane@example.com',
        subject: 'Appointment Cancelled — Ubuntu Clinic',
        text: expect.stringContaining('Your appointment has been cancelled.'),
      })

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Clinic:  Ubuntu Clinic'),
        })
      )

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Date:    2099-05-11'),
        })
      )

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Time:    09:30'),
        })
      )
    })

    test('returns exception result when cancellation email sending fails', async () => {
      process.env.GMAIL_USER = 'ubuntu@example.com'
      process.env.GMAIL_APP_PASSWORD = 'app-password'

      const error = new Error('SMTP cancellation failed')
      const sendMail = jest.fn().mockRejectedValue(error)

      nodemailer.createTransport.mockReturnValue({
        sendMail,
      })

      const result = await sendAppointmentCancellationEmail({
        to: 'jane@example.com',
        patientName: 'Jane Patient',
        clinicName: 'Ubuntu Clinic',
        date: '2099-05-11',
        time: '09:30',
      })

      expect(result).toEqual({
        sent: false,
        reason: 'exception',
        error,
      })

      expect(sendMail).toHaveBeenCalled()
    })
  })
  describe('buildAppointmentRescheduleEmail', () => {
  test('builds appointment reschedule email with old and new appointment details', () => {
    const email = buildAppointmentRescheduleEmail({
      patientName: 'Jane Patient',
      clinicName: 'Ubuntu Clinic',
      oldDate: '2099-05-11',
      oldTime: '09:30',
      newDate: '2099-05-12',
      newTime: '10:45',
    })

    expect(email.subject).toBe('Appointment Rescheduled — Ubuntu Clinic')
    expect(email.text).toContain('Hi Jane Patient,')
    expect(email.text).toContain('Your appointment has been rescheduled.')
    expect(email.text).toContain('Clinic:       Ubuntu Clinic')
    expect(email.text).toContain('Previous:     2099-05-11 at 09:30')
    expect(email.text).toContain('New date:     2099-05-12')
    expect(email.text).toContain('New time:     10:45')
    expect(email.text).toContain('Ubuntu Health')
  })

  test('uses fallback values when reschedule appointment details are missing', () => {
    const email = buildAppointmentRescheduleEmail({})

    expect(email.subject).toBe('Appointment Rescheduled — the clinic')
    expect(email.text).toContain('Hi Patient,')
    expect(email.text).toContain('Clinic:       the clinic')
    expect(email.text).toContain('Previous:     Unknown date at Unknown time')
    expect(email.text).toContain('New date:     Unknown date')
    expect(email.text).toContain('New time:     Unknown time')
  })

  test('trims the generated reschedule email body', () => {
    const email = buildAppointmentRescheduleEmail({
      patientName: 'Jane Patient',
      clinicName: 'Ubuntu Clinic',
      oldDate: '2099-05-11',
      oldTime: '09:30',
      newDate: '2099-05-12',
      newTime: '10:45',
    })

    expect(email.text.startsWith('Hi Jane Patient,')).toBe(true)
    expect(email.text.endsWith('Ubuntu Health')).toBe(true)
  })
})

describe('sendAppointmentRescheduleEmail', () => {
  test('skips reschedule email when recipient email is missing', async () => {
    const result = await sendAppointmentRescheduleEmail({
      to: '',
      patientName: 'Jane Patient',
      clinicName: 'Ubuntu Clinic',
      oldDate: '2099-05-11',
      oldTime: '09:30',
      newDate: '2099-05-12',
      newTime: '10:45',
    })

    expect(result).toEqual({
      sent: false,
      reason: 'no_email',
    })

    expect(nodemailer.createTransport).not.toHaveBeenCalled()
  })

  test('skips reschedule email when Gmail credentials are missing', async () => {
    const result = await sendAppointmentRescheduleEmail({
      to: 'jane@example.com',
      patientName: 'Jane Patient',
      clinicName: 'Ubuntu Clinic',
      oldDate: '2099-05-11',
      oldTime: '09:30',
      newDate: '2099-05-12',
      newTime: '10:45',
    })

    expect(result).toEqual({
      sent: false,
      reason: 'no_credentials',
    })

    expect(nodemailer.createTransport).not.toHaveBeenCalled()
  })

  test('sends reschedule email when recipient and credentials exist', async () => {
    process.env.GMAIL_USER = 'ubuntu@example.com'
    process.env.GMAIL_APP_PASSWORD = 'app-password'

    const sendMail = jest.fn().mockResolvedValue({
      messageId: 'reschedule-email-123',
    })

    nodemailer.createTransport.mockReturnValue({
      sendMail,
    })

    const result = await sendAppointmentRescheduleEmail({
      to: 'jane@example.com',
      patientName: 'Jane Patient',
      clinicName: 'Ubuntu Clinic',
      oldDate: '2099-05-11',
      oldTime: '09:30',
      newDate: '2099-05-12',
      newTime: '10:45',
    })

    expect(result).toEqual({
      sent: true,
      id: 'reschedule-email-123',
    })

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      service: 'gmail',
      auth: {
        user: 'ubuntu@example.com',
        pass: 'app-password',
      },
    })

    expect(sendMail).toHaveBeenCalledWith({
      from: 'Ubuntu Health <ubuntu@example.com>',
      to: 'jane@example.com',
      subject: 'Appointment Rescheduled — Ubuntu Clinic',
      text: expect.stringContaining('Your appointment has been rescheduled.'),
    })

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Previous:     2099-05-11 at 09:30'),
      })
    )

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('New date:     2099-05-12'),
      })
    )

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('New time:     10:45'),
      })
    )
  })

  test('returns exception result when reschedule email sending fails', async () => {
    process.env.GMAIL_USER = 'ubuntu@example.com'
    process.env.GMAIL_APP_PASSWORD = 'app-password'

    const error = new Error('SMTP reschedule failed')
    const sendMail = jest.fn().mockRejectedValue(error)

    nodemailer.createTransport.mockReturnValue({
      sendMail,
    })

    const result = await sendAppointmentRescheduleEmail({
      to: 'jane@example.com',
      patientName: 'Jane Patient',
      clinicName: 'Ubuntu Clinic',
      oldDate: '2099-05-11',
      oldTime: '09:30',
      newDate: '2099-05-12',
      newTime: '10:45',
    })

    expect(result).toEqual({
      sent: false,
      reason: 'exception',
      error,
    })

    expect(sendMail).toHaveBeenCalled()
  })
})
})