const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** Returns a Date `hours` from now, for token expiry columns. */
function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

module.exports = { generateToken, hoursFromNow };
