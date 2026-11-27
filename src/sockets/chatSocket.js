const { Server } = require('socket.io');
const userModel = require('../models/userModel');
const messageService = require('../services/messageService');
const { sendMessageSchema } = require('../validators/messageValidator');
const { addUserSocket, removeUserSocket } = require('./presence');
const AppError = require('../utils/AppError');
const { USER_STATUSES } = require('../config/constants');

const DEFAULT_RATE_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RATE_MAX = 30;

/**
 * Create an in-memory per-user sliding-window rate limiter for Socket.IO messages.
 */
function createSocketRateLimiter({ windowMs = DEFAULT_RATE_WINDOW_MS, limit = DEFAULT_RATE_MAX } = {}) {
  const hitsByUser = new Map();

  return function checkLimit(userId) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (hitsByUser.get(userId) || []).filter((ts) => ts > cutoff);
    if (timestamps.length >= limit) {
      hitsByUser.set(userId, timestamps);
      return false;
    }
    timestamps.push(now);
    hitsByUser.set(userId, timestamps);
    return true;
  };
}

/**
 * Build a standardized chat message payload for clients.
 */
function formatSocketMessage(saved, senderName) {
  return {
    id: saved.id,
    senderId: saved.senderId,
    receiverId: saved.receiverId,
    senderName: senderName || 'User',
    content: saved.content,
    sentAt: saved.sentAt instanceof Date ? saved.sentAt.toISOString() : saved.sentAt,
  };
}

/**
 * Emit a saved message (from WebSocket or HTTP POST fallback) to both participants' rooms.
 */
function emitMessageToParticipants(io, saved, { senderName, receiverName } = {}) {
  if (!io || !saved) return;
  const payload = formatSocketMessage(saved, senderName);
  io.to(`user:${saved.senderId}`).to(`user:${saved.receiverId}`).emit('chat:message', payload);

  io.to(`user:${saved.senderId}`).emit('chat:inbox_update', {
    peerId: saved.receiverId,
    peerName: receiverName || null,
    lastMessage: saved.content,
    sentAt: payload.sentAt,
  });
  io.to(`user:${saved.receiverId}`).emit('chat:inbox_update', {
    peerId: saved.senderId,
    peerName: senderName || null,
    lastMessage: saved.content,
    sentAt: payload.sentAt,
  });
}

/**
 * Attach Socket.IO live chat & presence handlers onto an HTTP server, sharing Express session auth.
 */
function attachChatSocket(httpServer, sessionMiddleware, options = {}) {
  const io = new Server(httpServer);
  const allowMessage = createSocketRateLimiter({
    windowMs: options.rateLimitWindowMs,
    limit: options.rateLimitMax,
  });

  if (sessionMiddleware) {
    io.engine.use(sessionMiddleware);
  }

  io.use(async (socket, next) => {
    try {
      const sessionUser = socket.request?.session?.user;
      if (!sessionUser || !sessionUser.id) {
        return next(new Error('Unauthorized'));
      }

      const dbUser = await userModel.findById(sessionUser.id);
      if (!dbUser || dbUser.status !== USER_STATUSES.ACTIVE) {
        return next(new Error('Unauthorized'));
      }

      socket.data.userId = dbUser.id;
      socket.data.userName = dbUser.name;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, userName } = socket.data;
    socket.join(`user:${userId}`);

    const cameOnline = addUserSocket(userId, socket.id);
    if (cameOnline) {
      socket.broadcast.emit('presence:update', { userId, online: true });
    }

    socket.on('chat:send', async (rawPayload, ack) => {
      const respond = typeof ack === 'function' ? ack : () => {};

      const parsed = sendMessageSchema.safeParse(rawPayload || {});
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message || 'Please check your message.';
        return respond({ ok: false, statusCode: 400, error: message });
      }

      if (!allowMessage(userId)) {
        return respond({
          ok: false,
          statusCode: 429,
          error: 'Too many messages sent. Please wait a few minutes and try again.',
        });
      }

      try {
        const saved = await messageService.sendMessage(userId, parsed.data);
        const receiver = await userModel.findById(parsed.data.receiverId);
        emitMessageToParticipants(io, saved, {
          senderName: userName,
          receiverName: receiver ? receiver.name : null,
        });
        return respond({
          ok: true,
          message: formatSocketMessage(saved, userName),
        });
      } catch (err) {
        const statusCode = err instanceof AppError ? err.statusCode : 500;
        const message =
          err instanceof AppError ? err.message : 'Unable to send message right now.';
        return respond({ ok: false, statusCode, error: message });
      }
    });

    socket.on('disconnect', () => {
      const wentOffline = removeUserSocket(userId, socket.id);
      if (wentOffline) {
        socket.broadcast.emit('presence:update', { userId, online: false });
      }
    });
  });

  return io;
}

module.exports = {
  attachChatSocket,
  emitMessageToParticipants,
  createSocketRateLimiter,
};
