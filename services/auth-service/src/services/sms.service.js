/**
 * SMS delivery via SEWMR SMS (https://api.sewmrsms.co.tz).
 *
 * Credentials come from the environment, never from source:
 *   SMS_API_TOKEN   - bearer token for the SEWMR account
 *   SMS_SENDER_ID   - an approved sender name on that account
 *   SMS_BASE_URL    - defaults to the SEWMR production host
 *
 * When the token or sender is unset the service is a no-op that reports
 * `sent: false`, so local/dev runs work without SMS and the caller falls back
 * to logging the code. It never throws: a delivery failure must not take down
 * the login flow.
 */

const BASE_URL = process.env.SMS_BASE_URL || 'https://api.sewmrsms.co.tz';
const TOKEN = process.env.SMS_API_TOKEN || '';
const SENDER_ID = process.env.SMS_SENDER_ID || '';

const isConfigured = () => Boolean(TOKEN && SENDER_ID);

// SEWMR expects a Tanzanian MSISDN (255…). Accept the common local forms and
// normalise: 0765… , +255765… , 765… all become 255765….
function normalizeTz(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('255')) return digits;
  if (digits.startsWith('0')) return '255' + digits.slice(1);
  if (digits.length === 9) return '255' + digits;
  return digits;
}

// Show only the last 3 digits in logs.
function maskPhone(phone) {
  const p = normalizeTz(phone);
  return p ? p.replace(/.(?=.{3})/g, '*') : '(none)';
}

/**
 * Send one SMS. Returns { sent, to, error? } and never throws.
 */
async function sendSms(phone, message) {
  if (!isConfigured()) return { sent: false, reason: 'sms-not-configured' };
  const to = normalizeTz(phone);
  if (!to) return { sent: false, reason: 'no-phone' };

  try {
    const res = await fetch(`${BASE_URL}/api/v1/sms/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sender_id: SENDER_ID, phone_number: to, message }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.success !== false) return { sent: true, to };
    return { sent: false, to, error: body.message || `HTTP ${res.status}` };
  } catch (err) {
    return { sent: false, to, error: err.message };
  }
}

/**
 * Send a verification code. Returns the same shape as sendSms.
 */
async function sendOtp(phone, code) {
  return sendSms(
    phone,
    `Your UniChat verification code is ${code}. It expires in 5 minutes.`,
  );
}

module.exports = { sendSms, sendOtp, isConfigured, normalizeTz, maskPhone };
