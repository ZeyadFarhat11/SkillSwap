const prisma = require('./prisma');

const SWAP_INCLUDE = {
  sender: true,
  receiver: true,
  wantedSkill: true,
  offeredSkill: true,
  sessions: {
    include: { instructor: true, learner: true, skill: true },
    orderBy: { id: 'asc' },
  },
};

async function create(data) {
  return prisma.swapRequest.create({ data, include: SWAP_INCLUDE });
}

async function findById(id) {
  return prisma.swapRequest.findUnique({ where: { id }, include: SWAP_INCLUDE });
}

/**
 * Check for a duplicate pending request with the same sender, receiver, and skills.
 */
async function findDuplicatePending(senderId, receiverId, wantedSkillId, offeredSkillId) {
  return prisma.swapRequest.findFirst({
    where: {
      senderId,
      receiverId,
      wantedSkillId,
      offeredSkillId: offeredSkillId || null,
      status: 'pending',
    },
  });
}

/**
 * List swap requests where the user is sender or receiver, most recent first.
 */
async function findByUserId(userId) {
  return prisma.swapRequest.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    include: SWAP_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

async function findAcceptedByUserId(userId) {
  return prisma.swapRequest.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
      status: 'accepted',
    },
    include: SWAP_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  });
}

async function countPendingForUser(userId) {
  return prisma.swapRequest.count({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
      status: 'pending',
    },
  });
}

async function updateStatus(id, status) {
  return prisma.swapRequest.update({
    where: { id },
    data: { status },
    include: SWAP_INCLUDE,
  });
}

module.exports = {
  create,
  findById,
  findDuplicatePending,
  findByUserId,
  findAcceptedByUserId,
  countPendingForUser,
  updateStatus,
};
