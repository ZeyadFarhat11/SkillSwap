const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.get('/notifications', requireAuth, notificationController.showNotifications);
router.post('/notifications/clear', requireAuth, notificationController.clearNotifications);

module.exports = router;
