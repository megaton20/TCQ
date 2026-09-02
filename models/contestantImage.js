module.exports = (sequelize, DataTypes) => {
  const ContestantImage = sequelize.define('ContestantImage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    contestantId: { type: DataTypes.UUID, allowNull: false },
    url: { type: DataTypes.STRING, allowNull: false },
    cloudinaryPublicId: { type: DataTypes.STRING, allowNull: true },
    caption: { type: DataTypes.STRING, allowNull: true },
    category: {
      // profile: shown in the contestant's own gallery/detail page
      // outreach: shown on their charity outreach blog page (winners only, in practice)
      type: DataTypes.ENUM('profile', 'outreach'),
      defaultValue: 'profile'
    },
    isThumbnail: { type: DataTypes.BOOLEAN, defaultValue: false }, // shown on cards/listing pages
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 } // controls gallery order on detail page
  }, {
    tableName: 'contestant_images',
    timestamps: true,
    indexes: [{ fields: ['contestantId'] }]
  });

  ContestantImage.associate = (models) => {
    ContestantImage.belongsTo(models.Contestant, { foreignKey: 'contestantId', as: 'contestant' });
  };

  return ContestantImage;
};
