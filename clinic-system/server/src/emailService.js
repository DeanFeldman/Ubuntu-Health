const nodemailer = require('nodemailer')

function getTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

function buildAppointmentConfirmationEmail({ patientName, clinicName, date, time }) {
  const displayName = patientName || 'Patient'
  const displayDate = date || 'Unknown date'
  const displayTime = time || 'Unknown time'
  const displayClinic = clinicName || 'the clinic'

  const subject = `Appointment Confirmation — ${displayClinic}`

  const text = `
Hi  ${displayName},

Your appointment has been confirmed.

Clinic:  ${displayClinic}
Date:    ${displayDate}
Time:    ${displayTime}

Please arrive a few minutes early. If you need to cancel or reschedule, please contact the clinic directly.

Ubuntu Health
  `.trim()

  return { subject, text }
}

async function sendAppointmentConfirmationEmail({ to, patientName, clinicName, date, time }) {
  if (!to) {
    console.warn('sendAppointmentConfirmationEmail: no recipient email, skipping')
    return { sent: false, reason: 'no_email' }
  }

  const transporter = getTransporter()
  if (!transporter) {
    console.warn('sendAppointmentConfirmationEmail: GMAIL_USER or GMAIL_APP_PASSWORD not set, skipping')
    return { sent: false, reason: 'no_credentials' }
  }

  const { subject, text } = buildAppointmentConfirmationEmail({
    patientName,
    clinicName,
    date,
    time,
  })

  try {
    const info = await transporter.sendMail({
      from: `Ubuntu Health <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
    })

    console.log('Confirmation email sent:', info.messageId)
    return { sent: true, id: info.messageId }
  } catch (err) {
    console.error('Failed to send confirmation email:', err)
    return { sent: false, reason: 'exception', error: err }
  }
}

module.exports = {
  buildAppointmentConfirmationEmail,
  sendAppointmentConfirmationEmail,
}