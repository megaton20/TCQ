'use strict';
const { v4: uuidv4 } = require('uuid');

const EDITION_2026_ID = '22222222-2222-2222-2222-222222222222';
const EVENT_ID = '55555555-5555-5555-5555-555555555555';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('events', [{
      id: EVENT_ID,
      editionId: EDITION_2026_ID,
      name: 'The Carnival Queen 2026 - Coronation Night',
      description: 'The grand finale where this year\'s Carnival Queen is crowned live on stage.',
      venue: 'Cultural Centre, Calabar',
      eventDate: new Date('2026-12-12T18:00:00Z'),
      ticketPriceNaira: 0, // legacy field, unused now - see ticket_tiers seeder for actual pricing
      capacity: 500,
      ticketsSold: 0,
      isActive: true,
      createdAt: now, updatedAt: now
    }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('events', { id: EVENT_ID });
  }
};
