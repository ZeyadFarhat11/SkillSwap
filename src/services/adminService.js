const userModel = require('../models/userModel');
const skillModel = require('../models/skillModel');
const sessionModel = require('../models/sessionModel');
const reportModel = require('../models/reportModel');
const AppError = require('../utils/AppError');
const {
  REPORT_STATUSES,
  SESSION_STATUSES,
  SKILL_STATUSES,
  USER_ROLES,
  USER_STATUSES,
} = require('../config/constants');

/**
 * Load all users, metrics (users, total points, active/suspended counts), and optional search filter.
 */
async function getUsersPageData({ q = '', status = '' } = {}) {
  const allUsers = await userModel.listAllUsersForAdmin();
  const activeUsers = allUsers.filter((u) => u.status === USER_STATUSES.ACTIVE).length;
  const suspendedUsers = allUsers.filter((u) => u.status === USER_STATUSES.SUSPENDED).length;
  const totalPoints = allUsers.reduce((sum, u) => sum + (Number(u.pointsBalance) || 0), 0);

  const normalizedQuery = q.trim().toLowerCase();
  const users = allUsers.filter((u) => {
    if (status && u.status !== status) return false;
    if (normalizedQuery) {
      const hay = `${u.id} ${u.name} ${u.email} ${u.role} ${u.status}`.toLowerCase();
      if (!hay.includes(normalizedQuery)) return false;
    }
    return true;
  });

  return {
    summary: {
      totalUsers: allUsers.length,
      activeUsers,
      suspendedUsers,
      totalPoints,
    },
    users,
    filters: { q, status },
  };
}

/**
 * Suspend a non-admin active user (admins cannot suspend themselves or other admins).
 */
async function suspendUser(adminId, targetUserId) {
  if (adminId === targetUserId) {
    throw new AppError('You cannot suspend your own account.', 400);
  }

  const target = await userModel.findById(targetUserId);
  if (!target) {
    throw new AppError('User not found.', 404);
  }
  if (target.role === USER_ROLES.ADMIN) {
    throw new AppError('Administrator accounts cannot be suspended.', 400);
  }
  if (target.status === USER_STATUSES.SUSPENDED) {
    throw new AppError('User is already suspended.', 400);
  }

  return userModel.updateUserStatus(targetUserId, USER_STATUSES.SUSPENDED);
}

/**
 * Reactivate a suspended user account.
 */
async function reactivateUser(targetUserId) {
  const target = await userModel.findById(targetUserId);
  if (!target) {
    throw new AppError('User not found.', 404);
  }
  if (target.status === USER_STATUSES.ACTIVE) {
    throw new AppError('User is already active.', 400);
  }

  return userModel.updateUserStatus(targetUserId, USER_STATUSES.ACTIVE);
}

/**
 * Adjust a user's points balance inside a row-locked DB transaction.
 * Signed integer amount; only adjustment may be negative; balance never drops below 0.
 */
async function adjustUserPoints(targetUserId, amount) {
  return userModel.adjustUserPointsTx(targetUserId, amount);
}

/**
 * Load all skills and moderation summary counts for the admin Skill Management view.
 */
async function getSkillsPageData({ q = '', status = '' } = {}) {
  const allSkills = await skillModel.listAllSkillsForAdmin();
  const pending = allSkills.filter((s) => s.status === SKILL_STATUSES.PENDING).length;
  const approved = allSkills.filter((s) => s.status === SKILL_STATUSES.APPROVED).length;
  const rejected = allSkills.filter((s) => s.status === SKILL_STATUSES.REJECTED).length;

  const normalizedQuery = q.trim().toLowerCase();
  const skills = allSkills.filter((skill) => {
    if (status && skill.status !== status) return false;
    if (normalizedQuery && !skill.skillName.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });

  return {
    summary: {
      total: allSkills.length,
      pending,
      approved,
      rejected,
    },
    skills,
    filters: { q, status },
  };
}

/**
 * Create a new approved skill on behalf of the admin, preventing duplicates.
 */
async function createSkill(rawSkillName) {
  const skillName = rawSkillName.trim();
  const allSkills = await skillModel.listAllSkillsForAdmin();
  const duplicate = allSkills.some(
    (skill) => skill.skillName.trim().toLowerCase() === skillName.toLowerCase()
  );
  if (duplicate) {
    throw new AppError('A skill with this name already exists.', 400);
  }

  try {
    return await skillModel.createApprovedSkill(skillName);
  } catch (err) {
    if (err && err.code === 'P2002') {
      throw new AppError('A skill with this name already exists.', 400);
    }
    throw err;
  }
}

/**
 * Delete a skill record if it is not referenced by swap requests or sessions.
 */
async function removeSkill(skillId) {
  const existing = await skillModel.findSkillById(skillId);
  if (!existing) {
    throw new AppError('Skill not found.', 404);
  }

  const refCount = await skillModel.countSkillReferences(skillId);
  if (refCount > 0) {
    throw new AppError(
      'Cannot remove a skill that is currently used in swap requests or sessions.',
      400
    );
  }

  try {
    return await skillModel.deleteSkillById(skillId);
  } catch (err) {
    if (err && err.code === 'P2003') {
      throw new AppError(
        'Cannot remove a skill that is currently used in swap requests or sessions.',
        400
      );
    }
    throw err;
  }
}

/**
 * Approve or reject a pending skill.
 */
async function moderatePendingSkill(skillId, nextStatus) {
  const skill = await skillModel.findSkillById(skillId);
  if (!skill) {
    throw new AppError('Skill not found.', 404);
  }
  if (skill.status !== SKILL_STATUSES.PENDING) {
    throw new AppError('Only pending skills can be moderated.', 400);
  }

  return skillModel.updateSkillStatus(skillId, nextStatus);
}

async function approveSkill(skillId) {
  return moderatePendingSkill(skillId, SKILL_STATUSES.APPROVED);
}

async function rejectSkill(skillId) {
  return moderatePendingSkill(skillId, SKILL_STATUSES.REJECTED);
}

function formatSessionDateParts(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return { dateLabel: 'TBD', timeLabel: '—' };
  }
  return {
    dateLabel: date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    timeLabel: date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }),
  };
}

/**
 * Load all sessions and summary counts for the admin Session Management view (read-only list).
 */
async function getSessionsPageData({ q = '', status = '' } = {}) {
  const allRaw = await sessionModel.listAllSessionsForAdmin();

  const summary = {
    total: allRaw.length,
    completed: allRaw.filter((s) => s.status === SESSION_STATUSES.COMPLETED).length,
    scheduled: allRaw.filter((s) => s.status === SESSION_STATUSES.SCHEDULED).length,
    cancelled: allRaw.filter((s) => s.status === SESSION_STATUSES.CANCELLED).length,
  };

  const normalizedQuery = q.trim().toLowerCase();
  const mapped = allRaw.map((session) => {
    const { dateLabel, timeLabel } = formatSessionDateParts(session.dateTime);
    const isMutual = Boolean(session.swapRequest?.offeredSkillId);
    return {
      id: session.id,
      skillName: session.skill?.skillName || 'Skill Session',
      swapType: isMutual ? 'Mutual Swap' : 'One-Way Swap',
      learnerName: session.learner?.name || 'Unknown Learner',
      instructorName: session.instructor?.name || 'Unknown Instructor',
      dateLabel,
      timeLabel,
      status: session.status,
    };
  });

  const sessions = mapped.filter((session) => {
    if (status && session.status !== status) return false;
    if (normalizedQuery) {
      const hay = `${session.skillName} ${session.learnerName} ${session.instructorName}`.toLowerCase();
      if (!hay.includes(normalizedQuery)) return false;
    }
    return true;
  });

  return {
    summary,
    sessions,
    filters: { q, status },
  };
}

/**
 * Load all reports and summary counts for the admin Reports Management view.
 */
async function getReportsPageData({ q = '', status = '' } = {}) {
  const rawReports = await reportModel.listAllReportsForAdmin();

  const mapped = rawReports.map((r) => ({
    id: r.id,
    subject: r.subject,
    description: r.description,
    type: r.type,
    status: r.status,
    submitterName: r.submitter ? r.submitter.name : 'Unknown user',
    reportedUserName: r.reportedUser ? r.reportedUser.name : null,
  }));

  const normalizedQuery = q.trim().toLowerCase();
  const reports = mapped.filter((report) => {
    if (status && report.status !== status) return false;
    if (normalizedQuery) {
      const hay = `${report.subject} ${report.description} ${report.type} ${report.submitterName} ${report.reportedUserName || ''} ${report.status}`.toLowerCase();
      if (!hay.includes(normalizedQuery)) return false;
    }
    return true;
  });

  return {
    summary: {
      open: mapped.filter((r) => r.status === REPORT_STATUSES.OPEN).length,
      inReview: mapped.filter((r) => r.status === REPORT_STATUSES.IN_REVIEW).length,
      resolved: mapped.filter((r) => r.status === REPORT_STATUSES.RESOLVED).length,
    },
    reports,
    filters: { q, status },
  };
}

/**
 * Update the moderation status of an existing report.
 */
async function updateReportStatus(reportId, status) {
  const existing = await reportModel.findById(reportId);
  if (!existing) {
    throw new AppError('Report not found.', 404);
  }

  return reportModel.updateReportStatus(reportId, status);
}

module.exports = {
  getUsersPageData,
  suspendUser,
  reactivateUser,
  adjustUserPoints,
  getSkillsPageData,
  createSkill,
  removeSkill,
  approveSkill,
  rejectSkill,
  getSessionsPageData,
  getReportsPageData,
  updateReportStatus,
};
