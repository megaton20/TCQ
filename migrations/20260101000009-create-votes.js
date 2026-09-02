'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('votes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'users', key: 'id' }, onDelete: 'CASCADE'
      },
      contestantId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'contestants', key: 'id' }, onDelete: 'CASCADE'
      },
      editionId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'editions', key: 'id' }, onDelete: 'CASCADE'
      },
      voteCount: { type: Sequelize.INTEGER, allowNull: false },
      coinsSpent: { type: Sequelize.BIGINT, allowNull: false },
      method: { type: Sequelize.ENUM('quick', 'manual'), defaultValue: 'manual' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('votes', ['contestantId']);
    await queryInterface.addIndex('votes', ['userId']);
    await queryInterface.addIndex('votes', ['editionId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('votes');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_votes_method";');
  }
};
