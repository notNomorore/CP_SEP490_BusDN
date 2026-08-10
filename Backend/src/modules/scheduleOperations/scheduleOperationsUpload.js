import multer from 'multer';
import { config } from '../../config/environment.js';

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
]);

const fileFilter = (_req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    cb(new Error('Only JPG, JPEG, PNG, and WEBP incident images are allowed'));
    return;
  }

  cb(null, true);
};

export const uploadIncidentEvidence = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize,
    files: 5,
  },
}).array('evidenceFiles', 5);
