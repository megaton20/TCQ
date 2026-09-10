const express = require('express');
const router = express.Router();
const slugify = require('slugify');
const { Op } = require('sequelize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadContestantImages, uploadGalleryImages } = require('../config/cloudinary');
const { getActiveKeyMode } = require('../utils/paystack');
const { getDoorEntries } = require('../utils/doorEntries');
const { emitAdminFeed } = require('../utils/adminFeed');
const ticketService = require('../services/ticketService');
const {
  Edition, Contestant, ContestantImage, ContestantApplication,
  CoinBundle, Event, Transaction, User, Ticket, TicketTier, TableMember, Vote
} = require('../models');

router.use(requireAuth, requireRole('admin', 'superadmin'));

router.get('/', async (req, res, next) => {
  try {
    const isSuperAdmin = req.currentUser.role === 'superadmin';

    const [pendingApplications, contestantCount, ticketsSold, doorEntriesCount] = await Promise.all([
      ContestantApplication.count({ where: { status: 'pending' } }),
      Contestant.count({ where: { status: 'approved' } }),
      Ticket.count({ where: { status: 'valid' } }),
      Promise.all([
        Ticket.count({ where: { checkedInAt: { [Op.ne]: null } } }),
        TableMember.count({ where: { checkedInAt: { [Op.ne]: null } } })
      ]).then(([a, b]) => a + b)
    ]);

    // Revenue is superadmin-only - not computed at all for a plain admin,
    // not just hidden in the view.
    const netProfit = isSuperAdmin
      ? (await Transaction.sum('amountNaira', { where: { status: 'success' } })) || 0
      : null;
      const deduction = netProfit * 0.15
      const totalRevenue = netProfit - deduction // taking the % away
       
    const totalUsers = isSuperAdmin
      ? (await User.count({ where: {'role':'voter', isActive: true } }))
      : 0;
    const totalEvents = isSuperAdmin
      ? (await Event.count())
      : 0;

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      pendingApplications, contestantCount, ticketsSold, doorEntriesCount, totalRevenue,totalUsers,
      isSuperAdmin,totalEvents,
      paystackMode: isSuperAdmin ? getActiveKeyMode() : null
    });
  } catch (err) { next(err); }
});

// --- Applications ---
router.get('/applications', async (req, res, next) => {
  try {
    const applications = await ContestantApplication.findAll({
      where: { status: 'pending' },
      include: [{ model: User, as: 'applicant' }, { model: Edition, as: 'edition' }],
      order: [['createdAt', 'ASC']]
    });
    res.render('admin/applications', { title: 'Pending Applications', applications });
  } catch (err) { next(err); }
});

router.post('/applications/:id/approve', async (req, res, next) => {
  try {
    const app = await ContestantApplication.findByPk(req.params.id);
    if (!app) return res.redirect('/admin/applications');

    app.status = 'approved';
    app.reviewedByAdminId = req.currentUser.id;
    await app.save();

    const contestant = await Contestant.create({
      editionId: app.editionId,
      userId: app.userId,
      fullName: app.fullName,
      slug: slugify(`${app.fullName}-${Date.now()}`, { lower: true }),
      stateOfOrigin: app.stateOfOrigin,
      instagramHandle: app.instagramHandle,
      status: 'approved'
    });

    if (app.passportPhotoUrl) {
      await ContestantImage.create({ contestantId: contestant.id, url: app.passportPhotoUrl, isThumbnail: true, sortOrder: 0 });
    }
    if (app.fullLengthPhotoUrl) {
      await ContestantImage.create({ contestantId: contestant.id, url: app.fullLengthPhotoUrl, sortOrder: 1 });
    }

    req.flash('success', `${app.fullName} approved as a contestant.`);
    res.redirect('/admin/applications');
  } catch (err) { next(err); }
});

router.post('/applications/:id/reject', async (req, res, next) => {
  try {
    await ContestantApplication.update(
      { status: 'rejected', reviewedByAdminId: req.currentUser.id, rejectionReason: req.body.reason || null },
      { where: { id: req.params.id } }
    );
    req.flash('success', 'Application rejected.');
    res.redirect('/admin/applications');
  } catch (err) { next(err); }
});

// --- Contestants (edit, add extra images, set winner) ---
router.get('/contestants', async (req, res, next) => {
  try {
    const contestants = await Contestant.findAll({
      include: [{ model: ContestantImage, as: 'images' }, { model: Edition, as: 'edition' }],
      order: [['createdAt', 'DESC']]
    });
    const editions = await Edition.findAll({ order: [['year', 'DESC']] });
    res.render('admin/contestants', {
      title: 'Manage Contestants', contestants, editions,
      isSuperAdmin: req.currentUser.role === 'superadmin'
    });
  } catch (err) { next(err); }
});

// Full contestant CRUD (create/edit/delete) is superadmin-only - regular
// admin still approves applications, uploads photos, sets placement, and
// changes status via the routes below, unchanged.
router.get('/contestants/new', requireRole('superadmin'), async (req, res, next) => {
  try {
    const editions = await Edition.findAll({ order: [['year', 'DESC']] });
    res.render('admin/contestant-form', { title: 'Add Contestant', contestant: null, editions });
  } catch (err) { next(err); }
});

router.post('/contestants', requireRole('superadmin'), async (req, res, next) => {
  try {
    const b = req.body;
    await Contestant.create({
      editionId: b.editionId,
      fullName: b.fullName,
      slug: slugify(`${b.fullName}-${Date.now()}`, { lower: true }),
      contestantNumber: b.contestantNumber || null,
      stateOfOrigin: b.stateOfOrigin || null,
      age: b.age || null,
      occupation: b.occupation || null,
      bio: b.bio || null,
      tagline: b.tagline || null,
      instagramHandle: b.instagramHandle || null,
      status: b.status || 'approved'
    });
    req.flash('success', 'Contestant created.');
    res.redirect('/admin/contestants');
  } catch (err) { next(err); }
});

router.get('/contestants/:id/edit', requireRole('superadmin'), async (req, res, next) => {
  try {
    const contestant = await Contestant.findByPk(req.params.id);
    if (!contestant) return res.status(404).render('404', { title: 'Contestant Not Found' });
    const editions = await Edition.findAll({ order: [['year', 'DESC']] });
    res.render('admin/contestant-form', { title: 'Edit Contestant', contestant, editions });
  } catch (err) { next(err); }
});

router.post('/contestants/:id', requireRole('superadmin'), async (req, res, next) => {
  try {
    const b = req.body;
    await Contestant.update({
      editionId: b.editionId,
      fullName: b.fullName,
      contestantNumber: b.contestantNumber || null,
      stateOfOrigin: b.stateOfOrigin || null,
      age: b.age || null,
      occupation: b.occupation || null,
      bio: b.bio || null,
      tagline: b.tagline || null,
      instagramHandle: b.instagramHandle || null
    }, { where: { id: req.params.id } });
    req.flash('success', 'Contestant updated.');
    res.redirect('/admin/contestants');
  } catch (err) { next(err); }
});

router.post('/contestants/:id/delete', requireRole('superadmin'), async (req, res, next) => {
  try {
    await Contestant.destroy({ where: { id: req.params.id } }); // cascades to images/votes via FK
    req.flash('success', 'Contestant deleted.');
    res.redirect('/admin/contestants');
  } catch (err) { next(err); }
});

router.post('/contestants/:id/images', uploadContestantImages.array('images', 10), async (req, res, next) => {
  try {
    const files = req.files || [];
    const category = req.body.category === 'outreach' ? 'outreach' : 'profile';
    let sortOrder = await ContestantImage.count({ where: { contestantId: req.params.id } });
    for (const file of files) {
      await ContestantImage.create({
        contestantId: req.params.id,
        url: file.path,
        cloudinaryPublicId: file.filename,
        category,
        sortOrder: sortOrder++
      });
    }
    req.flash('success', `${files.length} ${category} photo(s) uploaded.`);
    res.redirect('/admin/contestants');
  } catch (err) { next(err); }
});

router.post('/contestants/:id/blog', async (req, res, next) => {
  try {
    await Contestant.update(
      { blogContent: req.body.blogContent },
      { where: { id: req.params.id } }
    );
    req.flash('success', 'Charity outreach blog content saved.');
    res.redirect('/admin/contestants');
  } catch (err) { next(err); }
});

router.post('/contestants/:id/images/:imageId/set-thumbnail', async (req, res, next) => {
  try {
    const { id, imageId } = req.params;
    await ContestantImage.update({ isThumbnail: false }, { where: { contestantId: id } });
    await ContestantImage.update({ isThumbnail: true }, { where: { id: imageId } });
    res.redirect('/admin/contestants');
  } catch (err) { next(err); }
});

router.post('/contestants/:id/images/:imageId/delete', async (req, res, next) => {
  try {
    await ContestantImage.destroy({ where: { id: req.params.imageId } });
    res.redirect('/admin/contestants');
  } catch (err) { next(err); }
});

router.post('/contestants/:id/set-winner', async (req, res, next) => {
  try {
    const contestant = await Contestant.findByPk(req.params.id);
    const placement = req.body.placement; // 'Queen' | '1st Runner-up' | '2nd Runner-up' | ''
    contestant.isWinner = placement === 'Queen';
    contestant.winnerPosition = placement || null;
    await contestant.save();
    req.flash('success', placement ? `${contestant.fullName} set as ${placement}.` : `Placement cleared for ${contestant.fullName}.`);
    res.redirect('/admin/contestants');
  } catch (err) { next(err); }
});

router.post('/contestants/:id/status', async (req, res, next) => {
  try {
    await Contestant.update({ status: req.body.status }, { where: { id: req.params.id } });
    res.redirect('/admin/contestants');
  } catch (err) { next(err); }
});

// --- Editions ---
router.get('/editions', async (req, res, next) => {
  try {
    const editions = await Edition.findAll({ order: [['year', 'DESC']] });
    res.render('admin/editions', { title: 'Editions / Seasons', editions });
  } catch (err) { next(err); }
});

router.post('/editions', async (req, res, next) => {
  try {
    const b = req.body;
    await Edition.create({
      year: b.year, title: b.title, theme: b.theme,
      votingOpensAt: b.votingOpensAt || null,
      votingClosesAt: b.votingClosesAt || null,
      eventDate: b.eventDate || null,
      description: b.description
    });
    req.flash('success', 'Edition created.');
    res.redirect('/admin/editions');
  } catch (err) { next(err); }
});

router.post('/editions/:id/set-current', async (req, res, next) => {
  try {
    await Edition.update({ isCurrent: false }, { where: {} });
    await Edition.update({ isCurrent: true }, { where: { id: req.params.id } });
    req.flash('success', 'Current edition updated.');
    res.redirect('/admin/editions');
  } catch (err) { next(err); }
});

router.post('/editions/:id/theme', uploadGalleryImages.single('themeImage'), async (req, res, next) => {
  try {
    const edition = await Edition.findByPk(req.params.id);
    if (!edition) return res.redirect('/admin/editions');

    edition.theme = req.body.theme || edition.theme;
    edition.themeDescription = req.body.themeDescription;
    if (req.file) edition.themeImageUrl = req.file.path;
    await edition.save();

    req.flash('success', 'Theme updated for this edition.');
    res.redirect('/admin/editions');
  } catch (err) { next(err); }
});

// --- Coin bundles ---
router.get('/bundles', async (req, res, next) => {
  try {
    const bundles = await CoinBundle.findAll({ order: [['sortOrder', 'ASC']] });
    res.render('admin/bundles', { title: 'Coin Bundles', bundles });
  } catch (err) { next(err); }
});

router.post('/bundles', async (req, res, next) => {
  try {
    const b = req.body;
    const votesEquivalent = parseInt(b.votesEquivalent, 10);
    const nairaPerCoin = Number(process.env.VOTE_COST_NAIRA || 200);
    await CoinBundle.create({
      name: b.name,
      votesEquivalent,
      coinAmount: votesEquivalent, // 1 coin = 1 vote, no bonus
      priceNaira: votesEquivalent * nairaPerCoin,
      sortOrder: parseInt(b.sortOrder, 10) || 0
    });
    req.flash('success', 'Bundle created.');
    res.redirect('/admin/bundles');
  } catch (err) { next(err); }
});

router.post('/bundles/:id/toggle', async (req, res, next) => {
  try {
    const bundle = await CoinBundle.findByPk(req.params.id);
    bundle.isActive = !bundle.isActive;
    await bundle.save();
    res.redirect('/admin/bundles');
  } catch (err) { next(err); }
});

// --- Events / tickets ---
router.get('/events', async (req, res, next) => {
  try {
    const events = await Event.findAll({
      include: [{ model: TicketTier, as: 'tiers', order: [['sortOrder', 'ASC']] }],
      order: [['eventDate', 'DESC']]
    });
    res.render('admin/events', {
      title: 'Events & Tickets', events,
      isSuperAdmin: req.currentUser.role === 'superadmin'
    });
  } catch (err) { next(err); }
});

router.post('/events', async (req, res, next) => {
  try {
    const b = req.body;
    await Event.create({
      editionId: b.editionId || null,
      name: b.name,
      description: b.description,
      venue: b.venue,
      eventDate: b.eventDate,
      ticketPriceNaira: 0, // legacy field - real pricing now lives per-tier below
      capacity: b.capacity || null
    });
    req.flash('success', 'Event created. Now add ticket tiers (Regular, VIP, Table for 5/10) below.');
    res.redirect('/admin/events');
  } catch (err) { next(err); }
});

// Editing/deleting an event outright (not just creating one) is
// superadmin-only - deleting cascades to its ticket tiers and every ticket
// sold against it.
router.post('/events/:id', requireRole('superadmin'), async (req, res, next) => {
  try {
    const b = req.body;
    await Event.update({
      name: b.name,
      description: b.description,
      venue: b.venue,
      eventDate: b.eventDate,
      capacity: b.capacity || null,
      isActive: b.isActive === 'on'
    }, { where: { id: req.params.id } });
    req.flash('success', 'Event updated.');
    res.redirect('/admin/events');
  } catch (err) { next(err); }
});

router.post('/events/:id/delete', requireRole('superadmin'), async (req, res, next) => {
  try {
    await Event.destroy({ where: { id: req.params.id } }); // cascades to tiers + tickets via FK
    req.flash('success', 'Event deleted.');
    res.redirect('/admin/events');
  } catch (err) { next(err); }
});

router.post('/events/:id/tiers', async (req, res, next) => {
  try {
    const b = req.body;
    const tierType = b.tierType === 'table' ? 'table' : 'single';
    await TicketTier.create({
      eventId: req.params.id,
      name: b.name,
      tierType,
      seatsIncluded: tierType === 'table' ? (parseInt(b.seatsIncluded, 10) || 5) : 1,
      priceNaira: b.priceNaira,
      quantityAvailable: b.quantityAvailable || null,
      sortOrder: parseInt(b.sortOrder, 10) || 0
    });
    req.flash('success', 'Ticket tier created.');
    res.redirect('/admin/events');
  } catch (err) { next(err); }
});

router.post('/tiers/:id/toggle', async (req, res, next) => {
  try {
    const tier = await TicketTier.findByPk(req.params.id);
    tier.isActive = !tier.isActive;
    await tier.save();
    res.redirect('/admin/events');
  } catch (err) { next(err); }
});

// Editing a tier's actual details (price, seats, name) and deleting it
// outright are superadmin-only - toggling active/inactive above stays
// available to regular admin.
router.post('/tiers/:id', requireRole('superadmin'), async (req, res, next) => {
  try {
    const b = req.body;
    const tierType = b.tierType === 'table' ? 'table' : 'single';
    await TicketTier.update({
      name: b.name,
      tierType,
      seatsIncluded: tierType === 'table' ? (parseInt(b.seatsIncluded, 10) || 5) : 1,
      priceNaira: b.priceNaira,
      quantityAvailable: b.quantityAvailable || null
    }, { where: { id: req.params.id } });
    req.flash('success', 'Ticket tier updated.');
    res.redirect('/admin/events');
  } catch (err) { next(err); }
});

router.post('/tiers/:id/delete', requireRole('superadmin'), async (req, res, next) => {
  try {
    await TicketTier.destroy({ where: { id: req.params.id } }); // tickets already sold keep their data, just lose the tier link (FK is SET NULL)
    req.flash('success', 'Ticket tier deleted.');
    res.redirect('/admin/events');
  } catch (err) { next(err); }
});

// --- Table management (see who owns each table, manage rosters, oversee check-in) ---
router.get('/tables', async (req, res, next) => {
  try {
    const tables = await Ticket.findAll({
      include: [
        { model: TicketTier, as: 'tier', where: { tierType: 'table' } },
        { model: Event, as: 'event' },
        { model: User, as: 'buyer', attributes: ['fullName', 'email', 'phone'] },
        { model: TableMember, as: 'members' }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.render('admin/tables', { title: 'Table Management', tables });
  } catch (err) { next(err); }
});

router.post('/tables/:ticketId/members', async (req, res, next) => {
  try {
    const ticket = await Ticket.findByPk(req.params.ticketId, { include: [{ model: TicketTier, as: 'tier' }] });
    const currentCount = await TableMember.count({ where: { ticketId: ticket.id } });
    if (currentCount >= ticket.tier.seatsIncluded) {
      req.flash('error', `This table only has ${ticket.tier.seatsIncluded} seats.`);
      return res.redirect('/admin/tables');
    }
    await TableMember.create({ ticketId: ticket.id, fullName: req.body.fullName, phone: req.body.phone || null });
    req.flash('success', 'Guest added to table roster.');
    res.redirect('/admin/tables');
  } catch (err) { next(err); }
});

router.post('/tables/members/:memberId/delete', async (req, res, next) => {
  try {
    const member = await TableMember.findByPk(req.params.memberId);
    if (member && !member.isOwner && !member.checkedInAt) await member.destroy();
    res.redirect('/admin/tables');
  } catch (err) { next(err); }
});

// --- Staff management ---
router.get('/staff', async (req, res, next) => {
  try {
    const staff = await User.findAll({ where: { role: 'staff' }, order: [['createdAt', 'DESC']] });
    res.render('admin/staff', { title: 'Check-in Staff', staff });
  } catch (err) { next(err); }
});

router.post('/staff/:id/toggle', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    user.isActive = !user.isActive;
    await user.save();
    res.redirect('/admin/staff');
  } catch (err) { next(err); }
});

// --- Door Entry Records (scan log) - both admin and superadmin ---
router.get('/door-entries', async (req, res, next) => {
  try {
    const entries = await getDoorEntries();
    res.render('admin/door-entries', { title: 'Door Entry Records', entries });
  } catch (err) { next(err); }
});

// --- Tickets (superadmin-only throughout - shows prices/payment references) ---
router.get('/tickets', requireRole('superadmin'), async (req, res, next) => {
  try {
    const tickets = await Ticket.findAll({
      include: [
        { model: Event, as: 'event' },
        { model: TicketTier, as: 'tier' },
        { model: User, as: 'buyer', attributes: ['fullName', 'email'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 300
    });
    res.render('admin/tickets', { title: 'Manage Tickets', tickets });
  } catch (err) { next(err); }
});

router.get('/tickets/new', requireRole('superadmin'), async (req, res, next) => {
  try {
    const events = await Event.findAll({
      where: { isActive: true },
      include: [{ model: TicketTier, as: 'tiers', where: { isActive: true }, required: false }],
      order: [['eventDate', 'ASC']]
    });
    res.render('admin/ticket-form', { title: 'Issue Ticket', ticket: null, events });
  } catch (err) { next(err); }
});

router.post('/tickets', requireRole('superadmin'), async (req, res, next) => {
  try {
    const b = req.body;
    const ticket = await ticketService.issueManualTicket({
      eventId: b.eventId,
      ticketTierId: b.ticketTierId,
      holderName: b.holderName,
      email: b.email,
      issuedByUserId: req.currentUser.id
    });
    emitAdminFeed(req.app.get('io'), {
      type: 'ticket_checkin',
      message: `${req.currentUser.fullName} manually issued a ticket to ${ticket.holderName}`,
      meta: { ticketId: ticket.id }
    });
    req.flash('success', `Ticket issued to ${ticket.holderName}.`);
    res.redirect('/admin/tickets');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/tickets/new');
  }
});

router.get('/tickets/:id/edit', requireRole('superadmin'), async (req, res, next) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id, { include: [{ model: Event, as: 'event' }, { model: TicketTier, as: 'tier' }] });
    if (!ticket) return res.status(404).render('404', { title: 'Ticket Not Found' });
    res.render('admin/ticket-form', { title: 'Edit Ticket', ticket, events: [] });
  } catch (err) { next(err); }
});

router.post('/tickets/:id', requireRole('superadmin'), async (req, res, next) => {
  try {
    const b = req.body;
    await Ticket.update({
      holderName: b.holderName,
      status: b.status
    }, { where: { id: req.params.id } });
    req.flash('success', 'Ticket updated.');
    res.redirect('/admin/tickets');
  } catch (err) { next(err); }
});

router.post('/tickets/:id/delete', requireRole('superadmin'), async (req, res, next) => {
  try {
    await Ticket.destroy({ where: { id: req.params.id } }); // cascades to table members via FK
    req.flash('success', 'Ticket deleted.');
    res.redirect('/admin/tickets');
  } catch (err) { next(err); }
});

// --- Transactions (revenue data - superadmin only) ---
router.get('/transactions', requireRole('superadmin'), async (req, res, next) => {
  try {
    const transactions = await Transaction.findAll({
      include: [{ model: User, as: 'user', attributes: ['fullName', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: 200
    });
    res.render('admin/transactions', { title: 'Transactions', transactions });
  } catch (err) { next(err); }
});

router.get('/transactions/:id', requireRole('superadmin'), async (req, res, next) => {
  try {
    const transaction = await Transaction.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user' },
        { model: CoinBundle, as: 'bundle' },
        { model: Ticket, as: 'ticket', include: [{ model: Event, as: 'event' }, { model: TicketTier, as: 'tier' }] },
        { model: Vote, as: 'vote', include: [{ model: Contestant, as: 'contestant' }] }
      ]
    });
    if (!transaction) return res.status(404).render('404', { title: 'Transaction Not Found' });
    res.render('admin/transaction-detail', { title: 'Transaction Details', transaction });
  } catch (err) { next(err); }
});

module.exports = router;
