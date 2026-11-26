const express = require('express');
const authController = require('../controllers/authController');
const { validate } = require('../middlewares/validate');
const { registerSchema, loginSchema } = require('../validators/authValidator');
const { loginLimiter, registerLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.get('/register', authController.showRegister);
router.post(
  '/register',
  registerLimiter,
  validate(registerSchema, authController.REGISTER_VIEW_OPTIONS),
  authController.register
);

router.get('/login', authController.showLogin);
router.post(
  '/login',
  loginLimiter,
  validate(loginSchema, authController.LOGIN_VIEW_OPTIONS),
  authController.login
);

router.post('/logout', authController.logout);

module.exports = router;
