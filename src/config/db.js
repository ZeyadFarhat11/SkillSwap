const mysql = require('mysql2/promise');
const env = require('./env');

/**
 * Parse DATABASE_URL into mysql2 connection options for express-mysql-session.
 */
function parseDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
}

let pool = null;

function getDbPool() {
  if (!pool) {
    const config = parseDatabaseUrl(env.DATABASE_URL);
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

module.exports = {
  parseDatabaseUrl,
  getDbPool,
};
