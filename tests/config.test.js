const constants = require('../src/config/constants');
const { parseDatabaseUrl } = require('../src/config/db');

describe('Configuration & constants', () => {
  test('points defaults match architecture specification', () => {
    expect(constants.STARTER_POINTS).toBe(20);
    expect(constants.POINTS_PER_SESSION).toBe(10);
    expect(constants.BCRYPT_ROUNDS).toBe(12);
    expect(constants.MIN_PASSWORD_LENGTH).toBe(8);
    expect(constants.AVATAR_SIZE).toBe(400);
    expect(constants.MAX_UPLOAD_MB).toBe(5);
  });

  test('parseDatabaseUrl extracts host, port, user, password, and database', () => {
    const parsed = parseDatabaseUrl('mysql://skillswap:secret@localhost:3306/skillswap_db');
    expect(parsed).toEqual({
      host: 'localhost',
      port: 3306,
      user: 'skillswap',
      password: 'secret',
      database: 'skillswap_db',
    });
  });
});
