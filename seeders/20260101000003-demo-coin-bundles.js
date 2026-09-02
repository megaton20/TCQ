'use strict';
const { v4: uuidv4 } = require('uuid');

const NAIRA_PER_COIN = 200; // 1 coin = 1 vote = ₦200
const BUNDLES = [
  { name: 'Starter Pack', votes: 5 },
  { name: 'Bronze Pack', votes: 15 },
  { name: 'Silver Pack', votes: 35 },
  { name: 'Gold Pack', votes: 75 },
  { name: 'Platinum Pack', votes: 150 },
  { name: 'Diamond Pack', votes: 300 }
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = BUNDLES.map((b, i) => ({
      id: uuidv4(),
      name: b.name,
      votesEquivalent: b.votes,
      coinAmount: b.votes, // 1 coin per vote, no bonus
      priceNaira: b.votes * NAIRA_PER_COIN,
      sortOrder: i,
      isActive: true,
      createdAt: now, updatedAt: now
    }));
    await queryInterface.bulkInsert('coin_bundles', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('coin_bundles', { name: BUNDLES.map(b => b.name) });
  }
};
