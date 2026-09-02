module.exports = (sequelize, DataTypes) => {
  const CoinBundle = sequelize.define('CoinBundle', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: { type: DataTypes.STRING, allowNull: false }, // e.g. "Starter Pack"
    votesEquivalent: { type: DataTypes.INTEGER, allowNull: false }, // e.g. 5 votes
    coinAmount: { type: DataTypes.BIGINT, allowNull: false }, // == votesEquivalent (1 coin = 1 vote, no bonus)
    priceNaira: { type: DataTypes.BIGINT, allowNull: false }, // = coinAmount * 200 (1 coin = ₦200)
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, {
    tableName: 'coin_bundles',
    timestamps: true
  });

  CoinBundle.associate = (models) => {
    CoinBundle.hasMany(models.Transaction, { foreignKey: 'coinBundleId', as: 'transactions' });
  };

  return CoinBundle;
};
