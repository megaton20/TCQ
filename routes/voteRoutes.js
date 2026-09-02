const express = require('express');
const router = express.Router();
const { requireAuth, requireVerifiedEmail } = require('../middleware/auth');
const { castVote, InsufficientCoinsError, COINS_PER_VOTE } = require('../services/voteService');
const { safePath } = require('../utils/safeRedirect');

// Quick vote buttons on the contestant page post here, e.g. { contestantId, voteCount: 10, method: 'quick' }
// Manual stepper posts the same shape with method: 'manual'. Both also send
// returnTo (the contestant page URL) so an insufficient-coins interruption
// can send the voter back to the right page after topping up.
router.post('/:contestantId', requireAuth, requireVerifiedEmail, async (req, res, next) => {
  try {
    const { contestantId } = req.params;
    const voteCount = parseInt(req.body.voteCount, 10);
    const method = req.body.method === 'quick' ? 'quick' : 'manual';
    const returnTo = safePath(req.body.returnTo, req.get('Referer') || '/contestants');

    if (!voteCount || voteCount < 1) {
      req.flash('error', 'Enter how many votes you want to cast.');
      return res.redirect('back');
    }

    const io = req.app.get('io');
    const result = await castVote(io, req.currentUser.id, contestantId, voteCount, method);

    req.flash('success', `${voteCount} vote(s) cast! You spent ${result.vote.coinsSpent.toLocaleString()} coins.`);
    res.redirect('back');
  } catch (err) {
    if (err instanceof InsufficientCoinsError) {
      req.flash('error', `${err.message} Buy more coins below, then come right back to finish voting.`);
      return res.redirect(`/wallet/buy?next=${encodeURIComponent(req.body.returnTo || req.get('Referer') || '/contestants')}`);
    }
    if (err.message && (err.message.includes('not open for voting') || err.message.includes('Voting has closed'))) {
      req.flash('error', err.message);
      return res.redirect('back');
    }
    next(err);
  }
});

// Small JSON endpoint so the front-end can show live "coins needed" as the stepper changes
router.get('/cost/:voteCount', (req, res) => {
  const voteCount = parseInt(req.params.voteCount, 10) || 0;
  res.json({ coinsRequired: voteCount * COINS_PER_VOTE });
});

module.exports = router;
