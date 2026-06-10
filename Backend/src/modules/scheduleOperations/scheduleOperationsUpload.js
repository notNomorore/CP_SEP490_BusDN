import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { config } from '../../config/environment.js';

const uploadRoot = path.join(config.paths.root, 'uploads', 'operation-incidents');

fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadRoot);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.userId || 'anonymous';
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${userId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

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
