'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('events', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      editionId: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'editions', key: 'id' }, onDelete: 'SET NULL'
      },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      venue: { type: Sequelize.STRING, allowNull: false },
      eventDate: { type: Sequelize.DATE, allowNull: false },
      ticketPriceNaira: { type: Sequelize.BIGINT, allowNull: false },
      capacity: { type: Sequelize.INTEGER },
      ticketsSold: { type: Sequelize.INTEGER, defaultValue: 0 },
      posterUrl: { type: Sequelize.STRING },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('events');
  }
};
