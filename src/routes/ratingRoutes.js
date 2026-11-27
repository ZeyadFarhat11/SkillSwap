const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const ratingController = require('../controllers/ratingController');
const { submitRatingSchema, sessionIdParamSchema } = require('../validators/ratingValidator');

const router = express.Router();

router.post(
  '/sessions/:id/rating',
  requireAuth,
  validate(sessionIdParamSchema, { source: 'params' }),
  validate(submitRatingSchema, { source: 'body' }),
  ratingController.submitRating
);

module.exports = router;
