const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const pointsController = require('../controllers/pointsController');

const router = express.Router();

router.get('/points', requireAuth, pointsController.showPoints);

module.exports = router;
