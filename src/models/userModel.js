const prisma = require('./prisma');
const { POINTS_TYPES, USER_ROLES, USER_STATUSES } = require('../config/constants');

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
  createUserWithStarterPoints,
};
