'use strict';
// Fixed IDs (not random) so later seed files can reference them directly.
const EDITION_2025_ID = '11111111-1111-1111-1111-111111111111';
const EDITION_2026_ID = '22222222-2222-2222-2222-222222222222';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('editions', [
      {
        id: EDITION_2025_ID,
        year: 2025,
        title: 'The Carnival Queen 2025',
        theme: 'ELIXIR:SHEvolution',
        isCurrent: false,
        eventDate: new Date('2025-12-13T18:00:00Z'),
        description: 'The inaugural edition of The Carnival Queen.',
        createdAt: now, updatedAt: now
      },
      {
        id: EDITION_2026_ID,
        year: 2026,
        title: 'The Carnival Queen 2026',
        theme: 'ELIXIR:Quingdom',
        themeDescription: 'This year\'s edition celebrates the vibrant coastal culture of Cross River State - from its music and festivals to the resilience and warmth of its people. Contestants will showcase looks and performances inspired by the rivers, the carnival spirit, and the rhythm that defines life along the coast.',
        isCurrent: true,
        votingOpensAt: new Date('2026-08-01T00:00:00Z'),
        votingClosesAt: new Date('2026-12-10T23:59:59Z'),
        eventDate: new Date('2026-12-12T18:00:00Z'),
        description: 'This year\'s edition, currently open for voting.',
        createdAt: now, updatedAt: now
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('editions', { id: [EDITION_2025_ID, EDITION_2026_ID] });
  }
};

module.exports.EDITION_2025_ID = EDITION_2025_ID;
module.exports.EDITION_2026_ID = EDITION_2026_ID;
