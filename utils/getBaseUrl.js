/**
 * Resolves the public base URL to use for things like Paystack's
 * callback_url - e.g. "http://localhost:3000", "https://abcd1234.ngrok-free.app",
 * or "https://yourdomain.com".
 *
 * Behavior:
 * - If APP_URL in .env is unset or set to "auto" (the default), this reads
 *   the incoming request's protocol + host instead. That means it just
 *   works whether you're hitting the app on localhost, through an ngrok
 *   tunnel (ngrok forwards the original tunnel host in the Host header, and
 *   the real protocol in X-Forwarded-Proto), or on your live domain behind
 *   a reverse proxy - no manual switching required.
 * - If APP_URL is set to an explicit value (e.g. "https://carnivalqueen.com"),
 *   that always wins - useful in production if you want to force the
 *   canonical domain regardless of what headers a request arrived with.
 */
function getBaseUrl(req) {
  const configured = process.env.APP_URL;
  if (configured && configured.trim().toLowerCase() !== 'auto') {
    return configured.replace(/\/+$/, ''); // strip trailing slash
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

module.exports = { getBaseUrl };
