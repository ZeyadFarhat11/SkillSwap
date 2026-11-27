const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const reportController = require('../controllers/reportController');
const { submitReportSchema } = require('../validators/reportValidator');

const router = express.Router();

router.get('/reports', requireAuth, reportController.showReports);

router.post(
  '/reports',
  requireAuth,
  validate(submitReportSchema, {
    source: 'body',
    onError: (req, res, next, { firstMessage, fieldErrors, formData }) =>
      reportController.renderReportsPage(req, res, next, {
        statusCode: 400,
        errorMessage: firstMessage,
        fieldErrors,
        formData,
      }),
  }),
  reportController.submitReport
);

module.exports = router;
