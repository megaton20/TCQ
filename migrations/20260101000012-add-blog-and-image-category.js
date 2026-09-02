'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('contestants', 'blogContent', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('contestant_images', 'category', {
      type: Sequelize.ENUM('profile', 'outreach'),
      defaultValue: 'profile',
      allowNull: false
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('contestants', 'blogContent');
    await queryInterface.removeColumn('contestant_images', 'category');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_contestant_images_category";');
  }
};
