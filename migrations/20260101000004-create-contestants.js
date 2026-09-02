'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contestants', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      editionId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'editions', key: 'id' }, onDelete: 'CASCADE'
      },
      userId: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'users', key: 'id' }, onDelete: 'SET NULL'
      },
      fullName: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      contestantNumber: { type: Sequelize.INTEGER },
      stateOfOrigin: { type: Sequelize.STRING },
      age: { type: Sequelize.INTEGER },
      occupation: { type: Sequelize.STRING },
      bio: { type: Sequelize.TEXT },
      tagline: { type: Sequelize.STRING },
      instagramHandle: { type: Sequelize.STRING },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'disqualified'),
        defaultValue: 'pending'
      },
      isWinner: { type: Sequelize.BOOLEAN, defaultValue: false },
      winnerPosition: { type: Sequelize.STRING },
      voteCount: { type: Sequelize.BIGINT, defaultValue: 0 },
      coinsEarned: { type: Sequelize.BIGINT, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('contestants', ['editionId']);
    await queryInterface.addIndex('contestants', ['status']);
    await queryInterface.addIndex('contestants', ['voteCount']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('contestants');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_contestants_status";');
  }
};
