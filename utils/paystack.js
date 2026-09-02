const axios = require('axios');

const PLACEHOLDER_KEY = 'sk_test_xxxxxxxxxxxx';

/** 'test' | 'live' | null (unrecognized format) based on the key prefix Paystack uses. */
function getKeyMode(key) {
  if (!key) return null;
  if (key.startsWith('sk_test_')) return 'test';
  if (key.startsWith('sk_live_')) return 'live';
  return null;
}

let hasWarnedAboutTestSplit = false;

function getClient() {
  const key = process.env.PAYSTACK_SECRET_KEY;

  if (!key) {
    throw new Error(
      'PAYSTACK_SECRET_KEY is not set. Copy .env.example to .env and add your real Paystack secret key.'
    );
  }
  if (key === PLACEHOLDER_KEY) {
    throw new Error(
      'PAYSTACK_SECRET_KEY is still the placeholder value from .env.example. Replace it with your real Paystack test/live secret key.'
    );
  }

  // Built fresh on every call (not cached at module load) so it always
  // reflects the current .env - a stale/undefined key baked in at require()
  // time was a previous bug behind mysterious 404s here.
  return axios.create({
    baseURL: 'https://api.paystack.co',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });
}

/** Wraps an axios call so Paystack's actual error message surfaces instead of a bare status code. */
async function callPaystack(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.response) {
      // Paystack error responses are typically { status: false, message: "..." }
      const paystackMessage = err.response.data?.message;
      const detail = paystackMessage ? `: ${paystackMessage}` : '';
      throw new Error(`Paystack request failed (HTTP ${err.response.status})${detail}`);
    }
    throw err;
  }
}

/**
 * Initialize a Paystack transaction.
 * @param {Object} opts
 * @param {string} opts.email
 * @param {number} opts.amountNaira
 * @param {string} opts.callbackUrl
 * @param {string} [opts.splitCode] - ONLY pass this for coin bundle purchases.
 *   Ticket purchases must call this without splitCode so the full amount
 *   goes to the main settlement account. Split payments don't work in
 *   Paystack's test mode at all, so this is automatically dropped when the
 *   active secret key is a test key (sk_test_...) - see getKeyMode() below.
 *   The purchase still goes through in test mode, just without the split.
 * @param {Object} [opts.metadata]
 */
async function initializeTransaction({ email, amountNaira, callbackUrl, splitCode, metadata }) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  const mode = getKeyMode(key);

  const payload = {
    email,
    amount: Math.round(amountNaira * 100), // kobo
    callback_url: callbackUrl,
    metadata: metadata || {}
  };

  if (splitCode) {
    if (mode === 'test') {
      // Paystack split payments are a live-mode-only feature. Sending
      // split_code on a test key either gets ignored or errors depending
      // on the endpoint, so we drop it here and let the purchase proceed
      // as a normal (unsplit) transaction instead of failing outright.
      if (!hasWarnedAboutTestSplit) {
        console.warn(
          '[paystack] Test-mode secret key detected - split payments are not supported in test mode. ' +
          'Proceeding without split_code; the developer share will not be routed until you switch to a live key.'
        );
        hasWarnedAboutTestSplit = true;
      }
    } else {
      payload.split_code = splitCode;
    }
  }

  const client = getClient();
  const { data } = await callPaystack(() => client.post('/transaction/initialize', payload));
  return data.data; // { authorization_url, access_code, reference }
}

async function verifyTransaction(reference) {
  const client = getClient();
  const { data } = await callPaystack(() => client.get(`/transaction/verify/${reference}`));
  return data.data; // { status, amount, reference, metadata, ... }
}

/** Exposed so callers (e.g. an admin settings page) can show which mode is active. */
function getActiveKeyMode() {
  return getKeyMode(process.env.PAYSTACK_SECRET_KEY);
}

module.exports = { initializeTransaction, verifyTransaction, getActiveKeyMode };
