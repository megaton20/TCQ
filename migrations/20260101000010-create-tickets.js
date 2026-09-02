'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tickets', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      eventId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'events', key: 'id' }, onDelete: 'CASCADE'
      },
      userId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'users', key: 'id' }, onDelete: 'CASCADE'
      },
      ticketCode: { type: Sequelize.STRING, allowNull: false, unique: true },
      fallbackCode: { type: Sequelize.STRING, allowNull: false, unique: true },
      qrImageUrl: { type: Sequelize.STRING },
      holderName: { type: Sequelize.STRING, allowNull: false },
      priceNaira: { type: Sequelize.BIGINT, allowNull: false },
      paystackReference: { type: Sequelize.STRING, unique: true },
      status: {
        type: Sequelize.ENUM('pending_payment', 'valid', 'used', 'cancelled'),
        defaultValue: 'pending_payment'
      },
      checkedInAt: { type: Sequelize.DATE },
      checkedInByStaffId: {
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' }, onDelete: 'SET NULL'
      },
      checkInMethod: { type: Sequelize.ENUM('qr', 'fallback_code') },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('tickets', ['eventId']);
    await queryInterface.addIndex('tickets', ['userId']);
    await queryInterface.addIndex('tickets', ['status']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('tickets');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tickets_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tickets_checkInMethod";');
  }
};
