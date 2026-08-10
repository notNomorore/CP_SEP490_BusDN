import multer from 'multer';
import { config } from '../../config/environment.js';

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const fileFilter = (_req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    cb(new Error('Only JPG, PNG, WEBP, and PDF files are allowed'));
    return;
  }

  cb(null, true);
};

export const uploadPriorityDocuments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize,
    files: 20,
  },
}).array('documents', 20);
