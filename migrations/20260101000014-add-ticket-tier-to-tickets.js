'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tickets', 'ticketTierId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'ticket_tiers', key: 'id' },
      onDelete: 'SET NULL'
    });
    await queryInterface.addIndex('tickets', ['ticketTierId']);
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('tickets', 'ticketTierId');
  }
};
