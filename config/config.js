require('dotenv').config();

// Neon (and most managed Postgres providers) hand you a single connection
// string, e.g.:
//   postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require
//
// Put that in DATABASE_URL in your .env and every environment below uses it
// the same way - no separate host/user/password fields to keep in sync.
// Neon requires SSL, so dialectOptions.ssl is on by default. For local-only
// Postgres without SSL configured, set DB_SSL=false in .env.

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
