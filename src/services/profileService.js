const userModel = require('../models/userModel');
const sessionModel = require('../models/sessionModel');
const storageService = require('./storageService');
const ratingService = require('./ratingService');
const AppError = require('../utils/AppError');
const { SKILL_TYPES, USER_STATUSES, SESSION_STATUSES } = require('../config/constants');
const { DAY_NAMES, formatPrismaTime } = require('../utils/time');

function normalizeAvatarPath(avatarPath) {
  if (!avatarPath) return null;
  const cleaned = String(avatarPath).replace(/\\/g, '/').replace(/^\/+/, '');
  return cleaned || null;
}

/**
 * Format a stored project URL into a progress-style project card object.
 */
function formatProjectCard(link, index) {
  let host = 'Project';
  let title = link.url;
  try {
    const parsed = new URL(link.url);
    host = parsed.hostname.replace(/^www\./, '');
    const segments = parsed.pathname.split('/').filter(Boolean);
    title = segments.length ? segments[segments.length - 1] : host;
  } catch {
    title = link.url;
  }

  return {
    id: link.id,
    url: link.url,
    host,
    title,
    iconText: index % 2 === 0 ? '</>' : host.slice(0, 2).toUpperCase(),
    accent: index % 2 === 0 ? 'blue' : 'emerald',
  };
}

/**
 * Derive earned/locked milestone badges and skill completion certificates from real activity.
 */
function buildProgressHighlights({ userId, completedSessions, reviewsSummary, offerSkills, wantSkills }) {
  const completedCount = completedSessions.length;
  const taughtCount = completedSessions.filter((s) => s.instructorId === userId).length;
  const avgNum = reviewsSummary.averageRating ? Number(reviewsSummary.averageRating) : 0;
  const hasTopRating = (reviewsSummary.reviews || []).length >= 1 && avgNum >= 4.5;

  const badges = [
    {
      key: 'first-swap',
      title: 'First Swap',
      description: 'Complete at least 1 session',
      earned: completedCount >= 1,
      colorClass: 'bg-amber-500 text-white',
    },
    {
      key: 'skill-mentor',
      title: 'Skill Mentor',
      description: 'Teach 1+ completed session',
      earned: taughtCount >= 1,
      colorClass: 'bg-[#0056D2] text-white',
    },
    {
      key: 'top-rated',
      title: 'Top Rated',
      description: '4.5+ average review rating',
      earned: hasTopRating,
      colorClass: 'bg-[#2575FC] text-white',
    },
    {
      key: 'multi-skill',
      title: 'Balanced Swapper',
      description: 'Offer & want at least 1 skill',
      earned: offerSkills.length >= 1 && wantSkills.length >= 1,
      colorClass: 'bg-emerald-500 text-white',
    },
  ];

  // Certificates represent completed learning sessions, deduplicated per skill (newest first)
  const seenSkills = new Set();
  const certificates = [];
  const learnedCompleted = completedSessions.filter((s) => s.learnerId === userId);
  for (const sess of learnedCompleted) {
    if (seenSkills.has(sess.skillId)) continue;
    seenSkills.add(sess.skillId);
    const skillName = sess.skill?.skillName || 'Skill Exchange';
    const mentorName = sess.instructor?.name || 'SkillSwap Mentor';
    const issuedDate = new Date(sess.dateTime || sess.createdAt).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    certificates.push({
      sessionId: sess.id,
      title: `${skillName} Completion Certificate`,
      issuer: `Mentor: ${mentorName}`,
      issuedLabel: `Issued: ${issuedDate}`,
      accent: certificates.length % 2 === 0 ? 'amber' : 'blue',
    });
  }

  return { badges, certificates };
}

/**
 * Build a safe view-ready user profile object with formatted skills, availability, badges, projects, and certificates.
 */
async function getProfile(userId, { includePrivate = false } = {}) {
  const user = await userModel.findProfileById(userId);
  if (!user || (!includePrivate && user.status === USER_STATUSES.SUSPENDED)) {
    throw new AppError('Profile not found.', 404);
  }

  const [reviewsSummary, allSessions] = await Promise.all([
    ratingService.getReceivedReviews(user.id),
    sessionModel.findByUserId(user.id),
  ]);

  const completedSessions = (allSessions || []).filter(
    (s) => s.status === SESSION_STATUSES.COMPLETED
  );

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

  const projectLinks = (user.projectLinks || []).map(formatProjectCard);
  const { badges, certificates } = buildProgressHighlights({
    userId: user.id,
    completedSessions,
    reviewsSummary,
    offerSkills,
    wantSkills,
  });

  return {
    id: user.id,
    name: user.name,
    ...(includePrivate ? { email: user.email, pointsBalance: user.pointsBalance } : {}),
    role: user.role,
    bio: user.bio || '',
    avatarPath: normalizeAvatarPath(user.avatarPath),
    status: user.status,
    createdAt: user.createdAt,
    projectLinks,
    offerSkills,
    wantSkills,
    availability,
    badges,
    certificates,
    ...reviewsSummary,
  };
}

/**
 * Update the authenticated user's profile fields, project links, and optional avatar in one transaction.
 */
async function updateProfile(userId, { name, bio, projectLinks }, uploadedFile = null) {
  const existing = await userModel.findById(userId);
  if (!existing) {
    if (uploadedFile?.path) {
      await storageService.safeUnlink(uploadedFile.path);
    }
    throw new AppError('User not found.', 404);
  }

  let newAvatarPath;
  if (uploadedFile?.path) {
    newAvatarPath = await storageService.processAndSaveAvatar(uploadedFile.path);
  }

  let updated;
  try {
    updated = await userModel.updateProfileAndLinks(userId, {
      name: name.trim(),
      bio,
      projectLinks,
      ...(newAvatarPath ? { avatarPath: newAvatarPath } : {}),
    });
  } catch (err) {
    if (newAvatarPath) {
      await storageService.deleteStoredFile(newAvatarPath);
    }
    throw err;
  }

  if (newAvatarPath && existing.avatarPath && existing.avatarPath !== newAvatarPath) {
    await storageService.deleteStoredFile(existing.avatarPath);
  }

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    status: updated.status,
    pointsBalance: updated.pointsBalance,
    avatarPath: normalizeAvatarPath(updated.avatarPath),
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
