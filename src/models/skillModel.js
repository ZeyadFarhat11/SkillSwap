const prisma = require('./prisma');
const { SKILL_STATUSES } = require('../config/constants');

/**
 * List all approved skills ordered alphabetically.
 */
async function listApprovedSkills() {
  return prisma.skill.findMany({
    where: { status: SKILL_STATUSES.APPROVED },
    orderBy: { skillName: 'asc' },
  });
}

/**
 * Find a skill by ID.
 */
async function findSkillById(id) {
  return prisma.skill.findUnique({ where: { id } });
}

/**
 * List a user's approved user_skills entries with skill metadata.
 */
async function listUserSkills(userId) {
  return prisma.userSkill.findMany({
    where: {
      userId,
      skill: { status: SKILL_STATUSES.APPROVED },
    },
    include: { skill: true },
    orderBy: { id: 'asc' },
  });
}

/**
 * Find existing user_skills entries for a given user and skill.
 */
async function findUserSkillsForSkill(userId, skillId) {
  return prisma.userSkill.findMany({
    where: { userId, skillId },
  });
}

/**
 * Find a single user_skill record by primary key ID.
 */
async function findUserSkillById(id) {
  return prisma.userSkill.findUnique({ where: { id } });
}

/**
 * Create a user_skill entry.
 */
async function createUserSkill({ userId, skillId, type, level }) {
  return prisma.userSkill.create({
    data: { userId, skillId, type, level },
    include: { skill: true },
  });
}

/**
 * Delete a user_skill entry by ID.
 */
async function deleteUserSkill(id) {
  return prisma.userSkill.delete({ where: { id } });
}

module.exports = {
  listApprovedSkills,
  findSkillById,
  listUserSkills,
  findUserSkillsForSkill,
  findUserSkillById,
  createUserSkill,
  deleteUserSkill,
};
