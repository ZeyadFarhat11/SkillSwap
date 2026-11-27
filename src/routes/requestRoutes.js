const express = require('express');
const requestController = require('../controllers/requestController');
const { requireAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const {
  createRequestSchema,
  requestIdParamSchema,
  searchRequestQuerySchema,
} = require('../validators/requestValidator');

const router = express.Router();

router.get(
  '/requests',
  requireAuth,
  validate(searchRequestQuerySchema, { source: 'query' }),
  requestController.listRequests
);

router.post(
  '/requests',
  requireAuth,
  validate(createRequestSchema, {
    onError: (req, res, next, { firstMessage, formData }) =>
      requestController.renderRequestsPage(req, res, next, {
        statusCode: 400,
        errorMessage: firstMessage,
        formData,
      }),
  }),
  requestController.sendRequest
);

router.post(
  '/requests/:id/accept',
  requireAuth,
  validate(requestIdParamSchema, { source: 'params' }),
  requestController.acceptRequest
);

router.post(
  '/requests/:id/decline',
  requireAuth,
  validate(requestIdParamSchema, { source: 'params' }),
  requestController.declineRequest
);

router.post(
  '/requests/:id/cancel',
  requireAuth,
  validate(requestIdParamSchema, { source: 'params' }),
  requestController.cancelRequest
);

module.exports = router;
