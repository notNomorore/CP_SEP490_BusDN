import crypto from 'crypto';
import path from 'path';

import { CustomError } from '../../middleware/errorHandler.js';
import { HTTP_STATUS } from '../../constants/index.js';
import { config } from '../../config/environment.js';
import logger from '../../utils/logger.js';
import CloudinaryStorage from './cloudinary.storage.js';

const PROVIDER = 'cloudinary';

const folderBySupportType = {
  COMPLAINT: 'busdn/complaints',
  LOST_ITEM: 'busdn/lost-items',
  SERVICE_FEEDBACK: 'busdn/feedback',
};

const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const buildPublicId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomUUID()}`;

const getOriginalName = (file = {}) => file.originalname || file.name || '';

const getExtension = (file = {}) => path.extname(getOriginalName(file)).toLowerCase();

const getCloudinaryError = (error) => error?.error || error;

const normalizeUploadResult = (file, result) => ({
  provider: PROVIDER,
  publicId: result.public_id,
  url: result.secure_url || result.url,
  secureUrl: result.secure_url || result.url,
  resourceType: result.resource_type || 'image',
  originalName: getOriginalName(file),
  fileName: `${path.basename(result.public_id)}${getExtension(file)}`,
  filename: `${path.basename(result.public_id)}${getExtension(file)}`,
  mimeType: file.mimetype || file.type || result.resource_type || '',
  size: file.size || result.bytes || 0,
  uploadedAt: new Date(),
});

export class StorageService {
  static async upload(file, options = {}) {
    if (!file?.buffer) {
      throw new CustomError('Upload file buffer is required', HTTP_STATUS.BAD_REQUEST);
    }

    try {
      const result = await CloudinaryStorage.uploadBuffer(file, {
        folder: options.folder,
        publicId: options.publicId || buildPublicId(options.prefix || 'asset'),
        resourceType: options.resourceType || 'auto',
      });

      return normalizeUploadResult(file, result);
    } catch (error) {
      const cloudinaryError = getCloudinaryError(error);

      logger.error('Cloudinary upload failed', {
        message: cloudinaryError?.message || error.message,
        httpCode: cloudinaryError?.http_code || error.http_code,
        name: error.name,
        folder: options.folder,
      });
      throw new CustomError('File upload failed', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }
  }

  static uploadAvatar(file, metadata = {}) {
    return this.upload(file, {
      folder: 'busdn/avatars',
      prefix: `avatar-${metadata.userId || 'user'}`,
      resourceType: 'image',
    });
  }

  static uploadSupportAttachment(file, metadata = {}) {
    return this.upload(file, {
      folder: folderBySupportType[metadata.type] || 'busdn/feedback',
      prefix: `support-${metadata.userId || 'passenger'}`,
      resourceType: 'auto',
    });
  }

  static uploadPriorityDocument(file, metadata = {}) {
    return this.upload(file, {
      folder: 'busdn/priority-profiles',
      prefix: `priority-${metadata.userId || 'passenger'}-${metadata.documentType || 'document'}`,
      resourceType: 'auto',
    });
  }

  static uploadOperationEvidence(file, metadata = {}) {
    return this.upload(file, {
      folder: 'busdn/operation-incidents',
      prefix: `operation-${metadata.userId || 'staff'}-${metadata.assignmentId || 'incident'}`,
      resourceType: 'image',
    });
  }

  static resolvePublicUrl(value) {
    if (!value) return value;

    const normalized = String(value).trim();
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (!normalized.startsWith('/uploads/')) return normalized;

    const backendPublicUrl = trimTrailingSlash(config.publicUrl);
    if (!backendPublicUrl) return normalized;

    return `${backendPublicUrl}${normalized}`;
  }

  static async delete(publicId, options = {}) {
    if (!publicId) return null;

    try {
      return await CloudinaryStorage.delete(publicId, options);
    } catch (error) {
      logger.error('Cloudinary cleanup failed', {
        message: error.message,
        publicId,
      });
      return null;
    }
  }

  static async cleanupUploads(uploads = []) {
    await Promise.all(
      uploads
        .filter((upload) => upload?.provider === PROVIDER && upload.publicId)
        .map((upload) => this.delete(upload.publicId, { resourceType: upload.resourceType }))
    );
  }
}

export default StorageService;
