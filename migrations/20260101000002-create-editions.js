'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('editions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      year: { type: Sequelize.INTEGER, allowNull: false, unique: true },
      title: { type: Sequelize.STRING, allowNull: false },
      theme: { type: Sequelize.STRING },
      isCurrent: { type: Sequelize.BOOLEAN, defaultValue: false },
      votingOpensAt: { type: Sequelize.DATE },
      votingClosesAt: { type: Sequelize.DATE },
      eventDate: { type: Sequelize.DATE },
      description: { type: Sequelize.TEXT },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('editions');
  }
};
