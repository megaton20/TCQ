require('dotenv').config();

const useSSL = process.env.DB_SSL !== 'false';

const base = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  logging: false,
  dialectOptions: useSSL
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {}
};

module.exports = {
  development: { ...base },
  test: { ...base, use_env_variable: 'TEST_DATABASE_URL' },
  production: { ...base }
};
