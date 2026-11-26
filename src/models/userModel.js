const prisma = require('./prisma');
const { POINTS_TYPES, SKILL_STATUSES, USER_ROLES, USER_STATUSES } = require('../config/constants');

/**
 * Find a user record by unique email address.
 */
async function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

/**
 * Find a user record by primary key ID.
 */
async function findById(id) {
  return prisma.user.findUnique({ where: { id } });
}

/**
 * Find a user profile with project links, approved user skills, and availability.
 */
async function findProfileById(id) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      projectLinks: { orderBy: { id: 'asc' } },
      userSkills: {
        where: { skill: { status: SKILL_STATUSES.APPROVED } },
        include: { skill: true },
        orderBy: { id: 'asc' },
      },
      availability: {
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
    },
  });
}

/**
 * Update user profile fields and replace project links atomically in one transaction.
 */
async function updateProfileAndLinks(userId, { name, bio, projectLinks }) {
  return prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { name, bio },
    });

    await tx.userProjectLink.deleteMany({ where: { userId } });

    if (projectLinks.length > 0) {
      await tx.userProjectLink.createMany({
        data: projectLinks.map((url) => ({ userId, url })),
      });
    }

    return updatedUser;
  });
}

/**
 * Update a user's relative avatar path.
 */
async function updateAvatarPath(userId, avatarPath) {
  return prisma.user.update({
    where: { id: userId },
    data: { avatarPath },
  });
}

/**
 * Create a new user and grant starter bonus points atomically in one transaction.
 */
async function createUserWithStarterPoints({ name, email, passwordHash, starterPoints }) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: USER_ROLES.USER,
        status: USER_STATUSES.ACTIVE,
        pointsBalance: starterPoints,
      },
    });

    if (starterPoints > 0) {
      await tx.pointsTransaction.create({
        data: {
          userId: user.id,
          type: POINTS_TYPES.BONUS,
          amount: starterPoints,
        },
      });
    }

    return user;
  });
}

module.exports = {
  findByEmail,
  findById,
  findProfileById,
  updateProfileAndLinks,
  updateAvatarPath,
  createUserWithStarterPoints,
};
