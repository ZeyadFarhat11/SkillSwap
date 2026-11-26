const express = require('express');
const availabilityController = require('../controllers/availabilityController');
const { requireAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const {
  createAvailabilitySchema,
  availabilityIdParamSchema,
} = require('../validators/availabilityValidator');

const router = express.Router();

router.get('/availability', requireAuth, availabilityController.showAvailability);

router.post(
  '/availability',
  requireAuth,
  validate(createAvailabilitySchema, {
    onError: (req, res, next, { firstMessage, fieldErrors, formData }) =>
      availabilityController.renderAvailabilityPage(req, res, next, {
        statusCode: 400,
        errorMessage: firstMessage,
        fieldErrors,
        formData,
      }),
  }),
  availabilityController.addAvailability
);

router.post(
  '/availability/:id/delete',
  requireAuth,
  validate(availabilityIdParamSchema, { source: 'params' }),
  availabilityController.deleteAvailability
);

module.exports = router;
