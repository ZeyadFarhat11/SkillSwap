const express = require('express');
const pageController = require('../controllers/pageController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/', pageController.home);
router.get('/welcome', requireAuth, pageController.welcomePoints);
router.get('/suggestions', requireAuth, pageController.suggestions);
// /requests, /sessions -> requestRoutes.js, sessionRoutes.js (Phase 5)
// /messages, /points, /reports, /notifications -> Phase 6 / 6.3 route files
// /admin/* -> adminRoutes.js (Phase 8)

module.exports = router;
