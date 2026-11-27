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
 * Find an approved user_skill entry for a user, skill, and type (offer or want).
 */
async function findApprovedUserSkill(userId, skillId, type) {
  return prisma.userSkill.findFirst({
    where: {
      userId,
      skillId,
      type,
      skill: { status: SKILL_STATUSES.APPROVED },
    },
    include: { skill: true },
  });
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

/**
 * List all skills (pending first, then alphabetical) for admin moderation.
 */
async function listAllSkillsForAdmin() {
  return prisma.skill.findMany({
    orderBy: [{ status: 'asc' }, { skillName: 'asc' }],
  });
}

/**
 * Find a skill by exact unique skillName.
 */
async function findSkillByName(skillName) {
  return prisma.skill.findUnique({ where: { skillName } });
}

/**
 * Create a new approved skill created by an admin.
 */
async function createApprovedSkill(skillName) {
  return prisma.skill.create({
    data: {
      skillName,
      status: SKILL_STATUSES.APPROVED,
    },
  });
}

/**
 * Update a skill's moderation status (approved or rejected).
 */
async function updateSkillStatus(skillId, status) {
  return prisma.skill.update({
    where: { id: skillId },
    data: { status },
  });
}

/**
 * Count swap requests and sessions referencing a skill before deletion.
 */
async function countSkillReferences(skillId) {
  const [swapCount, sessionCount] = await Promise.all([
    typeof prisma.swapRequest?.count === 'function'
      ? prisma.swapRequest.count({
          where: { OR: [{ wantedSkillId: skillId }, { offeredSkillId: skillId }] },
        })
      : 0,
    typeof prisma.session?.count === 'function'
      ? prisma.session.count({ where: { skillId } })
      : 0,
  ]);
  return swapCount + sessionCount;
}

/**
 * Delete a skill record by ID (cascades user_skills entries).
 */
async function deleteSkillById(skillId) {
  return prisma.skill.delete({ where: { id: skillId } });
}

module.exports = {
  listApprovedSkills,
  listAllSkillsForAdmin,
  findSkillById,
  findSkillByName,
  createApprovedSkill,
  listUserSkills,
  findUserSkillsForSkill,
  findUserSkillById,
  findApprovedUserSkill,
  createUserSkill,
  updateSkillStatus,
  countSkillReferences,
  deleteSkillById,
  deleteUserSkill,
};
