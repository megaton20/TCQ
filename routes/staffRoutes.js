const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { Event, Ticket, TableMember } = require('../models');
const { Op } = require('sequelize');
const ticketService = require('../services/ticketService');
const { getDoorEntries } = require('../utils/doorEntries');

router.use(requireAuth, requireRole('staff', 'admin', 'superadmin'));

router.get('/checkin', async (req, res, next) => {
  try {
    const events = await Event.findAll({ where: { isActive: true }, order: [['eventDate', 'ASC']] });
    res.render('staff/checkin', { title: 'Ticket Check-in', events });
  } catch (err) { next(err); }
});

// Step 1: scan a QR or type a fallback code, scoped to the event currently
// selected on the check-in screen. Single-seat tickets are admitted
// immediately; table tickets return their roster instead.
router.post('/checkin/scan', async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const result = await ticketService.scanTicket(io, req.body.code, req.currentUser.id, req.body.eventId || null);
    res.json(result);
  } catch (err) { next(err); }
});

// Step 2 (table tickets only): staff has verified the person matches a name
// already on the roster and taps that name to admit them.
router.post('/checkin/table-member', async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const result = await ticketService.checkInTableMember(io, req.body.ticketId, req.body.memberId, req.currentUser.id);
    res.json(result);
  } catch (err) { next(err); }
});

// Table tickets only: register + admit a walk-up guest who wasn't
// pre-registered by the table owner, as long as seats remain.
router.post('/checkin/table-member/add', async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const result = await ticketService.addWalkInTableMember(io, req.body.ticketId, req.body.fullName, req.currentUser.id);
    res.json(result);
  } catch (err) {
    res.json({ ok: false, reason: err.message });
  }
});

// --- Staff's own dashboard: quick summary + their most recent scans ---
router.get('/dashboard', async (req, res, next) => {
  try {
    const staffId = req.currentUser.id;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [ticketsToday, membersToday, ticketsAllTime, membersAllTime] = await Promise.all([
      Ticket.count({ where: { checkedInByStaffId: staffId, checkedInAt: { [Op.gte]: startOfToday } } }),
      TableMember.count({ where: { checkedInByStaffId: staffId, checkedInAt: { [Op.gte]: startOfToday } } }),
      Ticket.count({ where: { checkedInByStaffId: staffId } }),
      TableMember.count({ where: { checkedInByStaffId: staffId } })
    ]);

    const recentScans = (await getDoorEntries({ staffId })).slice(0, 8);

    res.render('staff/dashboard', {
      title: 'My Check-in Dashboard',
      scannedToday: ticketsToday + membersToday,
      scannedAllTime: ticketsAllTime + membersAllTime,
      recentScans
    });
  } catch (err) { next(err); }
});

// --- Staff's full personal scan history ---
router.get('/history', async (req, res, next) => {
  try {
    const entries = await getDoorEntries({ staffId: req.currentUser.id });
    res.render('staff/history', { title: 'My Scan History', entries });
  } catch (err) { next(err); }
});

module.exports = router;
