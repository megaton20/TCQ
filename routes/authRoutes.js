const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Wallet } = require('../models');
const { safePath } = require('../utils/safeRedirect');
const { stashReturnTo, popReturnTo } = require('../utils/returnTo');
const { generateToken, hoursFromNow } = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { getBaseUrl } = require('../utils/getBaseUrl');
const { requireAuth } = require('../middleware/auth');

function roleDefaultPath(user) {
  if (['admin', 'superadmin'].includes(user.role)) return '/admin';
  if (user.role === 'staff') return '/staff/checkin';
  return '/dashboard';
}

// --- Registration ---
router.get('/register', (req, res) => {
  if (req.query.next) stashReturnTo(req, req.query.next);
  res.render('auth/register', { title: 'Create Account', next: req.query.next || req.session.returnTo || '' });
});

router.post('/register', async (req, res, next) => {
  try {
    const { fullName, email, phone, password, confirmPassword, next: nextUrl } = req.body;
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect(`/auth/register?next=${encodeURIComponent(nextUrl || '')}`);
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      req.flash('error', 'An account with this email already exists.');
      return res.redirect(`/auth/register?next=${encodeURIComponent(nextUrl || '')}`);
    }

    const hashed = await bcrypt.hash(password, 12);
    const verificationToken = generateToken();
    const user = await User.create({
      fullName, email, phone, password: hashed,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiresAt: hoursFromNow(24)
    });
    await Wallet.create({ userId: user.id, coinBalance: 0 });

    req.session.userId = user.id;
    // Keep whatever destination was already stashed (or stash the form's
    // next field) so it survives through the verification screen and
    // resumes automatically once they actually verify - see /verify-email.
    if (!req.session.returnTo && nextUrl) stashReturnTo(req, nextUrl);

    const verifyUrl = `${getBaseUrl(req)}/auth/verify-email?token=${verificationToken}`;
    const { sent } = await sendVerificationEmail(user, verifyUrl);

    if (sent) {
      req.flash('success', `Welcome, ${user.fullName}! Check your email to verify your account.`);
    } else {
      req.flash('error', 'Account created, but we couldn\'t send the verification email right now - email service is currently unavailable. You can retry from the next screen.');
    }
    res.redirect('/auth/verify-email-notice');
  } catch (err) { next(err); }
});

// --- Login ---
router.get('/login', (req, res) => {
  if (req.query.next) stashReturnTo(req, req.query.next);
  res.render('auth/login', { title: 'Log In', next: req.query.next || req.session.returnTo || '' });
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, next: nextUrl } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect(`/auth/login?next=${encodeURIComponent(nextUrl || '')}`);
    }
    if (!user.isActive) {
      req.flash('error', 'This account has been deactivated.');
      return res.redirect('/auth/login');
    }
    req.session.userId = user.id;

    if (!req.session.returnTo && nextUrl) stashReturnTo(req, nextUrl);

    if (!user.emailVerifiedAt) {
      return res.redirect('/auth/verify-email-notice');
    }

    // Session-stashed destination (set by requireAuth or the login/register
    // GET routes) takes priority over the form's next field, which is what
    // makes "share a contestant link -> forced to log in -> land right back
    // on that contestant page" work reliably.
    res.redirect(popReturnTo(req, safePath(nextUrl, roleDefaultPath(user))));
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// --- Email verification (the "persisting screen") ---
router.get('/verify-email-notice', requireAuth, (req, res) => {
  if (req.currentUser.emailVerifiedAt) {
    return res.redirect(popReturnTo(req, roleDefaultPath(req.currentUser)));
  }
  res.render('auth/verify-email-notice', { title: 'Verify Your Email' });
});

router.post('/resend-verification', requireAuth, async (req, res) => {
  if (req.currentUser.emailVerifiedAt) {
    return res.redirect('/auth/verify-email-notice');
  }
  const user = req.currentUser;
  user.emailVerificationToken = generateToken();
  user.emailVerificationTokenExpiresAt = hoursFromNow(24);
  await user.save();

  const verifyUrl = `${getBaseUrl(req)}/auth/verify-email?token=${user.emailVerificationToken}`;
  const { sent } = await sendVerificationEmail(user, verifyUrl);

  if (sent) {
    req.flash('success', 'Verification email sent - check your inbox.');
  } else {
    req.flash('error', 'Email service is currently unavailable. Please try again in a few minutes.');
  }
  res.redirect('/auth/verify-email-notice');
});

// Public - reached by clicking the link in the email, which may open in a
// browser session that isn't logged in at all.
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  const user = token
    ? await User.findOne({
        where: { emailVerificationToken: token, emailVerificationTokenExpiresAt: { [Op.gt]: new Date() } }
      })
    : null;

  if (!user) {
    req.flash('error', 'That verification link is invalid or has expired. Request a new one below.');
    return res.redirect(req.currentUser ? '/auth/verify-email-notice' : '/auth/login');
  }

  user.emailVerifiedAt = new Date();
  user.emailVerificationToken = null;
  user.emailVerificationTokenExpiresAt = null;
  await user.save();

  req.flash('success', 'Email verified! You\'re all set.');

  if (req.currentUser && req.currentUser.id === user.id) {
    return res.redirect(popReturnTo(req, roleDefaultPath(user)));
  }
  res.redirect('/auth/login');
});

// --- Password recovery ---
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password' });
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const user = await User.findOne({ where: { email: req.body.email } });
    if (user && user.isActive) {
      user.passwordResetToken = generateToken();
      user.passwordResetTokenExpiresAt = hoursFromNow(1);
      await user.save();
      const resetUrl = `${getBaseUrl(req)}/auth/reset-password?token=${user.passwordResetToken}`;
      await sendPasswordResetEmail(user, resetUrl); // outcome deliberately not exposed - see note below
    }
    // Identical message regardless of whether the account exists or the
    // email actually sent - this is what prevents email enumeration. If
    // Brevo is down, this still gets shown; it's phrased so that's not a
    // problem either way.
    req.flash('success', 'If an account exists for that email, password reset instructions have been sent to it.');
    res.redirect('/auth/login');
  } catch (err) { next(err); }
});

router.get('/reset-password', async (req, res) => {
  const { token } = req.query;
  const user = token
    ? await User.findOne({
        where: { passwordResetToken: token, passwordResetTokenExpiresAt: { [Op.gt]: new Date() } }
      })
    : null;

  if (!user) {
    req.flash('error', 'That reset link is invalid or has expired. Request a new one below.');
    return res.redirect('/auth/forgot-password');
  }
  res.render('auth/reset-password', { title: 'Reset Password', token });
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password, confirmPassword } = req.body;
    const user = token
      ? await User.findOne({
          where: { passwordResetToken: token, passwordResetTokenExpiresAt: { [Op.gt]: new Date() } }
        })
      : null;

    if (!user) {
      req.flash('error', 'That reset link is invalid or has expired. Request a new one below.');
      return res.redirect('/auth/forgot-password');
    }
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect(`/auth/reset-password?token=${token}`);
    }

    user.password = await bcrypt.hash(password, 12);
    user.passwordResetToken = null;
    user.passwordResetTokenExpiresAt = null;
    await user.save();

    req.flash('success', 'Password updated! You can log in now.');
    res.redirect('/auth/login');
  } catch (err) { next(err); }
});

module.exports = router;
