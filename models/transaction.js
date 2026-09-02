module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    type: {
      // bundle_purchase: money -> coins (Paystack, split code applied)
      // vote_spend: coins -> vote (no money movement, internal)
      // ticket_purchase: money -> ticket (Paystack, NO split code)
      type: DataTypes.ENUM('bundle_purchase', 'vote_spend', 'ticket_purchase'),
      allowNull: false
    },
    coinBundleId: { type: DataTypes.UUID, allowNull: true },
    ticketId: { type: DataTypes.UUID, allowNull: true },
    voteId: { type: DataTypes.UUID, allowNull: true },
    amountNaira: { type: DataTypes.BIGINT, allowNull: true }, // null for vote_spend
    coinAmount: { type: DataTypes.BIGINT, allowNull: true }, // credited (bundle) or debited (vote)
    paystackReference: { type: DataTypes.STRING, allowNull: true, unique: true },
    splitCodeApplied: { type: DataTypes.STRING, allowNull: true }, // only set for bundle_purchase
    status: {
      type: DataTypes.ENUM('pending', 'success', 'failed'),
      defaultValue: 'pending'
    },
    metadata: { type: DataTypes.JSONB, allowNull: true }
  }, {
    tableName: 'transactions',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['type'] },
      { fields: ['status'] }
    ]
  });

  Transaction.associate = (models) => {
    Transaction.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Transaction.belongsTo(models.CoinBundle, { foreignKey: 'coinBundleId', as: 'bundle' });
    Transaction.belongsTo(models.Ticket, { foreignKey: 'ticketId', as: 'ticket' });
    Transaction.belongsTo(models.Vote, { foreignKey: 'voteId', as: 'vote' });
  };

  return Transaction;
};
