'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('table_members', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      ticketId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'tickets', key: 'id' }, onDelete: 'CASCADE'
      },
      fullName: { type: Sequelize.STRING, allowNull: false },
      phone: { type: Sequelize.STRING, allowNull: true },
      isOwner: { type: Sequelize.BOOLEAN, defaultValue: false }, // the person who bought the table
      addedAtDoor: { type: Sequelize.BOOLEAN, defaultValue: false }, // staff added this name on the spot, not pre-registered by the owner
      checkedInAt: { type: Sequelize.DATE, allowNull: true },
      checkedInByStaffId: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'users', key: 'id' }, onDelete: 'SET NULL'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('table_members', ['ticketId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('table_members');
  }
};
