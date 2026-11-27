const settingsService = require('../services/settingsService');
const { DEFAULT_SETTINGS } = require('../models/settingsModel');
const { USER_ROLES } = require('../config/constants');

/**
 * Attach res.locals.platformSettings so all templates reflect Admin General Settings.
 */
async function attachPlatformSettings(_req, res, next) {
  try {
    res.locals.platformSettings = await settingsService.getPlatformSettings();
  } catch {
    res.locals.platformSettings = { ...DEFAULT_SETTINGS };
  }
  return next();
}

/**
 * Block non-admin visitors with HTTP 503 when Admin Maintenance Mode is enabled.
 * Always leaves /health, /login, /logout, /verify-email, and authenticated admins accessible.
 */
function enforceMaintenanceMode(req, res, next) {
  const settings = res.locals.platformSettings || DEFAULT_SETTINGS;
  if (!settings.maintenanceMode) {
    return next();
  }

  const allowedPaths = ['/health', '/login', '/logout', '/verify-email'];
  if (allowedPaths.includes(req.path)) {
    return next();
  }

  if (req.session?.user?.role === USER_ROLES.ADMIN) {
    return next();
  }

  return res.status(503).render('pages/error', {
    title: 'Maintenance Mode',
    statusCode: 503,
    message: `${settings.platformName} is currently undergoing scheduled maintenance. Please check back soon.`,
    hideSidebar: !req.session?.user,
    hideFooter: !req.session?.user,
  });
}

module.exports = {
  attachPlatformSettings,
  enforceMaintenanceMode,
};
