const express = require('express');
const { z } = require('zod');
const pageController = require('../controllers/pageController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { USER_ROLES } = require('../config/constants');

const router = express.Router();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid ID.'),
});

const userIdParamSchema = z.object({
  userId: z.coerce.number().int().positive('Invalid user ID.'),
});

router.get('/', pageController.home);
router.get('/welcome', requireAuth, pageController.welcomePoints);
router.get('/suggestions', requireAuth, pageController.suggestions);
router.get('/requests', requireAuth, pageController.requests);
router.get('/sessions', requireAuth, pageController.sessions);
router.get(
  '/sessions/:id/review',
  requireAuth,
  validate(idParamSchema, { source: 'params' }),
  pageController.reviewForm
);
router.get('/messages', requireAuth, pageController.messages);
router.get(
  '/messages/:userId',
  requireAuth,
  validate(userIdParamSchema, { source: 'params' }),
  pageController.chat
);
router.get('/points', requireAuth, pageController.points);
router.get('/reports', requireAuth, pageController.reports);

router.get('/admin/users', requireAuth, requireRole(USER_ROLES.ADMIN), pageController.adminUsers);
router.get('/admin/skills', requireAuth, requireRole(USER_ROLES.ADMIN), pageController.adminSkills);
router.get(
  '/admin/reports',
  requireAuth,
  requireRole(USER_ROLES.ADMIN),
  pageController.adminReports
);

module.exports = router;
