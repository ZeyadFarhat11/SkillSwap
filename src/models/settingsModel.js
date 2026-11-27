const prisma = require('./prisma');
const AppError = require('../utils/AppError');

const DEFAULT_SETTINGS = Object.freeze({
  id: 1,
  platformName: 'SkillSwap',
  platformEmail: 'support@skillswap.com',
  platformDescription:
    'A community where people exchange skills, share knowledge, and learn together.',
  allowRegistrations: true,
  requireEmailVerification: false,
  maintenanceMode: false,
});

function mergeWithDefaults(row) {
  if (!row) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    id: row.id || 1,
    platformName: row.platformName || DEFAULT_SETTINGS.platformName,
    platformEmail: row.platformEmail || DEFAULT_SETTINGS.platformEmail,
    platformDescription: row.platformDescription || DEFAULT_SETTINGS.platformDescription,
    allowRegistrations:
      typeof row.allowRegistrations === 'boolean'
        ? row.allowRegistrations
        : DEFAULT_SETTINGS.allowRegistrations,
    requireEmailVerification:
      typeof row.requireEmailVerification === 'boolean'
        ? row.requireEmailVerification
        : DEFAULT_SETTINGS.requireEmailVerification,
    maintenanceMode:
      typeof row.maintenanceMode === 'boolean'
        ? row.maintenanceMode
        : DEFAULT_SETTINGS.maintenanceMode,
  };
}

/**
 * Load platform settings (falls back cleanly to defaults if table or mock delegate is unavailable).
 */
async function getSettings() {
  if (typeof prisma.platformSetting?.findUnique !== 'function') {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const row = await prisma.platformSetting.findUnique({ where: { id: 1 } });
    return mergeWithDefaults(row);
  } catch (err) {
    if (err && err.code === 'P2021') {
      return { ...DEFAULT_SETTINGS };
    }
    throw err;
  }
}

async function upsertSettings(updateData, createData) {
  if (typeof prisma.platformSetting?.upsert !== 'function') {
    throw new AppError(
      'Platform settings database client is out of date. Stop the server and run "npm run prisma:migrate" and "npm run prisma:generate".',
      503
    );
  }

  try {
    const row = await prisma.platformSetting.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        ...createData,
      },
    });
    return mergeWithDefaults(row);
  } catch (err) {
    if (err && err.code === 'P2021') {
      throw new AppError(
        'Platform settings table is missing in the database. Run "npm run prisma:migrate" to apply the latest migration.',
        503
      );
    }
    throw err;
  }
}

/**
 * Update General Information settings atomically on singleton row id=1.
 */
async function updateGeneralSettings({ platformName, platformEmail, platformDescription }) {
  return upsertSettings(
    {
      platformName,
      platformEmail,
      platformDescription,
    },
    {
      platformName,
      platformEmail,
      platformDescription,
      allowRegistrations: DEFAULT_SETTINGS.allowRegistrations,
      requireEmailVerification: DEFAULT_SETTINGS.requireEmailVerification,
      maintenanceMode: DEFAULT_SETTINGS.maintenanceMode,
    }
  );
}

/**
 * Update Platform Preferences boolean flags atomically on singleton row id=1.
 */
async function updatePreferenceSettings({
  allowRegistrations,
  requireEmailVerification,
  maintenanceMode,
}) {
  return upsertSettings(
    {
      allowRegistrations,
      requireEmailVerification,
      maintenanceMode,
    },
    {
      platformName: DEFAULT_SETTINGS.platformName,
      platformEmail: DEFAULT_SETTINGS.platformEmail,
      platformDescription: DEFAULT_SETTINGS.platformDescription,
      allowRegistrations,
      requireEmailVerification,
      maintenanceMode,
    }
  );
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  updateGeneralSettings,
  updatePreferenceSettings,
};
