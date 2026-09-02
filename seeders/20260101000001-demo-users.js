'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const password = await bcrypt.hash('111111', 12);
    const now = new Date();

    const superAdminId = uuidv4();
    const adminId = uuidv4();
    const staffId = uuidv4();
    const voterId = uuidv4();

    await queryInterface.bulkInsert('users', [
      {
        id: superAdminId,
        fullName: 'Mega Admin',
        email: 'admin@carnivalqueen.com',
        phone: '08000000001',
        password,
        role: 'superadmin',
        isActive: true,
        emailVerifiedAt: now,
        createdAt: now, updatedAt: now
      },
      {
        // Operational admin - door entry records + day-to-day management,
        // no access to Transactions or revenue figures. See adminRoutes.js.
        id: adminId,
        fullName: 'Door Manager',
        email: 'manager@carnivalqueen.com',
        phone: '08000000004',
        password,
        role: 'admin',
        isActive: true,
        emailVerifiedAt: now,
        createdAt: now, updatedAt: now
      },
      {
        id: staffId,
        fullName: 'Door Staff',
        email: 'staff@carnivalqueen.com',
        phone: '08000000002',
        password,
        role: 'staff',
        isActive: true,
        emailVerifiedAt: now,
        createdAt: now, updatedAt: now
      },
      {
        id: voterId,
        fullName: 'Adariku Michael',
        email: 'adarikumichael@gmail.com',
        phone: '08000000003',
        password,
        role: 'voter',
        isActive: true,
        emailVerifiedAt: now,

        createdAt: now, updatedAt: now
      }
    ]);

    await queryInterface.bulkInsert('wallets', [
      { id: uuidv4(), userId: superAdminId, coinBalance: 0, createdAt: now, updatedAt: now },
      { id: uuidv4(), userId: adminId, coinBalance: 0, createdAt: now, updatedAt: now },
      { id: uuidv4(), userId: staffId, coinBalance: 0, createdAt: now, updatedAt: now },
      { id: uuidv4(), userId: voterId, coinBalance: 100000, createdAt: now, updatedAt: now } // pre-loaded for testing votes
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      email: ['admin@carnivalqueen.com', 'manager@carnivalqueen.com', 'staff@carnivalqueen.com', 'voter@carnivalqueen.com']
    });
  }
};
