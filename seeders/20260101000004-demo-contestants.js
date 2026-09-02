'use strict';
const { v4: uuidv4 } = require('uuid');
const slugify = require('slugify');

const EDITION_2025_ID = '11111111-1111-1111-1111-111111111111';
const EDITION_2026_ID = '22222222-2222-2222-2222-222222222222';
const PLACEHOLDER = '/public/img/placeholder.jpg';

// Fixed IDs so other seeders (e.g. votes, if you add a demo-votes seeder later) can reference them.
// const CONTESTANTS_2025 = [
//   { id: '33333333-0000-0000-0000-000000000001', name: 'Amara Bassey', state: 'Cross River', number: 1, isWinner: true, position: 'Queen',
//     blogContent: 'Since being crowned, Amara has dedicated her reign to community health outreach across Cross River State, partnering with local clinics to provide free health screenings and school supplies to underserved communities. Her "Health for Her" initiative has reached over 500 women and children so far, and she continues to visit local schools to speak about education and self-confidence.' },
//   { id: '33333333-0000-0000-0000-000000000002', name: 'Ifeoma Chukwu', state: 'Anambra', number: 2, position: '1st Runner-up' },
//   { id: '33333333-0000-0000-0000-000000000003', name: 'Zainab Bello', state: 'Kano', number: 3, position: '2nd Runner-up' }
// ];

// const CONTESTANTS_2026 = [
//   { id: '44444444-0000-0000-0000-000000000001', name: 'Grace Effiong', state: 'Cross River', number: 1 },
//   { id: '44444444-0000-0000-0000-000000000002', name: 'Blessing Okon', state: 'Akwa Ibom', number: 2 },
//   { id: '44444444-0000-0000-0000-000000000003', name: 'Chiamaka Obi', state: 'Enugu', number: 3 },
//   { id: '44444444-0000-0000-0000-000000000004', name: 'Halima Yusuf', state: 'Kaduna', number: 4 }
// ];

function buildContestantRows(list, editionId, now) {
  return list.map((c) => ({
    id: c.id,
    editionId,
    fullName: c.name,
    slug: slugify(`${c.name}-${c.number}-${editionId.slice(0, 8)}`, { lower: true }),
    contestantNumber: c.number,
    stateOfOrigin: c.state,
    age: 22,
    bio: `${c.name} is a proud representative of ${c.state}, bringing grace, intelligence, and community spirit to the stage.`,
    tagline: 'Beauty with a purpose',
    status: 'approved',
    isWinner: !!c.isWinner,
    winnerPosition: c.position || null,
    blogContent: c.blogContent || null,
    voteCount: 0,
    coinsEarned: 0,
    createdAt: now, updatedAt: now
  }));
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('contestants', [
      ...buildContestantRows(CONTESTANTS_2025, EDITION_2025_ID, now),
      ...buildContestantRows(CONTESTANTS_2026, EDITION_2026_ID, now)
    ]);

    const allContestants = [...CONTESTANTS_2025, ...CONTESTANTS_2026];
    const imageRows = [];
    allContestants.forEach((c) => {
      imageRows.push({
        id: uuidv4(), contestantId: c.id, url: PLACEHOLDER, category: 'profile',
        isThumbnail: true, sortOrder: 0, createdAt: now, updatedAt: now
      });
      imageRows.push({
        id: uuidv4(), contestantId: c.id, url: PLACEHOLDER, caption: 'Full-length portrait', category: 'profile',
        isThumbnail: false, sortOrder: 1, createdAt: now, updatedAt: now
      });
      if (c.isWinner) {
        imageRows.push({
          id: uuidv4(), contestantId: c.id, url: PLACEHOLDER, caption: 'Community health outreach', category: 'outreach',
          isThumbnail: false, sortOrder: 2, createdAt: now, updatedAt: now
        });
        imageRows.push({
          id: uuidv4(), contestantId: c.id, url: PLACEHOLDER, caption: 'School visit', category: 'outreach',
          isThumbnail: false, sortOrder: 3, createdAt: now, updatedAt: now
        });
      }
    });
    await queryInterface.bulkInsert('contestant_images', imageRows);
  },

  async down(queryInterface) {
    const ids = [...CONTESTANTS_2025, ...CONTESTANTS_2026].map(c => c.id);
    await queryInterface.bulkDelete('contestant_images', { contestantId: ids });
    await queryInterface.bulkDelete('contestants', { id: ids });
  }
};
