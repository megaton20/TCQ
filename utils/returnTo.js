const { safePath } = require('./safeRedirect');

/**
 * Remembers where someone was trying to go before they had to log in -
 * stored server-side in the session rather than only in a query param, so
 * it survives things like the login page being reloaded, a hidden form
 * field being dropped, or the person navigating away and back within the
 * same session before finishing login.
 */
function stashReturnTo(req, url) {
  const clean = safePath(url, null);
  if (clean) req.session.returnTo = clean;
}

/**
 * Retrieves and clears the stashed destination. Session value takes
 * priority over `fallback` (e.g. a same-request `next` field) since it's
 * the more durable source of truth; falls back to `fallback` if nothing
 * was stashed, and to "/" if neither is a safe relative path.
 */
function popReturnTo(req, fallback) {
  const stashed = req.session.returnTo;
  if (req.session.returnTo) delete req.session.returnTo;
  return safePath(stashed || fallback, safePath(fallback, '/'));
}

module.exports = { stashReturnTo, popReturnTo };
