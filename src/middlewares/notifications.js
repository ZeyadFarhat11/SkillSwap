const notificationService = require('../services/notificationService');

/**
 * Populate res.locals.hasNewNotifications for authenticated sidebar views.
 */
async function attachNotificationBadge(req, res, next) {
  res.locals.hasNewNotifications = false;

  if (req.method !== 'GET' || !req.session?.user?.id || req.path === '/notifications') {
    return next();
  }

  try {
    res.locals.hasNewNotifications = await notificationService.hasNewNotifications(
      req.session.user.id,
      req.session.notificationsSeenAt,
      req.session.notificationsClearedAt
    );
  } catch {
    res.locals.hasNewNotifications = false;
  }

  return next();
}

module.exports = { attachNotificationBadge };
