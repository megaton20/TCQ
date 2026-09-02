const axios = require('axios');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Shared branded wrapper for every transactional email - green/gold theme
 * matching the site, single-column, renders fine in Gmail/Outlook/etc.
 * `bodyHtml` is the email-specific content dropped into the middle.
 */
function wrapEmail(bodyHtml, { preheader = '' } = {}) {
  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#FBF7EE;font-family:Segoe UI,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:#FBF7EE;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7EE;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;max-width:480px;width:92%;">
            <tr>
              <td style="background:linear-gradient(135deg,#0B5D33 0%,#073D21 100%);padding:28px 32px;text-align:center;">
                <div style="color:#D4AF37;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">The Carnival Queen</div>
                <div style="color:#ffffff;font-size:22px;font-weight:bold;">&#128081; The Carnival Queen</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#333333;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#FBF7EE;text-align:center;color:#9a9a9a;font-size:12px;">
                &copy; ${new Date().getFullYear()} The Carnival Queen. This is an automated message - please don't reply directly to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

function buttonHtml(url, label) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="background:#0B5D33;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 32px;border-radius:999px;display:inline-block;">${label}</a>
  </div>`;
}

/**
 * Sends via Brevo's transactional email API. Never throws - callers get
 * back { sent: true } or { sent: false, reason } and decide the UX from
 * there. This is deliberate: hitting Brevo's free-plan daily send cap (or
 * any other outage) should never block account creation, ticket purchases,
 * or password resets - the app just tells the person the email couldn't go
 * out right now, rather than failing the whole action.
 */
async function sendEmail({ to, toName, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('[email] BREVO_API_KEY not set - skipping send:', subject);
    return { sent: false, reason: 'Email service is not configured.' };
  }

  try {
    await axios.post(BREVO_API_URL, {
      sender: {
        email: process.env.BREVO_SENDER_EMAIL || 'no-reply@carnivalqueen.com',
        name: process.env.BREVO_SENDER_NAME || 'The Carnival Queen'
      },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html
    }, {
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 15000
    });
    return { sent: true };
  } catch (err) {
    // Brevo's free plan returns a 402 (or a quota-related error code) once
    // the daily send limit is hit - treated the same as any other failure
    // here: log the detail server-side, tell the caller it didn't go out.
    const detail = err.response?.data?.message || err.message;
    console.error(`[email] Send failed ("${subject}" to ${to}):`, detail);
    return { sent: false, reason: 'Email service is currently unavailable.' };
  }
}

async function sendVerificationEmail(user, verifyUrl) {
  const html = wrapEmail(`
    <h2 style="color:#0B5D33;margin-top:0;">Verify your email</h2>
    <p>Hi ${user.fullName.split(' ')[0]}, welcome to The Carnival Queen! Confirm your email address to start voting, buying tickets, and applying as a contestant.</p>
    ${buttonHtml(verifyUrl, 'Verify My Email')}
    <p style="color:#888;font-size:13px;">This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>
  `, { preheader: 'Confirm your email to activate your account.' });

  return sendEmail({ to: user.email, toName: user.fullName, subject: 'Verify your email - The Carnival Queen', html });
}

async function sendPasswordResetEmail(user, resetUrl) {
  const html = wrapEmail(`
    <h2 style="color:#0B5D33;margin-top:0;">Reset your password</h2>
    <p>Hi ${user.fullName.split(' ')[0]}, we received a request to reset your password.</p>
    ${buttonHtml(resetUrl, 'Reset Password')}
    <p style="color:#888;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email - your password won't be changed.</p>
  `, { preheader: 'Reset your Carnival Queen password.' });

  return sendEmail({ to: user.email, toName: user.fullName, subject: 'Reset your password - The Carnival Queen', html });
}

async function sendTicketEmail(user, ticket, event, tier) {
  const qrUrl = ticket.qrImageCloudinaryUrl || null; // only embed if we have a durable, publicly-reachable URL
  const eventDate = new Date(event.eventDate);
  const dateStr = eventDate.toLocaleDateString('en-GB');
  const timeStr = eventDate.toLocaleTimeString('en-GB', { hour12: false });

  const html = wrapEmail(`
    <h2 style="color:#0B5D33;margin-top:0;">Your ticket is ready!</h2>
    <p>Hi ${ticket.holderName.split(' ')[0]}, here's your ticket for <strong>${event.name}</strong>.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7EE;border-radius:14px;margin:20px 0;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 8px;"><strong>Event:</strong> ${event.name}</p>
        <p style="margin:0 0 8px;"><strong>Tier:</strong> ${tier ? tier.name : 'General'}</p>
        <p style="margin:0 0 8px;"><strong>Venue:</strong> ${event.venue}</p>
        <p style="margin:0 0 8px;"><strong>Date &amp; Time:</strong> ${dateStr}, ${timeStr}</p>
        <p style="margin:0;"><strong>Price:</strong> &#8358;${Number(ticket.priceNaira).toLocaleString()}</p>
      </td></tr>
    </table>

    ${qrUrl ? `
      <div style="text-align:center;margin:24px 0;">
        <img src="${qrUrl}" width="200" height="200" alt="Your ticket QR code" style="border:4px solid #D4AF37;border-radius:16px;">
        <p style="font-family:monospace;font-size:20px;letter-spacing:4px;font-weight:bold;color:#0B5D33;margin-top:12px;">${ticket.fallbackCode}</p>
        <p style="color:#888;font-size:13px;">Show this QR code (or the code above) at the door.</p>
      </div>
    ` : `
      <p style="color:#888;font-size:13px;">Open the button below to view your QR code and fallback check-in code in the app.</p>
    `}

    <p style="color:#888;font-size:13px;">Please arrive with time to spare for check-in, and wait for your wristband before heading inside.</p>
  `, { preheader: `Your ticket for ${event.name} is ready.` });

  return sendEmail({ to: user.email, toName: user.fullName, subject: `Your ticket for ${event.name}`, html });
}

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendTicketEmail };
