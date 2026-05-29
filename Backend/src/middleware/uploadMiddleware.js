import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { config } from '../config/environment.js';

const avatarDirectory = path.join(config.paths.uploads, 'avatars');
fs.mkdirSync(avatarDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDirectory),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const sanitizedBase = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 40);

    cb(null, `${Date.now()}-${sanitizedBase || 'avatar'}${extension}`);
  },
});

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/jpg', 'image/webp']);

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

export default avatarUpload;
