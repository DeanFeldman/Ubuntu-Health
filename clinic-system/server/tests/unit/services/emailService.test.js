jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}))

const nodemailer = require('nodemailer')

const {
  buildAppointmentConfirmationEmail,
  sendAppointmentConfirmationEmail,
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
})