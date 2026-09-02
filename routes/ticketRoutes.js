const express = require('express');
const router = express.Router();
const { requireAuth, requireVerifiedEmail } = require('../middleware/auth');
const { Event, TicketTier, Ticket } = require('../models');
const ticketService = require('../services/ticketService');
const { getBaseUrl } = require('../utils/getBaseUrl');

router.get('/', async (req, res, next) => {
  try {
    const events = await Event.findAll({
      where: { isActive: true },
      include: [{ model: TicketTier, as: 'tiers', where: { isActive: true }, required: false, order: [['sortOrder', 'ASC']] }],
      order: [['eventDate', 'ASC']]
    });
    res.render('tickets/events', { title: 'Tickets', events });
  } catch (err) { next(err); }
});

router.get('/tier/:tierId/buy', requireAuth, requireVerifiedEmail, async (req, res, next) => {
  try {
    const tier = await TicketTier.findByPk(req.params.tierId, { include: [{ model: Event, as: 'event' }] });
    if (!tier) return res.status(404).render('404', { title: 'Ticket Tier Not Found' });
    res.render('tickets/buy', { title: `Buy Ticket - ${tier.event.name}`, tier, event: tier.event });
  } catch (err) { next(err); }
});

router.post('/tier/:tierId/buy', requireAuth, requireVerifiedEmail, async (req, res, next) => {
  try {
    const holderName = req.body.holderName || req.currentUser.fullName;
    const callbackUrl = `${getBaseUrl(req)}/tickets/callback`;
    const { paystackTx } = await ticketService.initiateTicketPurchase(
      req.currentUser.id, req.params.tierId, holderName, callbackUrl
    );
    res.redirect(paystackTx.authorization_url);
  } catch (err) { next(err); }
});

router.get('/callback', requireAuth, (req, res) => {
  req.flash('success', 'Payment received! Your ticket & QR code will be ready shortly.');
  res.redirect('/dashboard/tickets');
});

router.get('/my/:ticketId', requireAuth, requireVerifiedEmail, async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketForOwner(req.params.ticketId, req.currentUser.id);
    if (!ticket) return res.status(404).render('404', { title: 'Ticket Not Found' });
    res.render('tickets/view', { title: 'My Ticket', ticket });
  } catch (err) { next(err); }
});

// --- Table roster management (owner only) ---
router.get('/my/:ticketId/manage', requireAuth, requireVerifiedEmail, async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketForOwner(req.params.ticketId, req.currentUser.id);
    if (!ticket) return res.status(404).render('404', { title: 'Ticket Not Found' });
    if (!ticket.tier || ticket.tier.tierType !== 'table') {
      req.flash('error', 'Only table tickets have a guest roster to manage.');
      return res.redirect(`/tickets/my/${ticket.id}`);
    }
    res.render('tickets/manage', { title: 'Manage Table', ticket });
  } catch (err) { next(err); }
});

router.post('/my/:ticketId/members', requireAuth, requireVerifiedEmail, async (req, res, next) => {
  try {
    await ticketService.addTableMember(req.params.ticketId, req.currentUser.id, req.body.fullName, req.body.phone);
    req.flash('success', 'Guest added to your table.');
    res.redirect(`/tickets/my/${req.params.ticketId}/manage`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(`/tickets/my/${req.params.ticketId}/manage`);
  }
});

router.post('/my/:ticketId/members/:memberId/delete', requireAuth, requireVerifiedEmail, async (req, res, next) => {
  try {
    await ticketService.removeTableMember(req.params.ticketId, req.params.memberId, req.currentUser.id);
    req.flash('success', 'Guest removed.');
    res.redirect(`/tickets/my/${req.params.ticketId}/manage`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(`/tickets/my/${req.params.ticketId}/manage`);
  }
});

module.exports = router;
