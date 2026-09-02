module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define('Event', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    editionId: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    venue: { type: DataTypes.STRING, allowNull: false },
    eventDate: { type: DataTypes.DATE, allowNull: false },
    ticketPriceNaira: { type: DataTypes.BIGINT, allowNull: false },
    capacity: { type: DataTypes.INTEGER, allowNull: true },
    ticketsSold: { type: DataTypes.INTEGER, defaultValue: 0 },
    posterUrl: { type: DataTypes.STRING, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true } // controls whether it's open for sale
  }, {
    tableName: 'events',
    timestamps: true
  });

  Event.associate = (models) => {
    Event.belongsTo(models.Edition, { foreignKey: 'editionId', as: 'edition' });
    Event.hasMany(models.Ticket, { foreignKey: 'eventId', as: 'tickets' });
    Event.hasMany(models.TicketTier, { foreignKey: 'eventId', as: 'tiers' });
  };

  return Event;
};
