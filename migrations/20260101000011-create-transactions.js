'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('transactions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'users', key: 'id' }, onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.ENUM('bundle_purchase', 'vote_spend', 'ticket_purchase'),
        allowNull: false
      },
      coinBundleId: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'coin_bundles', key: 'id' }, onDelete: 'SET NULL'
      },
      ticketId: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'tickets', key: 'id' }, onDelete: 'SET NULL'
      },
      voteId: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'votes', key: 'id' }, onDelete: 'SET NULL'
      },
      amountNaira: { type: Sequelize.BIGINT },
      coinAmount: { type: Sequelize.BIGINT },
      paystackReference: { type: Sequelize.STRING, unique: true },
      splitCodeApplied: { type: Sequelize.STRING },
      status: {
        type: Sequelize.ENUM('pending', 'success', 'failed'),
        defaultValue: 'pending'
      },
      metadata: { type: Sequelize.JSONB },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('transactions', ['userId']);
    await queryInterface.addIndex('transactions', ['type']);
    await queryInterface.addIndex('transactions', ['status']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('transactions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_transactions_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_transactions_status";');
  }
};
