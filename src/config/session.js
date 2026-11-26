const session = require('express-session');
const MySQLStoreFactory = require('express-mysql-session');
const env = require('./env');
const { getDbPool } = require('./db');

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Create Express session middleware backed by MySQL in dev/prod
 * and MemoryStore in automated tests.
 */
function createSessionMiddleware() {
  let store;

  if (env.NODE_ENV !== 'test') {
    const MySQLStore = MySQLStoreFactory(session);
    store = new MySQLStore(
      {
        expiration: SESSION_MAX_AGE_MS,
        createDatabaseTable: true,
        // Use a dedicated table name so it never collides with the domain `sessions` table.
        schema: {
          tableName: 'express_sessions',
          columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data',
          },
        },
      },
      getDbPool()
    );
  }

  return session({
    name: 'skillswap.sid',
    secret: env.SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE_MS,
    },
  });
}

module.exports = {
  createSessionMiddleware,
};
