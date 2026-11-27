const messageService = require('../services/messageService');
const AppError = require('../utils/AppError');

/**
 * GET /messages
 * List all conversations for the current user.
 */
async function listMessages(req, res, next) {
  try {
    const conversations = await messageService.listConversations(req.session.user.id);
    return res.render('pages/messages', {
      title: 'Messages',
      useSidebar: true,
      hideFooter: true,
      activeNav: 'messages',
      bodyClass: 'bg-[#F3F6FA] text-slate-800 min-h-screen antialiased',
      conversations,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Render the chat page, optionally with an error status and message.
 */
async function renderChatPage(req, res, next, { peerId, statusCode = 200, errorMessage = null } = {}) {
  try {
    const currentUserId = req.session.user.id;
    const { peer, chatMessages } = await messageService.getThread(currentUserId, peerId);
    const locals = {
      title: `Chat with ${peer.name}`,
      useSidebar: true,
      hideFooter: true,
      activeNav: 'messages',
      bodyClass: 'bg-[#f4f7fb] text-slate-800 font-sans antialiased min-h-screen',
      peer,
      chatMessages,
    };
    if (errorMessage) {
      locals.flash = { error: [errorMessage], success: [], info: [] };
    }
    return res.status(statusCode).render('pages/chat', locals);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /messages/:userId
 * Show the chat thread between the current user and the given peer.
 */
async function showChat(req, res, next) {
  return renderChatPage(req, res, next, { peerId: req.validated.params.userId });
}

/**
 * Re-render chat thread on validation failure if peerId is valid, otherwise pass to error handler.
 */
async function renderChatError(req, res, next, { statusCode = 400, firstMessage }) {
  const peerId = Number(req.body?.receiverId);
  if (!Number.isInteger(peerId) || peerId <= 0 || peerId === req.session.user.id) {
    return next(new AppError(firstMessage, statusCode));
  }
  return renderChatPage(req, res, next, {
    peerId,
    statusCode,
    errorMessage: firstMessage,
  });
}

/**
 * POST /messages
 * Send a new message; redirect back to the chat thread.
 */
async function sendMessage(req, res, next) {
  try {
    const senderId = req.session.user.id;
    const { receiverId, content } = req.validated.body;
    await messageService.sendMessage(senderId, { receiverId, content });
    return res.redirect(`/messages/${receiverId}`);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listMessages, showChat, renderChatError, sendMessage };
