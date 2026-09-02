module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    fullName: { type: DataTypes.STRING, allowNull: false },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true }
    },
    phone: { type: DataTypes.STRING, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: {
      // voter: default account, can vote & buy tickets
      // staff: can check in tickets at the event (no admin dashboard access)
      // admin: full back-office access (approve contestants, manage editions, bundles, events)
      // superadmin: admin + can create other admins/staff
      type: DataTypes.ENUM('voter', 'staff', 'admin', 'superadmin'),
      defaultValue: 'voter'
    },
    avatarUrl: { type: DataTypes.STRING, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    emailVerifiedAt: { type: DataTypes.DATE, allowNull: true },
    emailVerificationToken: { type: DataTypes.STRING, allowNull: true },
    emailVerificationTokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
    passwordResetToken: { type: DataTypes.STRING, allowNull: true },
    passwordResetTokenExpiresAt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'users',
    timestamps: true
  });

  User.associate = (models) => {
    User.hasOne(models.Wallet, { foreignKey: 'userId', as: 'wallet' });
    User.hasMany(models.Vote, { foreignKey: 'userId', as: 'votes' });
    User.hasMany(models.Transaction, { foreignKey: 'userId', as: 'transactions' });
    User.hasMany(models.Ticket, { foreignKey: 'userId', as: 'tickets' });
    User.hasOne(models.ContestantApplication, { foreignKey: 'userId', as: 'application' });
    User.hasMany(models.Ticket, { foreignKey: 'checkedInByStaffId', as: 'checkInsHandled' });
  };

  return User;
};
