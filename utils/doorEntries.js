const { Op } = require('sequelize');
const { Ticket, TableMember, Event, TicketTier, User } = require('../models');

/**
 * Builds a unified, chronological list of check-ins - single-seat tickets
 * and individual table-guest check-ins together - normalized into one
 * shape. Pass `staffId` to scope it to just what one staff member has
 * personally scanned (used by their own history page); omit it for the
 * full admin log.
 */
async function getDoorEntries({ staffId } = {}) {
  const staffFilter = staffId ? { checkedInByStaffId: staffId } : {};

  const [ticketCheckins, memberCheckins] = await Promise.all([
    Ticket.findAll({
      where: { checkedInAt: { [Op.ne]: null }, ...staffFilter },
      include: [
        { model: Event, as: 'event' },
        { model: TicketTier, as: 'tier' },
        { model: User, as: 'checkedInBy' }
      ],
      order: [['checkedInAt', 'DESC']]
    }),
    TableMember.findAll({
      where: { checkedInAt: { [Op.ne]: null }, ...staffFilter },
      include: [
        { model: Ticket, as: 'ticket', include: [{ model: Event, as: 'event' }, { model: TicketTier, as: 'tier' }] },
        { model: User, as: 'checkedInBy' }
      ],
      order: [['checkedInAt', 'DESC']]
    })
  ]);

  // Single-seat tickets (Regular/VIP) become one entry each. Table tickets
  // are represented by their individual guest check-ins instead, so
  // they're excluded here to avoid double-counting the same table twice.
  const entries = [
    ...ticketCheckins
      .filter(t => !t.tier || t.tier.tierType !== 'table')
      .map(t => ({
        guestName: t.holderName,
        eventName: t.event ? t.event.name : 'Unknown event',
        tierName: t.tier ? t.tier.name : 'General',
        method: t.checkInMethod || 'qr',
        staffName: t.checkedInBy ? t.checkedInBy.fullName : 'Unknown',
        checkedInAt: t.checkedInAt
      })),
    ...memberCheckins.map(m => ({
      guestName: m.fullName,
      eventName: m.ticket && m.ticket.event ? m.ticket.event.name : 'Unknown event',
      tierName: m.ticket && m.ticket.tier ? m.ticket.tier.name : 'Table',
      method: m.addedAtDoor ? 'walk-in' : 'table-roster',
      staffName: m.checkedInBy ? m.checkedInBy.fullName : 'Unknown',
      checkedInAt: m.checkedInAt
    }))
  ].sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt));

  return entries;
}

module.exports = { getDoorEntries };
