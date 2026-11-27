const notificationService = require('../services/notificationService');

/**
 * GET /notifications
 * Render the authenticated user's notifications feed and mark notifications as seen.
 */
async function showNotifications(req, res, next) {
  try {
    const userId = req.session.user.id;
    const clearedAt = req.session.notificationsClearedAt || null;
    const notifications = await notificationService.getNotificationsForUser(userId, clearedAt);

    req.session.notificationsSeenAt = new Date().toISOString();
    res.locals.hasNewNotifications = false;

    return req.session.save((err) => {
      if (err) return next(err);
      return res.render('pages/notifications', {
        title: 'Notifications',
        useSidebar: true,
        hideFooter: true,
        activeNav: 'notifications',
        bodyClass: 'bg-[#F8FAFC] text-slate-800 antialiased min-h-screen',
        notifications,
      });
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /notifications/clear
 * Mark current notifications as cleared and seen in the user's session.
 */
function clearNotifications(req, res, next) {
  const nowIso = new Date().toISOString();
  req.session.notificationsClearedAt = nowIso;
  req.session.notificationsSeenAt = nowIso;
  req.flash('success', 'All notifications cleared.');
  return req.session.save((err) => {
    if (err) return next(err);
    return res.redirect('/notifications');
  });
}

module.exports = { showNotifications, clearNotifications };
