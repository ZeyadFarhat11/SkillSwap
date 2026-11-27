const prisma = require('./prisma');

/**
 * Persist a new message row.
 */
async function create(data) {
  return prisma.message.create({ data });
}

/**
 * Return one conversation thread between two users, oldest first.
 */
async function findThread(userAId, userBId) {
  return prisma.message.findMany({
    where: {
      OR: [
        { senderId: userAId, receiverId: userBId },
        { senderId: userBId, receiverId: userAId },
      ],
    },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { sentAt: 'asc' },
  });
}

/**
 * Return the most recent message in every conversation the user has participated in.
 * We fetch all messages where the user is sender or receiver, then collapse to unique peers.
 */
async function findConversations(userId) {
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    include: {
      sender: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
    orderBy: { sentAt: 'desc' },
  });

  // Keep only the most-recent message per peer
  const seen = new Map();
  for (const msg of messages) {
    const peer = msg.senderId === userId ? msg.receiver : msg.sender;
    if (!seen.has(peer.id)) {
      seen.set(peer.id, { peer, msg });
    }
  }

  return [...seen.values()];
}

module.exports = { create, findThread, findConversations };
