'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contestant_applications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'users', key: 'id' }, onDelete: 'CASCADE'
      },
      editionId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'editions', key: 'id' }, onDelete: 'CASCADE'
      },
      fullName: { type: Sequelize.STRING, allowNull: false },
      dateOfBirth: { type: Sequelize.DATEONLY, allowNull: false },
      gender: { type: Sequelize.STRING, allowNull: false },
      stateOfOrigin: { type: Sequelize.STRING, allowNull: false },
      address: { type: Sequelize.STRING, allowNull: false },
      phone: { type: Sequelize.STRING, allowNull: false },
      occupation: { type: Sequelize.STRING },
      height: { type: Sequelize.STRING },
      instagramHandle: { type: Sequelize.STRING },
      whyJoin: { type: Sequelize.TEXT },
      passportPhotoUrl: { type: Sequelize.STRING },
      fullLengthPhotoUrl: { type: Sequelize.STRING },
      idDocumentUrl: { type: Sequelize.STRING },
      guardianConsentUrl: { type: Sequelize.STRING },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending'
      },
      reviewedByAdminId: { type: Sequelize.UUID },
      rejectionReason: { type: Sequelize.STRING },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('contestant_applications');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_contestant_applications_status";');
  }
};
