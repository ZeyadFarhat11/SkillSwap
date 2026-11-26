const express = require('express');
const sessionController = require('../controllers/sessionController');
const { requireAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { createSessionSchema, sessionIdParamSchema } = require('../validators/sessionValidator');

const router = express.Router();

router.get('/sessions', requireAuth, sessionController.listSessions);

router.post(
  '/sessions',
  requireAuth,
  validate(createSessionSchema, {
    onError: (req, res, next, { firstMessage, formData }) =>
      sessionController.renderSessionsPage(req, res, next, {
        statusCode: 400,
        errorMessage: firstMessage,
        formData,
      }),
  }),
  sessionController.createSession
);

router.post(
  '/sessions/:id/complete',
  requireAuth,
  validate(sessionIdParamSchema, { source: 'params' }),
  sessionController.completeSession
);

router.post(
  '/sessions/:id/cancel',
  requireAuth,
  validate(sessionIdParamSchema, { source: 'params' }),
  sessionController.cancelSession
);

router.get(
  '/sessions/:id/review',
  requireAuth,
  validate(sessionIdParamSchema, { source: 'params' }),
  sessionController.reviewForm
);

module.exports = router;
