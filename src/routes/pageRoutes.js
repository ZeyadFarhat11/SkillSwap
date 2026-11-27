const express = require('express');
const pageController = require('../controllers/pageController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { USER_ROLES } = require('../config/constants');

const router = express.Router();

router.get('/', pageController.home);
router.get('/welcome', requireAuth, pageController.welcomePoints);
router.get('/suggestions', requireAuth, pageController.suggestions);
// GET /requests, /sessions, /sessions/:id/review moved to requestRoutes.js and sessionRoutes.js (Phase 5)
// GET /messages, GET /messages/:userId, POST /messages → messageRoutes.js (Phase 6)
// GET /points                                           → pointsRoutes.js  (Phase 6)
// GET /reports, POST /reports                           → reportRoutes.js  (Phase 6)

router.get('/admin/users', requireAuth, requireRole(USER_ROLES.ADMIN), pageController.adminUsers);
router.get('/admin/skills', requireAuth, requireRole(USER_ROLES.ADMIN), pageController.adminSkills);
router.get(
  '/admin/reports',
  requireAuth,
  requireRole(USER_ROLES.ADMIN),
  pageController.adminReports
);

module.exports = router;
