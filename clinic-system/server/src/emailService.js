const { Resend } = require('resend')

const resend = new Resend(process.env.RESEND_API_KEY)

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

  if (!process.env.RESEND_API_KEY) {
    console.warn('sendAppointmentConfirmationEmail: RESEND_API_KEY not set, skipping')
    return { sent: false, reason: 'no_api_key' }
  }

  const { subject, text } = buildAppointmentConfirmationEmail({
    patientName,
    clinicName,
    date,
    time,
  })

  try {
    const { data, error } = await resend.emails.send({
      from: 'Ubuntu Health <no-reply@ubuntuhealth.co.za>',
      to,
      subject,
      text,
    })

    if (error) {
      console.error('Failed to send confirmation email:', error)
      return { sent: false, reason: 'resend_error', error }
    }

    console.log('Confirmation email sent:', data?.id)
    return { sent: true, id: data?.id }
  } catch (err) {
    console.error('Failed to send confirmation email:', err)
    return { sent: false, reason: 'exception', error: err }
  }
}

module.exports = {
  buildAppointmentConfirmationEmail,
  sendAppointmentConfirmationEmail,
}