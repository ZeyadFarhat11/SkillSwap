const profileService = require('../services/profileService');
const AppError = require('../utils/AppError');

async function showOwnProfile(req, res, next) {
  try {
    const profile = await profileService.getProfile(req.session.user.id, {
      includePrivate: true,
    });
    return res.render('pages/profile', {
      title: 'My Profile',
      profile,
      isOwnProfile: true,
    });
  } catch (err) {
    return next(err);
  }
}

async function showUserProfile(req, res, next) {
  try {
    const targetId = req.validated.params.id;
    const isOwnProfile = targetId === req.session.user.id;
    const profile = await profileService.getProfile(targetId, {
      includePrivate: isOwnProfile,
    });
    return res.render('pages/profile', {
      title: profile.name,
      profile,
      isOwnProfile,
    });
  } catch (err) {
    return next(err);
  }
}

async function showEditProfile(req, res, next) {
  try {
    const profile = await profileService.getProfile(req.session.user.id, {
      includePrivate: true,
    });
    return res.render('pages/profileEdit', {
      title: 'Edit Profile',
      profile,
      errors: {},
      formData: {
        name: profile.name,
        bio: profile.bio,
        projectLinks: profile.projectLinks.map((l) => l.url),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function renderEditProfileError(req, res, next, statusCode, message, fieldErrors = {}) {
  try {
    const profile = await profileService.getProfile(req.session.user.id, {
      includePrivate: true,
    });
    const rawLinks = req.body?.projectLinks;
    const projectLinks = Array.isArray(rawLinks)
      ? rawLinks.map(String)
      : typeof rawLinks === 'string'
        ? rawLinks.split(/[\r\n]+/).map((s) => s.trim())
        : profile.projectLinks.map((l) => l.url);

    return res.status(statusCode).render('pages/profileEdit', {
      title: 'Edit Profile',
      profile,
      errors: fieldErrors,
      formData: {
        name: typeof req.body?.name === 'string' ? req.body.name : profile.name,
        bio: typeof req.body?.bio === 'string' ? req.body.bio : profile.bio,
        projectLinks,
      },
      flash: {
        error: [message],
        success: [],
        info: [],
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const updatedUser = await profileService.updateProfile(
      req.session.user.id,
      req.validatedBody
    );
    req.session.user = {
      ...req.session.user,
      name: updatedUser.name,
    };
    req.flash('success', 'Profile updated successfully.');
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/profile');
    });
  } catch (err) {
    if (err instanceof AppError) {
      return renderEditProfileError(req, res, next, err.statusCode, err.message, err.fieldErrors);
    }
    return next(err);
  }
}

async function uploadAvatar(req, res, next) {
  try {
    if (req.uploadError) {
      throw req.uploadError;
    }

    const newAvatarPath = await profileService.updateAvatar(req.session.user.id, req.file);
    req.session.user = {
      ...req.session.user,
      avatarPath: newAvatarPath,
    };
    req.flash('success', 'Profile photo updated.');
    return req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/profile/edit');
    });
  } catch (err) {
    if (err instanceof AppError) {
      return renderEditProfileError(req, res, next, err.statusCode, err.message);
    }
    return next(err);
  }
}

module.exports = {
  showOwnProfile,
  showUserProfile,
  showEditProfile,
  renderEditProfileError,
  updateProfile,
  uploadAvatar,
};
