const rateLimit = require('express-rate-limit');

/**
 * Build a rate limiter middleware with friendly HTML error rendering on limit exceeded.
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, limit = 20, message } = {}) {
  const friendlyMessage =
    message || 'Too many requests from this IP. Please wait a few minutes and try again.';

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).render('pages/error', {
        title: 'Too Many Requests',
        statusCode: 429,
        message: friendlyMessage,
      });
    },
  });
}

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

const registerLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many registration attempts. Please try again later.',
});

module.exports = {
  createRateLimiter,
  loginLimiter,
  registerLimiter,
};
