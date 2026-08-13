import multer from 'multer';
import { config } from '../config/environment.js';

const storage = multer.memoryStorage();
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/heic', 'image/heif']);
const feedbackMimeTypes = new Set([
  ...imageMimeTypes,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const avatarUpload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxSize,
  },
  fileFilter: (req, file, cb) => {
    if (!imageMimeTypes.has(file.mimetype)) {
      const error = new Error('Only JPG, JPEG, PNG, WEBP, HEIC, and HEIF avatar images are allowed');
      error.statusCode = 400;
      return cb(error);
    }

    return cb(null, true);
  },
});

export const feedbackUpload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxSize,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (!feedbackMimeTypes.has(file.mimetype)) {
      const error = new Error('Only JPG, JPEG, PNG, WEBP, HEIC, HEIF, PDF, DOC, and DOCX attachments are allowed');
      error.statusCode = 400;
      return cb(error);
    }

    return cb(null, true);
  },
});

export default avatarUpload;
