const { doubleCsrf } = require('csrf-csrf');
const env = require('../config/env');

const isProd = env.NODE_ENV === 'production';

const { generateToken, validateRequest, invalidCsrfTokenError, doubleCsrfProtection } =
  doubleCsrf({
    getSecret: () => env.SESSION_SECRET,
    getSessionIdentifier: (req) => String(req.session?.user?.id || 'guest'),
    cookieName: isProd ? '__Host-skillswap.x-csrf-token' : 'skillswap.x-csrf-token',
    cookieOptions: {
      sameSite: 'lax',
      path: '/',
      secure: isProd,
      httpOnly: true,
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getTokenFromRequest: (req) => req.body?._csrf || req.headers['x-csrf-token'],
    // Multipart forms cannot be parsed before multer; multipart routes run verifyMultipartCsrf right after multer.
    skipCsrfProtection: (req) =>
      req.method === 'POST' &&
      (req.path === '/profile/avatar' ||
        (req.path === '/profile/edit' && Boolean(req.is('multipart/form-data')))),
  });

/**
 * Expose a valid CSRF token to Pug templates without throwing if an older
 * pre-login cookie no longer matches the authenticated session identifier.
 */
function attachCsrfToken(req, res, next) {
  res.locals.csrfToken = generateToken(req, res, false, false);
  next();
}

/**
 * Force-rotate the CSRF cookie and token after authentication state changes.
 */
function rotateCsrfToken(req, res) {
  const token = generateToken(req, res, true, false);
  res.locals.csrfToken = token;
  return token;
}

module.exports = {
  csrfProtection: doubleCsrfProtection,
  validateCsrfRequest: validateRequest,
  invalidCsrfTokenError,
  attachCsrfToken,
  rotateCsrfToken,
};
