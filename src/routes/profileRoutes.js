const express = require('express');
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { uploadAvatarMiddleware, verifyMultipartCsrf } = require('../middlewares/upload');
const { profileEditSchema, userIdParamSchema } = require('../validators/profileValidator');

const router = express.Router();

router.get('/profile', requireAuth, profileController.showOwnProfile);

router.get('/profile/edit', requireAuth, profileController.showEditProfile);
router.post(
  '/profile/edit',
  requireAuth,
  validate(profileEditSchema, {
    onError: (req, res, next, { firstMessage, fieldErrors }) =>
      profileController.renderEditProfileError(req, res, next, 400, firstMessage, fieldErrors),
  }),
  profileController.updateProfile
);

router.post(
  '/profile/avatar',
  requireAuth,
  uploadAvatarMiddleware,
  verifyMultipartCsrf,
  profileController.uploadAvatar
);

router.get(
  '/users/:id',
  requireAuth,
  validate(userIdParamSchema, { source: 'params' }),
  profileController.showUserProfile
);

module.exports = router;
