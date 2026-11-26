const AppError = require('../utils/AppError');
const { USER_STATUSES } = require('../config/constants');

/**
 * Ensure the visitor has an active authenticated session.
 */
function requireAuth(req, res, next) {
  const user = req.session?.user;
  if (!user) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/login');
  }

  if (user.status === USER_STATUSES.SUSPENDED) {
    req.session.destroy(() => {
      res.clearCookie('skillswap.sid');
      res.status(403).render('pages/error', {
        title: 'Forbidden',
        statusCode: 403,
        message: 'Your account has been suspended. Please contact support.',
      });
    });
    return;
  }

  return next();
}

/**
 * Restrict access to users matching one of the allowed roles.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) {
      req.flash('error', 'Please log in to continue.');
      return res.redirect('/login');
    }

    if (!allowedRoles.includes(user.role)) {
      return next(new AppError('You do not have permission to access this page.', 403));
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
