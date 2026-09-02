const express = require('express');
const router = express.Router();
const { requireAuth, requireVerifiedEmail } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { Vote, Contestant, Transaction, CoinBundle, Ticket, TicketTier, Event, User } = require('../models');

router.use(requireAuth, requireVerifiedEmail);

router.get('/', async (req, res, next) => {
  try {
    const recentVotes = await Vote.findAll({
      where: { userId: req.currentUser.id },
      include: [{ model: Contestant, as: 'contestant', attributes: ['fullName', 'slug'] }],
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    const recentTickets = await Ticket.findAll({
      where: { userId: req.currentUser.id },
      include: [{ model: Event, as: 'event' }],
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    res.render('dashboard/overview', { title: 'My Dashboard', recentVotes, recentTickets });
  } catch (err) { next(err); }
});

router.get('/wallet', async (req, res, next) => {
  try {
    const transactions = await Transaction.findAll({
      where: { userId: req.currentUser.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.render('dashboard/wallet', { title: 'Wallet & Transactions', transactions, wallet: req.currentUser.wallet });
  } catch (err) { next(err); }
});

router.get('/wallet/:transactionId', async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      where: { id: req.params.transactionId, userId: req.currentUser.id },
      include: [
        { model: CoinBundle, as: 'bundle' },
        { model: Ticket, as: 'ticket', include: [{ model: Event, as: 'event' }, { model: TicketTier, as: 'tier' }] },
        { model: Vote, as: 'vote', include: [{ model: Contestant, as: 'contestant' }] }
      ]
    });
    if (!transaction) return res.status(404).render('404', { title: 'Transaction Not Found' });
    res.render('dashboard/transaction-detail', { title: 'Transaction Details', transaction });
  } catch (err) { next(err); }
});

router.get('/votes', async (req, res, next) => {
  try {
    const votes = await Vote.findAll({
      where: { userId: req.currentUser.id },
      include: [{ model: Contestant, as: 'contestant', attributes: ['fullName', 'slug'] }],
      order: [['createdAt', 'DESC']]
    });
    res.render('dashboard/votes', { title: 'Voting History', votes });
  } catch (err) { next(err); }
});

router.get('/tickets', async (req, res, next) => {
  try {
    const tickets = await Ticket.findAll({
      where: { userId: req.currentUser.id },
      include: [{ model: Event, as: 'event' }, { model: TicketTier, as: 'tier' }],
      order: [['createdAt', 'DESC']]
    });
    res.render('dashboard/tickets', { title: 'My Tickets', tickets });
  } catch (err) { next(err); }
});

router.get('/settings', (req, res) => res.render('dashboard/settings', { title: 'Settings' }));

router.post('/settings', async (req, res, next) => {
  try {
    const { fullName, phone, currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.currentUser.id);
    user.fullName = fullName;
    user.phone = phone;

    if (newPassword) {
      const matches = await bcrypt.compare(currentPassword || '', user.password);
      if (!matches) {
        req.flash('error', 'Current password is incorrect.');
        return res.redirect('/dashboard/settings');
      }
      user.password = await bcrypt.hash(newPassword, 12);
    }
    await user.save();
    req.flash('success', 'Settings updated.');
    res.redirect('/dashboard/settings');
  } catch (err) { next(err); }
});

module.exports = router;
