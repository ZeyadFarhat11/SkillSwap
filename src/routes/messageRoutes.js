const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { messagesLimiter } = require('../middlewares/rateLimiter');
const messageController = require('../controllers/messageController');
const { sendMessageSchema, userIdParamSchema } = require('../validators/messageValidator');

const router = express.Router();

router.get('/messages', requireAuth, messageController.listMessages);

router.get(
  '/messages/:userId',
  requireAuth,
  validate(userIdParamSchema, { source: 'params' }),
  messageController.showChat
);

router.post(
  '/messages',
  requireAuth,
  messagesLimiter,
  validate(sendMessageSchema, {
    source: 'body',
    onError: (req, res, next, { firstMessage }) =>
      messageController.renderChatError(req, res, next, {
        statusCode: 400,
        firstMessage,
      }),
  }),
  messageController.sendMessage
);

module.exports = router;
