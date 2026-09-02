const express = require('express');
const router = express.Router();
const { requireAuth, requireVerifiedEmail } = require('../middleware/auth');
const { CoinBundle } = require('../models');
const walletService = require('../services/walletService');
const { safePath } = require('../utils/safeRedirect');
const { getBaseUrl } = require('../utils/getBaseUrl');

router.get('/buy', requireAuth, requireVerifiedEmail, async (req, res, next) => {
  try {
    const bundles = await CoinBundle.findAll({ where: { isActive: true }, order: [['sortOrder', 'ASC']] });
    const nextUrl = safePath(req.query.next, '');
    res.render('dashboard/buy-coins', { title: 'Buy Coins', bundles, wallet: req.currentUser.wallet, nextUrl });
  } catch (err) { next(err); }
});

router.post('/buy/:bundleId', requireAuth, requireVerifiedEmail, async (req, res, next) => {
  try {
    const nextUrl = safePath(req.body.next, '');
    // Carry the return destination through Paystack's own redirect - it
    // preserves query params on callback_url and just appends its own
    // (reference/trxref) with &, so this survives the round trip.
    const callbackUrl = `${getBaseUrl(req)}/wallet/callback${nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ''}`;
    const paystackTx = await walletService.initiateBundlePurchase(req.currentUser.id, req.params.bundleId, callbackUrl);
    res.redirect(paystackTx.authorization_url);
  } catch (err) { next(err); }
});

// Paystack redirects the browser here after checkout; the webhook is what
// actually credits coins (source of truth), this is just a friendly landing
// page - but if the person got here mid-vote (insufficient coins), send them
// straight back to the contestant page instead of the generic wallet page.
router.get('/callback', requireAuth, async (req, res) => {
  const nextUrl = safePath(req.query.next, '');
  if (nextUrl) {
    req.flash('success', 'Coins topped up! Go ahead and finish voting.');
    return res.redirect(nextUrl);
  }
  req.flash('success', 'Payment received! Your coins will reflect shortly.');
  res.redirect('/dashboard/wallet');
});

module.exports = router;
