'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ticket_tiers', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      eventId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'events', key: 'id' }, onDelete: 'CASCADE'
      },
      name: { type: Sequelize.STRING, allowNull: false }, // "Regular", "VIP", "Table for 5", "Table for 10"
      tierType: {
        // single: one person, one seat (Regular, VIP)
        // table: one purchase covers a group of seats, needs a member roster
        type: Sequelize.ENUM('single', 'table'),
        defaultValue: 'single'
      },
      seatsIncluded: { type: Sequelize.INTEGER, defaultValue: 1 }, // 1 for Regular/VIP, 5 or 10 for tables
      priceNaira: { type: Sequelize.BIGINT, allowNull: false },
      sortOrder: { type: Sequelize.INTEGER, defaultValue: 0 },
      quantityAvailable: { type: Sequelize.INTEGER, allowNull: true }, // optional cap per tier, null = unlimited
      quantitySold: { type: Sequelize.INTEGER, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('ticket_tiers', ['eventId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ticket_tiers');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ticket_tiers_tierType";');
  }
};
