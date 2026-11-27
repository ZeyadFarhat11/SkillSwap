const settingsModel = require('../models/settingsModel');

async function getPlatformSettings() {
  return settingsModel.getSettings();
}

async function updateGeneralSettings({ platformName, platformEmail, platformDescription }) {
  return settingsModel.updateGeneralSettings({
    platformName,
    platformEmail,
    platformDescription,
  });
}

async function updatePreferenceSettings({
  allowRegistrations,
  requireEmailVerification,
  maintenanceMode,
}) {
  return settingsModel.updatePreferenceSettings({
    allowRegistrations,
    requireEmailVerification,
    maintenanceMode,
  });
}

module.exports = {
  getPlatformSettings,
  updateGeneralSettings,
  updatePreferenceSettings,
};
