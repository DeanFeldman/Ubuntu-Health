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
Hi ${displayName},

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

function buildAppointmentCancellationEmail({ patientName, clinicName, date, time }) {
  const displayName = patientName || 'Patient'
  const displayDate = date || 'Unknown date'
  const displayTime = time || 'Unknown time'
  const displayClinic = clinicName || 'the clinic'

  const subject = `Appointment Cancelled — ${displayClinic}`

  const text = `
Hi ${displayName},

Your appointment has been cancelled.

Clinic:  ${displayClinic}
Date:    ${displayDate}
Time:    ${displayTime}

If you did not request this cancellation or would like to rebook, please contact the clinic directly.

Ubuntu Health
  `.trim()

  return { subject, text }
}

async function sendAppointmentCancellationEmail({ to, patientName, clinicName, date, time }) {
  if (!to) {
    console.warn('sendAppointmentCancellationEmail: no recipient email, skipping')
    return { sent: false, reason: 'no_email' }
  }

  const transporter = getTransporter()
  if (!transporter) {
    console.warn('sendAppointmentCancellationEmail: GMAIL_USER or GMAIL_APP_PASSWORD not set, skipping')
    return { sent: false, reason: 'no_credentials' }
  }

  const { subject, text } = buildAppointmentCancellationEmail({
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

    console.log('Cancellation email sent:', info.messageId)
    return { sent: true, id: info.messageId }
  } catch (err) {
    console.error('Failed to send cancellation email:', err)
    return { sent: false, reason: 'exception', error: err }
  }
}

function buildAppointmentRescheduleEmail({ patientName, clinicName, newDate, newTime, oldDate, oldTime }) {
  const displayName = patientName || 'Patient'
  const displayClinic = clinicName || 'the clinic'
  const displayNewDate = newDate || 'Unknown date'
  const displayNewTime = newTime || 'Unknown time'
  const displayOldDate = oldDate || 'Unknown date'
  const displayOldTime = oldTime || 'Unknown time'

  const subject = `Appointment Rescheduled — ${displayClinic}`

  const text = `
Hi ${displayName},

Your appointment has been rescheduled.

Clinic:       ${displayClinic}
Previous:     ${displayOldDate} at ${displayOldTime}
New date:     ${displayNewDate}
New time:     ${displayNewTime}

Please arrive a few minutes early. If you need to make further changes, please contact the clinic directly.

Ubuntu Health
  `.trim()

  return { subject, text }
}

async function sendAppointmentRescheduleEmail({ to, patientName, clinicName, newDate, newTime, oldDate, oldTime }) {
  if (!to) {
    console.warn('sendAppointmentRescheduleEmail: no recipient email, skipping')
    return { sent: false, reason: 'no_email' }
  }

  const transporter = getTransporter()
  if (!transporter) {
    console.warn('sendAppointmentRescheduleEmail: GMAIL_USER or GMAIL_APP_PASSWORD not set, skipping')
    return { sent: false, reason: 'no_credentials' }
  }

  const { subject, text } = buildAppointmentRescheduleEmail({
    patientName,
    clinicName,
    newDate,
    newTime,
    oldDate,
    oldTime,
  })

  try {
    const info = await transporter.sendMail({
      from: `Ubuntu Health <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
    })

    console.log('Reschedule email sent:', info.messageId)
    return { sent: true, id: info.messageId }
  } catch (err) {
    console.error('Failed to send reschedule email:', err)
    return { sent: false, reason: 'exception', error: err }
  }
}

module.exports = {
  buildAppointmentConfirmationEmail,
  sendAppointmentConfirmationEmail,
  buildAppointmentCancellationEmail,
  sendAppointmentCancellationEmail,
  buildAppointmentRescheduleEmail,
  sendAppointmentRescheduleEmail,
}