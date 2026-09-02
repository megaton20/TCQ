module.exports = (sequelize, DataTypes) => {
  const Edition = sequelize.define('Edition', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    year: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    title: { type: DataTypes.STRING, allowNull: false }, // e.g. "The Carnival Queen 2026"
    theme: { type: DataTypes.STRING, allowNull: true }, // short theme title, e.g. "Rhythm of the Coast"
    themeDescription: { type: DataTypes.TEXT, allowNull: true }, // longer body text for the home page Theme section
    themeImageUrl: { type: DataTypes.STRING, allowNull: true },
    isCurrent: { type: DataTypes.BOOLEAN, defaultValue: false }, // drives "this year" on home page
    votingOpensAt: { type: DataTypes.DATE, allowNull: true },
    votingClosesAt: { type: DataTypes.DATE, allowNull: true },
    eventDate: { type: DataTypes.DATE, allowNull: true }, // main event / coronation night
    description: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'editions',
    timestamps: true
  });

  Edition.associate = (models) => {
    Edition.hasMany(models.Contestant, { foreignKey: 'editionId', as: 'contestants' });
    Edition.hasMany(models.Event, { foreignKey: 'editionId', as: 'events' });
  };

  return Edition;
};
