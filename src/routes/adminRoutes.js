const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const adminController = require('../controllers/adminController');
const {
  idParamSchema,
  updateReportStatusSchema,
  adjustPointsSchema,
  createSkillSchema,
  generalSettingsSchema,
  preferencesSettingsSchema,
  usersQuerySchema,
  skillsQuerySchema,
  sessionsQuerySchema,
  reportsQuerySchema,
} = require('../validators/adminValidator');
const { USER_ROLES } = require('../config/constants');

const router = express.Router();

router.use('/admin', requireAuth, requireRole(USER_ROLES.ADMIN));

router.get(
  '/admin/users',
  validate(usersQuerySchema, { source: 'query' }),
  adminController.listUsers
);
router.post(
  '/admin/users/:id/suspend',
  validate(idParamSchema, { source: 'params' }),
  adminController.suspendUser
);
router.post(
  '/admin/users/:id/reactivate',
  validate(idParamSchema, { source: 'params' }),
  adminController.reactivateUser
);
router.post(
  '/admin/users/:id/points-adjustment',
  validate(idParamSchema, { source: 'params' }),
  validate(adjustPointsSchema, {
    source: 'body',
    onError: (req, res, next, { firstMessage }) =>
      adminController.renderUsersPage(req, res, next, {
        statusCode: 400,
        errorMessage: firstMessage,
      }),
  }),
  adminController.adjustUserPoints
);

router.get(
  '/admin/skills',
  validate(skillsQuerySchema, { source: 'query' }),
  adminController.listSkills
);
router.post(
  '/admin/skills',
  validate(createSkillSchema, {
    source: 'body',
    onError: (req, res, next, { firstMessage }) =>
      adminController.renderSkillsPage(req, res, next, {
        statusCode: 400,
        errorMessage: firstMessage,
      }),
  }),
  adminController.createSkill
);
router.post(
  '/admin/skills/:id/approve',
  validate(idParamSchema, { source: 'params' }),
  adminController.approveSkill
);
router.post(
  '/admin/skills/:id/reject',
  validate(idParamSchema, { source: 'params' }),
  adminController.rejectSkill
);
router.post(
  '/admin/skills/:id/delete',
  validate(idParamSchema, { source: 'params' }),
  adminController.removeSkill
);

router.get(
  '/admin/sessions',
  validate(sessionsQuerySchema, { source: 'query' }),
  adminController.listSessions
);

router.get('/admin/settings', adminController.getSettingsPage);
router.post(
  '/admin/settings/general',
  validate(generalSettingsSchema, {
    source: 'body',
    onError: (req, res, next, { firstMessage }) =>
      adminController.renderSettingsPage(req, res, next, {
        statusCode: 400,
        errorMessage: firstMessage,
        formOverrides: {
          platformName:
            typeof req.body?.platformName === 'string' ? req.body.platformName : undefined,
          platformEmail:
            typeof req.body?.platformEmail === 'string' ? req.body.platformEmail : undefined,
          platformDescription:
            typeof req.body?.platformDescription === 'string'
              ? req.body.platformDescription
              : undefined,
        },
      }),
  }),
  adminController.updateGeneralSettings
);
router.post(
  '/admin/settings/preferences',
  validate(preferencesSettingsSchema, {
    source: 'body',
    onError: (req, res, next, { firstMessage }) =>
      adminController.renderSettingsPage(req, res, next, {
        statusCode: 400,
        errorMessage: firstMessage,
      }),
  }),
  adminController.updatePreferenceSettings
);

router.get(
  '/admin/reports',
  validate(reportsQuerySchema, { source: 'query' }),
  adminController.listReports
);
router.post(
  '/admin/reports/:id/status',
  validate(idParamSchema, { source: 'params' }),
  validate(updateReportStatusSchema, {
    source: 'body',
    onError: (req, res, next, { firstMessage }) =>
      adminController.renderReportsPage(req, res, next, {
        statusCode: 400,
        errorMessage: firstMessage,
      }),
  }),
  adminController.updateReportStatus
);

module.exports = router;
