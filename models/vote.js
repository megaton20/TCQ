module.exports = (sequelize, DataTypes) => {
  const Vote = sequelize.define('Vote', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    contestantId: { type: DataTypes.UUID, allowNull: false },
    editionId: { type: DataTypes.UUID, allowNull: false },
    voteCount: { type: DataTypes.INTEGER, allowNull: false }, // e.g. 25 votes in this action
    coinsSpent: { type: DataTypes.BIGINT, allowNull: false }, // == voteCount (1 coin = 1 vote)
    method: {
      type: DataTypes.ENUM('quick', 'manual'),
      defaultValue: 'manual'
    }
  }, {
    tableName: 'votes',
    timestamps: true,
    indexes: [
      { fields: ['contestantId'] },
      { fields: ['userId'] },
      { fields: ['editionId'] }
    ]
  });

  Vote.associate = (models) => {
    Vote.belongsTo(models.User, { foreignKey: 'userId', as: 'voter' });
    Vote.belongsTo(models.Contestant, { foreignKey: 'contestantId', as: 'contestant' });
    Vote.belongsTo(models.Edition, { foreignKey: 'editionId', as: 'edition' });
  };

  return Vote;
};
