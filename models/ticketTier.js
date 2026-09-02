module.exports = (sequelize, DataTypes) => {
  const TicketTier = sequelize.define('TicketTier', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    eventId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    tierType: {
      type: DataTypes.ENUM('single', 'table'),
      defaultValue: 'single'
    },
    seatsIncluded: { type: DataTypes.INTEGER, defaultValue: 1 },
    priceNaira: { type: DataTypes.BIGINT, allowNull: false },
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    quantityAvailable: { type: DataTypes.INTEGER, allowNull: true },
    quantitySold: { type: DataTypes.INTEGER, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, {
    tableName: 'ticket_tiers',
    timestamps: true
  });

  TicketTier.associate = (models) => {
    TicketTier.belongsTo(models.Event, { foreignKey: 'eventId', as: 'event' });
    TicketTier.hasMany(models.Ticket, { foreignKey: 'ticketTierId', as: 'tickets' });
  };

  return TicketTier;
};
