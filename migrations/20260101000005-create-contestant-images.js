'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contestant_images', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      contestantId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'contestants', key: 'id' }, onDelete: 'CASCADE'
      },
      url: { type: Sequelize.STRING, allowNull: false },
      cloudinaryPublicId: { type: Sequelize.STRING },
      caption: { type: Sequelize.STRING },
      isThumbnail: { type: Sequelize.BOOLEAN, defaultValue: false },
      sortOrder: { type: Sequelize.INTEGER, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('contestant_images', ['contestantId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('contestant_images');
  }
};
