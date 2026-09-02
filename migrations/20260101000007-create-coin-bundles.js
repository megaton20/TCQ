'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('coin_bundles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      votesEquivalent: { type: Sequelize.INTEGER, allowNull: false },
      coinAmount: { type: Sequelize.BIGINT, allowNull: false },
      priceNaira: { type: Sequelize.BIGINT, allowNull: false },
      sortOrder: { type: Sequelize.INTEGER, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('coin_bundles');
  }
};
