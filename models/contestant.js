module.exports = (sequelize, DataTypes) => {
  const Contestant = sequelize.define('Contestant', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    editionId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: true }, // linked account, if applicant registered
    fullName: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false, unique: true },
    contestantNumber: { type: DataTypes.INTEGER, allowNull: true }, // e.g. #07
    stateOfOrigin: { type: DataTypes.STRING, allowNull: true },
    age: { type: DataTypes.INTEGER, allowNull: true },
    occupation: { type: DataTypes.STRING, allowNull: true },
    bio: { type: DataTypes.TEXT, allowNull: true },
    blogContent: { type: DataTypes.TEXT, allowNull: true }, // winner's charity outreach story, shown on their blog page
    tagline: { type: DataTypes.STRING, allowNull: true },
    instagramHandle: { type: DataTypes.STRING, allowNull: true },
    status: {
      // pending: awaiting admin approval from application
      // approved: live, visible, votable
      // rejected: not accepted
      // disqualified: removed after being approved
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'disqualified'),
      defaultValue: 'pending'
    },
    isWinner: { type: DataTypes.BOOLEAN, defaultValue: false },
    winnerPosition: { type: DataTypes.STRING, allowNull: true }, // "Queen", "1st Runner-up", etc
    voteCount: { type: DataTypes.BIGINT, defaultValue: 0 }, // denormalized for fast leaderboard reads
    coinsEarned: { type: DataTypes.BIGINT, defaultValue: 0 } // total coins spent voting for this contestant
  }, {
    tableName: 'contestants',
    timestamps: true,
    indexes: [
      { fields: ['editionId'] },
      { fields: ['status'] },
      { fields: ['voteCount'] }
    ]
  });

  Contestant.associate = (models) => {
    Contestant.belongsTo(models.Edition, { foreignKey: 'editionId', as: 'edition' });
    Contestant.belongsTo(models.User, { foreignKey: 'userId', as: 'account' });
    Contestant.hasMany(models.ContestantImage, { foreignKey: 'contestantId', as: 'images' });
    Contestant.hasMany(models.Vote, { foreignKey: 'contestantId', as: 'votes' });
  };

  return Contestant;
};
