import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { config } from '../config/environment.js';

const avatarDirectory = path.join(config.paths.uploads, 'avatars');
const feedbackDirectory = path.join(config.paths.uploads, 'feedback');
fs.mkdirSync(avatarDirectory, { recursive: true });
fs.mkdirSync(feedbackDirectory, { recursive: true });

const createStorage = (directory, fallbackName) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, directory),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const sanitizedBase = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 40);

    cb(null, `${Date.now()}-${sanitizedBase || fallbackName}${extension}`);
  },
});

const storage = createStorage(avatarDirectory, 'avatar');
const feedbackStorage = createStorage(feedbackDirectory, 'feedback');
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/jpg', 'image/webp']);
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
      const error = new Error('Only JPG, JPEG, PNG, and WEBP avatar images are allowed');
      error.statusCode = 400;
      return cb(error);
    }

    return cb(null, true);
  },
});

export const feedbackUpload = multer({
  storage: feedbackStorage,
  limits: {
    fileSize: config.upload.maxSize,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (!feedbackMimeTypes.has(file.mimetype)) {
      const error = new Error('Only JPG, JPEG, PNG, WEBP, PDF, DOC, and DOCX attachments are allowed');
      error.statusCode = 400;
      return cb(error);
    }

    return cb(null, true);
  },
});

export default avatarUpload;
