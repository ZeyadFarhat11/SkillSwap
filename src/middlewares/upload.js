const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } = require('../config/constants');
const AppError = require('../utils/AppError');
const storageService = require('../services/storageService');
const { validateCsrfRequest, invalidCsrfTokenError } = require('./csrf');

const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdir(uploadDir, { recursive: true }, (err) => cb(err, uploadDir));
  },
  filename: (_req, _file, cb) => {
    cb(null, `tmp-${randomUUID()}`);
  },
});

const multerAvatar = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
}).single('avatar');

/**
 * Handle single avatar multipart upload, capturing upload size errors cleanly
 * and storing any file error on req.uploadError for the controller to render.
 */
function uploadAvatarMiddleware(req, res, next) {
  multerAvatar(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `Avatar image must be ${MAX_UPLOAD_MB} MB or smaller.`
          : 'Invalid file upload request.';
      req.uploadError = new AppError(message, 400);
      return next();
    }

    return next(err);
  });
}

/**
 * Validate CSRF token after multer parses multipart/form-data fields,
 * cleaning up any temporary uploaded file if CSRF fails.
 */
async function verifyMultipartCsrf(req, _res, next) {
  if (validateCsrfRequest(req)) {
    return next();
  }
  await storageService.safeUnlink(req.file?.path);
  return next(invalidCsrfTokenError);
}

module.exports = {
  uploadAvatarMiddleware,
  verifyMultipartCsrf,
};
