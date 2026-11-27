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
  authController.ensureRegistrationsAllowed,
  validate(registerSchema, authController.REGISTER_VIEW_OPTIONS),
  authController.register
);

router.get('/verify-email', authController.showVerifyEmail);
router.post('/verify-email', authController.verifyEmail);

router.get('/login', authController.showLogin);
router.post(
  '/login',
  loginLimiter,
  validate(loginSchema, authController.LOGIN_VIEW_OPTIONS),
  authController.login
);

router.post('/logout', authController.logout);

module.exports = router;
