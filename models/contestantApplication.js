module.exports = (sequelize, DataTypes) => {
  const ContestantApplication = sequelize.define('ContestantApplication', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    editionId: { type: DataTypes.UUID, allowNull: false },
    fullName: { type: DataTypes.STRING, allowNull: false },
    dateOfBirth: { type: DataTypes.DATEONLY, allowNull: false },
    gender: { type: DataTypes.STRING, allowNull: false },
    stateOfOrigin: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    occupation: { type: DataTypes.STRING, allowNull: true },
    height: { type: DataTypes.STRING, allowNull: true },
    instagramHandle: { type: DataTypes.STRING, allowNull: true },
    whyJoin: { type: DataTypes.TEXT, allowNull: true }, // essay/motivation requirement
    passportPhotoUrl: { type: DataTypes.STRING, allowNull: true }, // requirement doc
    fullLengthPhotoUrl: { type: DataTypes.STRING, allowNull: true }, // requirement doc
    idDocumentUrl: { type: DataTypes.STRING, allowNull: true }, // requirement doc (valid ID)
    guardianConsentUrl: { type: DataTypes.STRING, allowNull: true }, // if applicant is a minor
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    },
    reviewedByAdminId: { type: DataTypes.UUID, allowNull: true },
    rejectionReason: { type: DataTypes.STRING, allowNull: true }
  }, {
    tableName: 'contestant_applications',
    timestamps: true
  });

  ContestantApplication.associate = (models) => {
    ContestantApplication.belongsTo(models.User, { foreignKey: 'userId', as: 'applicant' });
    ContestantApplication.belongsTo(models.Edition, { foreignKey: 'editionId', as: 'edition' });
  };

  return ContestantApplication;
};
