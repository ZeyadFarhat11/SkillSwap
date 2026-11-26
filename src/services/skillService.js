const skillModel = require('../models/skillModel');
const AppError = require('../utils/AppError');
const { SKILL_STATUSES, SKILL_TYPES } = require('../config/constants');

/**
 * Load approved catalog skills and the user's current offer/want skills.
 */
async function getSkillsPageData(userId) {
  const [approvedSkills, userSkills] = await Promise.all([
    skillModel.listApprovedSkills(),
    skillModel.listUserSkills(userId),
  ]);

  const offerSkills = userSkills.filter((entry) => entry.type === SKILL_TYPES.OFFER);
  const wantSkills = userSkills.filter((entry) => entry.type === SKILL_TYPES.WANT);

  return {
    approvedSkills,
    offerSkills,
    wantSkills,
  };
}

/**
 * Add an approved skill to the user's offer or want list, preventing duplicates
 * and preventing the same skill from appearing as both offer and want.
 */
async function addUserSkill(userId, { skillId, type, level }) {
  const skill = await skillModel.findSkillById(skillId);
  if (!skill || skill.status !== SKILL_STATUSES.APPROVED) {
    throw new AppError('Only approved skills can be added to your profile.', 400);
  }

  const existingEntries = await skillModel.findUserSkillsForSkill(userId, skillId);
  const oppositeType = existingEntries.find((entry) => entry.type !== type);
  if (oppositeType) {
    throw new AppError('You cannot both offer and want the same skill.', 400);
  }

  const sameType = existingEntries.find((entry) => entry.type === type);
  if (sameType) {
    throw new AppError('You have already added this skill.', 409);
  }

  try {
    return await skillModel.createUserSkill({ userId, skillId, type, level });
  } catch (err) {
    if (err && err.code === 'P2002') {
      throw new AppError('You have already added this skill.', 409);
    }
    throw err;
  }
}

/**
 * Delete a user_skill entry owned by the authenticated user.
 */
async function removeUserSkill(userId, userSkillId) {
  const entry = await skillModel.findUserSkillById(userSkillId);
  if (!entry) {
    throw new AppError('Skill entry not found.', 404);
  }
  if (entry.userId !== userId) {
    throw new AppError('You do not have permission to remove this skill.', 403);
  }

  await skillModel.deleteUserSkill(userSkillId);
}

module.exports = {
  getSkillsPageData,
  addUserSkill,
  removeUserSkill,
};
