/**
 * Only allow redirecting to a relative, same-site path. Rejects anything
 * that could send the user off-site (absolute URLs, protocol-relative
 * "//evil.com", etc.) - important since `next`/`return` values here come
 * from query params and are technically user-controlled.
 */
function safePath(candidate, fallback = '/') {
  if (typeof candidate !== 'string' || !candidate) return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  return candidate;
}

module.exports = { safePath };
