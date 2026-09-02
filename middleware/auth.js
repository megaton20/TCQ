const { User, Wallet } = require('../models');
const { stashReturnTo } = require('../utils/returnTo');

/** Attaches req.currentUser (with wallet) if a session exists. Runs on every request. */
async function loadUser(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findByPk(req.session.userId, {
        include: [{ model: Wallet, as: 'wallet' }]
      });
      req.currentUser = user || null;
    } else {
      req.currentUser = null;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Blocks unauthenticated access. Remembers where they were trying to go
 * (in session, not just the query string) so that after logging in - or
 * signing up, if they're new - they land back on that exact page. This is
 * what makes a shared contestant link work end-to-end: someone clicks it,
 * gets sent to log in, and ends up right back on that contestant's page
 * instead of the generic dashboard.
 */
function requireAuth(req, res, next) {
  if (!req.currentUser) {
    stashReturnTo(req, req.originalUrl);
    req.flash('error', 'Please log in to continue.');
    return res.redirect(`/auth/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}

/** Restricts to one or more roles, e.g. requireRole('admin', 'superadmin') */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.currentUser) {
      stashReturnTo(req, req.originalUrl);
      req.flash('error', 'Please log in to continue.');
      return res.redirect(`/auth/login?next=${encodeURIComponent(req.originalUrl)}`);
    }
    if (!roles.includes(req.currentUser.role)) {
      return res.status(403).render('403', { title: 'Access Denied' });
    }
    next();
  };
}

/**
 * Must run AFTER requireAuth (assumes req.currentUser is set). Blocks
 * anything money- or vote-related until the person has clicked the link in
 * their verification email, redirecting instead to a persisting "please
 * verify" screen. Seeded/demo accounts have emailVerifiedAt pre-set (see
 * seeders/20260101000001-demo-users.js) so this only ever affects real
 * self-service signups going forward, not internal staff/admin accounts.
 */
function requireVerifiedEmail(req, res, next) {
  if (req.currentUser && !req.currentUser.emailVerifiedAt) {
    stashReturnTo(req, req.originalUrl);
    return res.redirect('/auth/verify-email-notice');
  }
  next();
}

function forwardAuthenticated(req, res, next) {
  if (req.currentUser) {

    stashReturnTo(req, req.originalUrl);
    req.flash('warning', 'Already logged in...');
    return res.redirect(`/auth/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}

module.exports = { loadUser, requireAuth, requireRole, requireVerifiedEmail, forwardAuthenticated };
