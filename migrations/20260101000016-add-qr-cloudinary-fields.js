'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tickets', 'qrImageCloudinaryUrl', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('tickets', 'qrImageCloudinaryPublicId', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('tickets', 'qrImageCloudinaryUrl');
    await queryInterface.removeColumn('tickets', 'qrImageCloudinaryPublicId');
  }
};
