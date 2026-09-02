module.exports = (sequelize, DataTypes) => {
  const Wallet = sequelize.define('Wallet', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    coinBalance: { type: DataTypes.BIGINT, defaultValue: 0, allowNull: false }
  }, {
    tableName: 'wallets',
    timestamps: true
  });

  Wallet.associate = (models) => {
    Wallet.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Wallet;
};
