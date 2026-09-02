const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { customAlphabet } = require('nanoid');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Ticket, TicketTier, TableMember, Event, Transaction, User } = require('../models');
const paystack = require('../utils/paystack');
const { emitAdminFeed, emitRevenueFeed } = require('../utils/adminFeed');
const { cloudinary } = require('../config/cloudinary');
const { sendTicketEmail } = require('../utils/email');

// Excludes visually ambiguous characters (0/O, 1/I/L) for a fallback code
// staff can read off a phone screen or printed ticket without mistakes.
const generateFallbackCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 8);

const QR_DIR = path.join(__dirname, '..', 'public', 'uploads', 'tickets');
if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });

/**
 * Step 1: user chooses a ticket TIER (Regular, VIP, Table for 5, Table for 10)
 * -> pending Ticket + Transaction created, Paystack checkout initialized
 * WITHOUT a split code (full amount to the main account).
 */
async function initiateTicketPurchase(userId, ticketTierId, holderName, callbackUrl) {
  const user = await User.findByPk(userId);
  const tier = await TicketTier.findByPk(ticketTierId, { include: [{ model: Event, as: 'event' }] });
  if (!tier || !tier.isActive) throw new Error('This ticket tier is not available.');
  if (!tier.event || !tier.event.isActive) throw new Error('This event is not open for ticket sales.');
  if (tier.quantityAvailable != null && tier.quantitySold >= tier.quantityAvailable) {
    throw new Error(`${tier.name} tickets are sold out.`);
  }

  const ticketCode = uuidv4();
  const fallbackCode = `CQ-${generateFallbackCode()}`;

  // Split code for tickets is OFF by default (matches the original "no
  // split on ticket revenue" behavior) but can be turned on via .env
  // without touching code - set PAYSTACK_TICKET_SPLIT_ENABLED=true and
  // give PAYSTACK_TICKET_SPLIT_CODE a value when you want ticket sales
  // split too; leave the flag false (or unset) for a normal, unsplit
  // ticket purchase. Independent of PAYSTACK_VOTE_SPLIT_CODE, which is
  // always applied to coin bundle purchases separately.
  const ticketSplitEnabled = process.env.PAYSTACK_TICKET_SPLIT_ENABLED === 'true';
  const ticketSplitCode = ticketSplitEnabled ? process.env.PAYSTACK_TICKET_SPLIT_CODE : undefined;

  const paystackTx = await paystack.initializeTransaction({
    email: user.email,
    amountNaira: Number(tier.priceNaira),
    callbackUrl,
    splitCode: ticketSplitCode,
    metadata: { userId, eventId: tier.eventId, ticketTierId, purpose: 'ticket_purchase' }
  });

  const ticket = await Ticket.create({
    eventId: tier.eventId,
    userId,
    ticketTierId,
    ticketCode,
    fallbackCode,
    holderName,
    priceNaira: tier.priceNaira,
    paystackReference: paystackTx.reference,
    status: 'pending_payment'
  });

  await Transaction.create({
    userId,
    type: 'ticket_purchase',
    ticketId: ticket.id,
    amountNaira: tier.priceNaira,
    paystackReference: paystackTx.reference,
    splitCodeApplied: ticketSplitCode || null,
    status: 'pending'
  });

  return { ticket, paystackTx };
}

/**
 * Step 2: called from the Paystack webhook on confirmed payment.
 * Generates the QR image, flips the ticket to valid, and - for table tiers -
 * automatically registers the buyer as the table owner in the roster.
 * Idempotent.
 *
 * @param {Object} io - Socket.io server instance, used to notify the
 *   superadmin revenue feed (a ticket sale is a money event).
 */
async function confirmTicketPurchase(io, reference) {
  const ticket = await sequelize.transaction(async (t) => {
    // Postgres won't allow FOR UPDATE on a query that outer-joins other
    // tables (Event, TicketTier here) - which is what Sequelize's `include`
    // generates by default, even when the FK is required. So lock only the
    // Ticket row itself, then look up its tier separately (no lock needed -
    // we're only reading tierType, and tiers aren't concurrently modified
    // during a purchase confirmation).
    const t_ = await Ticket.findOne({
      where: { paystackReference: reference },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!t_) throw new Error(`No matching ticket for reference ${reference}`);
    if (t_.status === 'valid' || t_.status === 'used') return t_; // already processed

    const tier = t_.ticketTierId
      ? await TicketTier.findByPk(t_.ticketTierId, { transaction: t })
      : null;

    const qrFilename = `${t_.ticketCode}.png`;
    const qrPath = path.join(QR_DIR, qrFilename);
    await QRCode.toFile(qrPath, t_.ticketCode, { width: 500, margin: 2 });

    t_.qrImageUrl = `/public/uploads/tickets/${qrFilename}`;
    t_.status = 'valid';
    await t_.save({ transaction: t });

    await Transaction.update(
      { status: 'success' },
      { where: { paystackReference: reference }, transaction: t }
    );

    await Event.increment('ticketsSold', { by: 1, where: { id: t_.eventId }, transaction: t });
    if (t_.ticketTierId) {
      await TicketTier.increment('quantitySold', { by: 1, where: { id: t_.ticketTierId }, transaction: t });
    }

    // Table tiers automatically seat the buyer as the table owner - they can
    // add the rest of their guests afterward from "Manage Table".
    if (tier && tier.tierType === 'table') {
      await TableMember.create({
        ticketId: t_.id,
        fullName: t_.holderName,
        isOwner: true
      }, { transaction: t });
    }

    t_._tierName = tier ? tier.name : null; // stash for the feed message below, not persisted
    return t_;
  });

  // Uploaded AFTER the transaction commits (not inside it) since this is a
  // network call and shouldn't hold a DB transaction open. The local file
  // (qrImageUrl, saved above) works immediately, but disappears on the next
  // deploy on ephemeral-filesystem hosts like Render - Cloudinary is the
  // persistent copy the ticket page falls back to (or prefers) once it
  // exists. A failure here is logged but never blocks the ticket purchase
  // itself; the local file still serves the QR in the meantime.
  if (ticket.qrImageUrl && !ticket.qrImageCloudinaryUrl) {
    try {
      const localPath = path.join(QR_DIR, `${ticket.ticketCode}.png`);
      const uploadResult = await cloudinary.uploader.upload(localPath, {
        folder: 'carnival-queen/ticket-qrs',
        public_id: ticket.ticketCode,
        overwrite: true
      });
      ticket.qrImageCloudinaryUrl = uploadResult.secure_url;
      ticket.qrImageCloudinaryPublicId = uploadResult.public_id;
      await ticket.save();
    } catch (err) {
      console.error(`Cloudinary QR upload failed for ticket ${ticket.id} (local file still available):`, err.message);
    }
  }

  if (io) {
    const event = await Event.findByPk(ticket.eventId);
    emitRevenueFeed(io, {
      type: 'ticket_purchase',
      message: `${ticket.holderName} bought a ${ticket._tierName || 'ticket'} for ${event ? event.name : 'an event'}`,
      amountNaira: Number(ticket.priceNaira),
      meta: { ticketId: ticket.id }
    });
  }

  // Email the ticket to the buyer. Never blocks the purchase itself - if
  // Brevo is unreachable, over its free-plan daily cap, or misconfigured,
  // this just fails quietly and ticketEmailSentAt stays null. The ticket
  // view page checks that field and shows a "we couldn't email this right
  // now" note when it's missing, so the person isn't left wondering why no
  // email arrived - but they always still have the ticket in-app either way.
  try {
    const [buyer, event, tier] = await Promise.all([
      User.findByPk(ticket.userId),
      Event.findByPk(ticket.eventId),
      ticket.ticketTierId ? TicketTier.findByPk(ticket.ticketTierId) : null
    ]);
    if (buyer && event) {
      const { sent } = await sendTicketEmail(buyer, ticket, event, tier);
      if (sent) {
        ticket.ticketEmailSentAt = new Date();
        await ticket.save();
      }
    }
  } catch (err) {
    console.error(`Ticket email failed for ticket ${ticket.id} (ticket still valid in-app):`, err.message);
  }

  return ticket;
}

async function markTicketPurchaseFailed(reference) {
  await Ticket.update({ status: 'cancelled' }, { where: { paystackReference: reference } });
  await Transaction.update({ status: 'failed' }, { where: { paystackReference: reference } });
}

/** Full ticket detail including tier + roster, scoped to its owner. */
async function getTicketForOwner(ticketId, userId) {
  return Ticket.findOne({
    where: { id: ticketId, userId },
    include: [
      { model: Event, as: 'event' },
      { model: TicketTier, as: 'tier' },
      { model: TableMember, as: 'members', order: [['createdAt', 'ASC']] }
    ]
  });
}

/**
 * Table owner adds a guest to their roster ahead of the event. Staff verify
 * against this list at the door rather than trusting a spoken name.
 */
async function addTableMember(ticketId, requestingUserId, fullName, phone) {
  const ticket = await Ticket.findOne({ where: { id: ticketId, userId: requestingUserId }, include: [{ model: TicketTier, as: 'tier' }] });
  if (!ticket) throw new Error('Ticket not found.');
  if (!ticket.tier || ticket.tier.tierType !== 'table') throw new Error('This ticket does not have a table roster.');

  const currentCount = await TableMember.count({ where: { ticketId } });
  if (currentCount >= ticket.tier.seatsIncluded) {
    throw new Error(`This table only has ${ticket.tier.seatsIncluded} seats, and they're all named already.`);
  }

  return TableMember.create({ ticketId, fullName, phone: phone || null });
}

async function removeTableMember(ticketId, memberId, requestingUserId) {
  const ticket = await Ticket.findOne({ where: { id: ticketId, userId: requestingUserId } });
  if (!ticket) throw new Error('Ticket not found.');
  const member = await TableMember.findOne({ where: { id: memberId, ticketId } });
  if (!member) throw new Error('Guest not found on this table.');
  if (member.isOwner) throw new Error("You can't remove the table owner from the roster.");
  if (member.checkedInAt) throw new Error('This guest has already checked in and cannot be removed.');
  await member.destroy();
}

/**
 * Step 1 of door check-in: look up a ticket by its QR payload or fallback
 * code. Single-seat tickets (Regular/VIP) are admitted immediately here.
 * Table tickets are NOT marked used here - they return their roster so
 * staff can verify identity and check members in one at a time.
 */
async function scanTicket(io, code, staffId, expectedEventId) {
  const trimmed = code.trim().toUpperCase();
  const isFallback = trimmed.startsWith('CQ-');

  const ticket = await Ticket.findOne({
    where: isFallback ? { fallbackCode: trimmed } : { ticketCode: code.trim() },
    include: [
      { model: Event, as: 'event' },
      { model: TicketTier, as: 'tier' },
      { model: User, as: 'buyer' },
      { model: TableMember, as: 'members' }
    ]
  });

  if (!ticket) return { ok: false, reason: 'Ticket not found. Double-check the code.' };

  // Staff select an event on the check-in screen before scanning - a
  // ticket for a different event is always wrong, regardless of its
  // payment/check-in status, so this check comes before everything else.
  if (expectedEventId && ticket.eventId !== expectedEventId) {
    return {
      ok: false,
      reason: `This ticket is not for this event. It belongs to "${ticket.event ? ticket.event.name : 'a different event'}".`,
      ticket
    };
  }

  const isTable = ticket.tier && ticket.tier.tierType === 'table';

  if (isTable) {
    if (ticket.status !== 'valid' && ticket.status !== 'used') {
      return { ok: false, reason: 'This table ticket is not valid (unpaid or cancelled).', ticket };
    }
    // Always return the roster - checking a table in is a per-guest action,
    // not a one-shot scan.
    return { ok: true, isTable: true, ticket, members: ticket.members };
  }

  // Single-seat ticket (Regular/VIP or legacy ticket with no tier) - admit immediately.
  if (ticket.status === 'used') {
    return { ok: false, reason: `Already checked in at ${ticket.checkedInAt.toLocaleString()}.`, ticket };
  }
  if (ticket.status !== 'valid') {
    return { ok: false, reason: 'This ticket is not valid (unpaid or cancelled).', ticket };
  }

  ticket.status = 'used';
  ticket.checkedInAt = new Date();
  ticket.checkedInByStaffId = staffId;
  ticket.checkInMethod = isFallback ? 'fallback_code' : 'qr';
  await ticket.save();

  const staff = await User.findByPk(staffId);

  io.to(`checkin:${ticket.eventId}`).emit('ticket:checked_in', {
    ticketId: ticket.id,
    eventId: ticket.eventId,
    holderName: ticket.holderName,
    ticketsSoldSoFarCheckedIn: await Ticket.count({ where: { eventId: ticket.eventId, status: 'used' } })
  });

  // Lets the ticket owner's own "My Ticket" page know to refresh and show
  // the new status live, without them needing to reload manually.
  io.to(`ticket:${ticket.id}`).emit('ticket:status_update', { ticketId: ticket.id });

  emitAdminFeed(io, {
    type: 'ticket_checkin',
    message: `${ticket.holderName} checked in for ${ticket.event.name} (by ${staff ? staff.fullName : 'staff'})`,
    meta: { ticketId: ticket.id, staffId, staffName: staff ? staff.fullName : null }
  });

  return { ok: true, isTable: false, ticket };
}

/**
 * Step 2 of door check-in for tables: staff has visually/verbally confirmed
 * the person matches a name already on the roster, and taps that name to
 * admit them.
 */
async function checkInTableMember(io, ticketId, memberId, staffId) {
  const member = await TableMember.findOne({ where: { id: memberId, ticketId }, include: [{ model: Ticket, as: 'ticket' }] });
  if (!member) return { ok: false, reason: 'This guest is not on the table roster.' };
  if (member.checkedInAt) return { ok: false, reason: `${member.fullName} already checked in.` };

  member.checkedInAt = new Date();
  member.checkedInByStaffId = staffId;
  await member.save();

  const ticket = await Ticket.findByPk(ticketId, { include: [{ model: TableMember, as: 'members' }, { model: TicketTier, as: 'tier' }, { model: Event, as: 'event' }] });
  const checkedInCount = ticket.members.filter(m => m.checkedInAt).length;

  // Once every named seat has checked in, flip the ticket itself to "used"
  // for reporting purposes (it can still be viewed, just marked complete).
  if (ticket.tier && checkedInCount >= ticket.tier.seatsIncluded) {
    await Ticket.update({ status: 'used', checkedInAt: new Date(), checkedInByStaffId: staffId }, { where: { id: ticketId } });
  }

  const staff = await User.findByPk(staffId);

  io.to(`checkin:${ticket.eventId}`).emit('ticket:checked_in', {
    ticketId: ticket.id,
    eventId: ticket.eventId,
    holderName: member.fullName,
    ticketsSoldSoFarCheckedIn: await Ticket.count({ where: { eventId: ticket.eventId, status: 'used' } })
  });

  io.to(`ticket:${ticket.id}`).emit('ticket:status_update', { ticketId: ticket.id });

  emitAdminFeed(io, {
    type: 'table_guest_checkin',
    message: `${member.fullName} checked in at ${ticket.event.name}'s table (by ${staff ? staff.fullName : 'staff'})`,
    meta: { ticketId: ticket.id, memberId: member.id, staffId, staffName: staff ? staff.fullName : null }
  });

  return { ok: true, member, checkedInCount, seatsTotal: ticket.tier ? ticket.tier.seatsIncluded : null };
}

/**
 * Staff can register a walk-up guest against a table on the spot (e.g. the
 * owner forgot to add someone ahead of time), as long as seats remain.
 * Flagged addedAtDoor so it's clear in reporting this wasn't pre-registered.
 */
async function addWalkInTableMember(io, ticketId, fullName, staffId) {
  const ticket = await Ticket.findByPk(ticketId, { include: [{ model: TicketTier, as: 'tier' }, { model: TableMember, as: 'members' }, { model: Event, as: 'event' }] });
  if (!ticket || !ticket.tier || ticket.tier.tierType !== 'table') throw new Error('Not a table ticket.');
  if (ticket.members.length >= ticket.tier.seatsIncluded) {
    throw new Error('This table has no seats left to add a guest to.');
  }

  const member = await TableMember.create({
    ticketId, fullName, addedAtDoor: true, checkedInAt: new Date(), checkedInByStaffId: staffId
  });

  const checkedInCount = ticket.members.filter(m => m.checkedInAt).length + 1;
  if (checkedInCount >= ticket.tier.seatsIncluded) {
    await Ticket.update({ status: 'used', checkedInAt: new Date(), checkedInByStaffId: staffId }, { where: { id: ticketId } });
  }

  const staff = await User.findByPk(staffId);

  io.to(`checkin:${ticket.eventId}`).emit('ticket:checked_in', {
    ticketId: ticket.id,
    eventId: ticket.eventId,
    holderName: member.fullName,
    ticketsSoldSoFarCheckedIn: await Ticket.count({ where: { eventId: ticket.eventId, status: 'used' } })
  });

  io.to(`ticket:${ticket.id}`).emit('ticket:status_update', { ticketId: ticket.id });

  emitAdminFeed(io, {
    type: 'walkin_guest_checkin',
    message: `${member.fullName} added as a walk-up guest at ${ticket.event.name}'s table (by ${staff ? staff.fullName : 'staff'})`,
    meta: { ticketId: ticket.id, memberId: member.id, staffId, staffName: staff ? staff.fullName : null }
  });

  return { ok: true, member, checkedInCount, seatsTotal: ticket.tier.seatsIncluded };
}

module.exports = {
  initiateTicketPurchase,
  confirmTicketPurchase,
  markTicketPurchaseFailed,
  getTicketForOwner,
  addTableMember,
  removeTableMember,
  scanTicket,
  checkInTableMember,
  addWalkInTableMember
};
