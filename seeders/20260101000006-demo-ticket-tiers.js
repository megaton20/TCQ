'use strict';
const { v4: uuidv4 } = require('uuid');

const EVENT_ID = '55555555-5555-5555-5555-555555555555';

// Table pricing is a starting point (group rate, cheaper per-seat than VIP) -
// adjust anytime in Admin -> Events -> Ticket Tiers.
const TIERS = [
  { name: 'Regular', tierType: 'single', seatsIncluded: 1, priceNaira: 2000, sortOrder: 0 },
  { name: 'VIP', tierType: 'single', seatsIncluded: 1, priceNaira: 5000, sortOrder: 1 },
  { name: 'Table for 5', tierType: 'table', seatsIncluded: 5, priceNaira: 18000, sortOrder: 2 },
  { name: 'Table for 10', tierType: 'table', seatsIncluded: 10, priceNaira: 32000, sortOrder: 3 }
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = TIERS.map(t => ({
      id: uuidv4(),
      eventId: EVENT_ID,
      name: t.name,
      tierType: t.tierType,
      seatsIncluded: t.seatsIncluded,
      priceNaira: t.priceNaira,
      sortOrder: t.sortOrder,
      quantitySold: 0,
      isActive: true,
      createdAt: now, updatedAt: now
    }));
    await queryInterface.bulkInsert('ticket_tiers', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('ticket_tiers', { eventId: EVENT_ID });
  }
};
