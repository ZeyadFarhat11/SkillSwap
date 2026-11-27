const messageModel = require('../models/messageModel');
const userModel = require('../models/userModel');
const { isUserOnline } = require('../sockets/presence');
const AppError = require('../utils/AppError');
const { USER_STATUSES } = require('../config/constants');

/**
 * Format a relative time string for conversation previews.
 */
function formatRelativeTime(sentAt) {
  const msAgo = Math.max(0, Date.now() - new Date(sentAt).getTime());
  const minAgo = Math.floor(msAgo / 60000);
  if (minAgo < 1) return 'just now';
  if (minAgo < 60) return `${minAgo}m ago`;
  if (minAgo < 1440) return `${Math.floor(minAgo / 60)}h ago`;
  return `${Math.floor(minAgo / 1440)}d ago`;
}

/**
 * Send a message from senderId to receiverId.
 * Guards: sender !== receiver, receiver must exist and be active.
 */
async function sendMessage(senderId, { receiverId, content }) {
  if (senderId === receiverId) {
    throw new AppError('You cannot send a message to yourself.', 400);
  }

  const receiver = await userModel.findById(receiverId);
  if (!receiver || receiver.status !== USER_STATUSES.ACTIVE) {
    throw new AppError('Recipient not found.', 404);
  }

  return messageModel.create({
    senderId,
    receiverId,
    content: content.trim(),
    sentAt: new Date(),
  });
}

/**
 * List all conversation threads for a user (one entry per unique peer, most-recent message).
 */
async function listConversations(userId) {
  const convos = await messageModel.findConversations(userId);

  return convos.map(({ peer, msg }) => ({
    userId: peer.id,
    name: peer.name,
    lastMessage: msg.content,
    timeAgo: formatRelativeTime(msg.sentAt),
    online: isUserOnline(peer.id),
  }));
}

/**
 * Load a thread between the current user and an active peer.
 * Returns peer info + messages shaped for the chat view.
 */
async function getThread(currentUserId, peerId) {
  if (currentUserId === peerId) {
    throw new AppError('You cannot chat with yourself.', 400);
  }

  const peer = await userModel.findById(peerId);
  if (!peer || peer.status !== USER_STATUSES.ACTIVE) {
    throw new AppError('User not found.', 404);
  }

  const rawMessages = await messageModel.findThread(currentUserId, peerId);

  const chatMessages = rawMessages.map((msg) => ({
    isOwn: msg.senderId === currentUserId,
    content: msg.content,
  }));

  return {
    peer: { id: peer.id, name: peer.name, online: isUserOnline(peer.id) },
    chatMessages,
  };
}

module.exports = { sendMessage, listConversations, getThread };
