'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'emailVerificationToken', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'emailVerificationTokenExpiresAt', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('users', 'passwordResetToken', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'passwordResetTokenExpiresAt', { type: Sequelize.DATE, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'emailVerificationToken');
    await queryInterface.removeColumn('users', 'emailVerificationTokenExpiresAt');
    await queryInterface.removeColumn('users', 'passwordResetToken');
    await queryInterface.removeColumn('users', 'passwordResetTokenExpiresAt');
  }
};
