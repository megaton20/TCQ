'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('editions', 'themeDescription', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('editions', 'themeImageUrl', { type: Sequelize.STRING, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('editions', 'themeDescription');
    await queryInterface.removeColumn('editions', 'themeImageUrl');
  }
};
