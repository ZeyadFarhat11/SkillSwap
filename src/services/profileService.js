const userModel = require('../models/userModel');
const storageService = require('./storageService');
const AppError = require('../utils/AppError');
const { SKILL_TYPES, USER_STATUSES } = require('../config/constants');
const { DAY_NAMES, formatPrismaTime } = require('../utils/time');

/**
 * Build a safe view-ready user profile object with formatted skills and availability.
 */
async function getProfile(userId, { includePrivate = false } = {}) {
  const user = await userModel.findProfileById(userId);
  if (!user || (!includePrivate && user.status === USER_STATUSES.SUSPENDED)) {
    throw new AppError('Profile not found.', 404);
  }

  const skills = user.userSkills || [];
  const offerSkills = skills
    .filter((entry) => entry.type === SKILL_TYPES.OFFER)
    .map((entry) => ({
      id: entry.id,
      skillId: entry.skillId,
      skillName: entry.skill.skillName,
      level: entry.level,
    }));

  const wantSkills = skills
    .filter((entry) => entry.type === SKILL_TYPES.WANT)
    .map((entry) => ({
      id: entry.id,
      skillId: entry.skillId,
      skillName: entry.skill.skillName,
      level: entry.level,
    }));

  const availability = (user.availability || []).map((slot) => ({
    id: slot.id,
    dayOfWeek: slot.dayOfWeek,
    dayName: DAY_NAMES[slot.dayOfWeek] || `Day ${slot.dayOfWeek}`,
    startTime: formatPrismaTime(slot.startTime),
    endTime: formatPrismaTime(slot.endTime),
  }));

  return {
    id: user.id,
    name: user.name,
    ...(includePrivate ? { email: user.email, pointsBalance: user.pointsBalance } : {}),
    role: user.role,
    bio: user.bio || '',
    avatarPath: user.avatarPath || null,
    status: user.status,
    createdAt: user.createdAt,
    projectLinks: (user.projectLinks || []).map((link) => ({
      id: link.id,
      url: link.url,
    })),
    offerSkills,
    wantSkills,
    availability,
  };
}

/**
 * Update the authenticated user's profile fields and project links in one transaction.
 */
async function updateProfile(userId, { name, bio, projectLinks }) {
  const existing = await userModel.findById(userId);
  if (!existing) {
    throw new AppError('User not found.', 404);
  }

  const updated = await userModel.updateProfileAndLinks(userId, {
    name: name.trim(),
    bio,
    projectLinks,
  });

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    status: updated.status,
    pointsBalance: updated.pointsBalance,
    avatarPath: updated.avatarPath || null,
  };
}

/**
 * Process, resize, and store a newly uploaded avatar image for the user.
 */
async function updateAvatar(userId, uploadedFile) {
  if (!uploadedFile || !uploadedFile.path) {
    throw new AppError('Please select an image file to upload.', 400);
  }

  const existing = await userModel.findById(userId);
  if (!existing) {
    await storageService.safeUnlink(uploadedFile.path);
    throw new AppError('User not found.', 404);
  }

  const newAvatarPath = await storageService.processAndSaveAvatar(uploadedFile.path);

  try {
    await userModel.updateAvatarPath(userId, newAvatarPath);
  } catch (err) {
    await storageService.deleteStoredFile(newAvatarPath);
    throw err;
  }

  if (existing.avatarPath && existing.avatarPath !== newAvatarPath) {
    await storageService.deleteStoredFile(existing.avatarPath);
  }

  return newAvatarPath;
}

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
};
