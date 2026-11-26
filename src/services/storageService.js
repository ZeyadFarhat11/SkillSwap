const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const FileType = require('file-type');
const sharp = require('sharp');
const env = require('../config/env');
const { AVATAR_SIZE } = require('../config/constants');
const AppError = require('../utils/AppError');

const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Resolve and ensure the local uploads directory exists.
 */
async function ensureUploadDir() {
  const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  await fs.mkdir(uploadDir, { recursive: true });
  return uploadDir;
}

/**
 * Unlink a file if it exists, ignoring ENOENT errors.
 */
async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Verify a temporary uploaded image via magic bytes, resize to 400x400,
 * save under <uuid>.<ext>, and return its relative POSIX path.
 */
async function processAndSaveAvatar(tempFilePath) {
  if (!tempFilePath) {
    throw new AppError('Please select an image file to upload.', 400);
  }

  try {
    const detected = await FileType.fromFile(tempFilePath);
    const ext = detected ? ALLOWED_IMAGE_TYPES[detected.mime] : null;
    if (!ext) {
      throw new AppError('Only JPEG, PNG, and WebP images are allowed.', 400);
    }

    const uploadDir = await ensureUploadDir();
    const filename = `${randomUUID()}.${ext}`;
    const destPath = path.join(uploadDir, filename);

    await sharp(tempFilePath)
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
      .toFile(destPath);

    const normalizedDir = env.UPLOAD_DIR.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    return `${normalizedDir}/${filename}`;
  } finally {
    await safeUnlink(tempFilePath);
  }
}

/**
 * Delete a stored upload by relative path if it resolves inside UPLOAD_DIR.
 */
async function deleteStoredFile(relativePath) {
  if (!relativePath) return;
  const uploadDir = await ensureUploadDir();
  const fileName = path.basename(relativePath);
  const candidate = path.resolve(uploadDir, fileName);
  if (candidate.startsWith(uploadDir + path.sep)) {
    await safeUnlink(candidate);
  }
}

module.exports = {
  ALLOWED_IMAGE_TYPES,
  ensureUploadDir,
  safeUnlink,
  processAndSaveAvatar,
  deleteStoredFile,
};
