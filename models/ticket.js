module.exports = (sequelize, DataTypes) => {
  const Ticket = sequelize.define('Ticket', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    eventId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    ticketTierId: { type: DataTypes.UUID, allowNull: true }, // Regular / VIP / Table for 5 / Table for 10
    ticketCode: { type: DataTypes.STRING, allowNull: false, unique: true }, // full unique payload encoded in QR
    fallbackCode: { type: DataTypes.STRING, allowNull: false, unique: true }, // short human-readable code, e.g. "CQ-7F3K9X"
    qrImageUrl: { type: DataTypes.STRING, allowNull: true }, // local file path - fast, but wiped on redeploy on ephemeral hosts (Render etc.)
    qrImageCloudinaryUrl: { type: DataTypes.STRING, allowNull: true }, // persistent fallback/primary - survives redeploys
    qrImageCloudinaryPublicId: { type: DataTypes.STRING, allowNull: true },
    ticketEmailSentAt: { type: DataTypes.DATE, allowNull: true }, // null = email never successfully sent (e.g. Brevo quota hit)
    holderName: { type: DataTypes.STRING, allowNull: false }, // name printed on ticket (may differ from account name)
    priceNaira: { type: DataTypes.BIGINT, allowNull: false },
    paystackReference: { type: DataTypes.STRING, allowNull: true, unique: true },
    status: {
      type: DataTypes.ENUM('pending_payment', 'valid', 'used', 'cancelled'),
      defaultValue: 'pending_payment'
    },
    checkedInAt: { type: DataTypes.DATE, allowNull: true },
    checkedInByStaffId: { type: DataTypes.UUID, allowNull: true },
    checkInMethod: { type: DataTypes.ENUM('qr', 'fallback_code'), allowNull: true }
  }, {
    tableName: 'tickets',
    timestamps: true,
    indexes: [
      { fields: ['eventId'] },
      { fields: ['userId'] },
      { fields: ['status'] }
    ]
  });

  Ticket.associate = (models) => {
    Ticket.belongsTo(models.Event, { foreignKey: 'eventId', as: 'event' });
    Ticket.belongsTo(models.User, { foreignKey: 'userId', as: 'buyer' });
    Ticket.belongsTo(models.User, { foreignKey: 'checkedInByStaffId', as: 'checkedInBy' });
    Ticket.belongsTo(models.TicketTier, { foreignKey: 'ticketTierId', as: 'tier' });
    Ticket.hasMany(models.TableMember, { foreignKey: 'ticketId', as: 'members' });
  };

  return Ticket;
};
