module.exports = (sequelize, DataTypes) => {
  const TableMember = sequelize.define('TableMember', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ticketId: { type: DataTypes.UUID, allowNull: false },
    fullName: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: true },
    isOwner: { type: DataTypes.BOOLEAN, defaultValue: false }, // the buyer of the table
    addedAtDoor: { type: DataTypes.BOOLEAN, defaultValue: false }, // staff registered this name on-site rather than the owner pre-registering it
    checkedInAt: { type: DataTypes.DATE, allowNull: true },
    checkedInByStaffId: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'table_members',
    timestamps: true
  });

  TableMember.associate = (models) => {
    TableMember.belongsTo(models.Ticket, { foreignKey: 'ticketId', as: 'ticket' });
    TableMember.belongsTo(models.User, { foreignKey: 'checkedInByStaffId', as: 'checkedInBy' });
  };

  return TableMember;
};
