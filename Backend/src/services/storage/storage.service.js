import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { CustomError } from '../../middleware/errorHandler.js';
import { HTTP_STATUS } from '../../constants/index.js';
import { config } from '../../config/environment.js';
import logger from '../../utils/logger.js';

const PROVIDER = 'cloudinary';
const LOCAL_PROVIDER = 'local';

const folderBySupportType = {
  COMPLAINT: 'busdn/complaints',
  LOST_ITEM: 'busdn/lost-items',
  SERVICE_FEEDBACK: 'busdn/feedback',
};

const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const buildPublicId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomUUID()}`;

const getOriginalName = (file = {}) => file.originalname || file.name || '';

const getExtension = (file = {}) => path.extname(getOriginalName(file)).toLowerCase();

const extensionByMimeType = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const getSafeExtension = (file = {}) => getExtension(file) || extensionByMimeType[file.mimetype || file.type] || '';

const normalizeUploadFolder = (folder = 'busdn/uploads') => String(folder || 'busdn/uploads')
  .split('/')
  .map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, ''))
  .filter(Boolean)
  .join('/');

const normalizeLocalPublicId = (publicId = '') => String(publicId || '')
  .split('/')
  .map((segment) => segment.replace(/[^a-zA-Z0-9_.-]/g, ''))
  .filter(Boolean)
  .join('/');

const getCloudinaryError = (error) => error?.error || error;

const uploadToCloudinary = async (file, options) => {
  const { default: CloudinaryStorage } = await import('./cloudinary.storage.js');

  return CloudinaryStorage.uploadBuffer(file, options);
};

const deleteFromCloudinary = async (publicId, options) => {
  const { default: CloudinaryStorage } = await import('./cloudinary.storage.js');

  return CloudinaryStorage.delete(publicId, options);
};

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

const normalizeLocalUploadResult = (file, { relativePath, publicId }) => ({
  provider: LOCAL_PROVIDER,
  publicId,
  url: relativePath,
  secureUrl: relativePath,
  resourceType: file.mimetype?.startsWith('image/') ? 'image' : 'raw',
  originalName: getOriginalName(file),
  fileName: path.basename(relativePath),
  filename: path.basename(relativePath),
  mimeType: file.mimetype || file.type || '',
  size: file.size || file.buffer?.length || 0,
  uploadedAt: new Date(),
});

export class StorageService {
  static async upload(file, options = {}) {
    if (!file?.buffer) {
      throw new CustomError('Upload file buffer is required', HTTP_STATUS.BAD_REQUEST);
    }

    try {
      const result = await uploadToCloudinary(file, {
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

      try {
        return await this.uploadLocal(file, options);
      } catch (localError) {
        logger.error('Local upload fallback failed', {
          message: localError.message,
          folder: options.folder,
        });
        throw new CustomError('File upload failed', HTTP_STATUS.SERVICE_UNAVAILABLE);
      }
    }
  }

  static async uploadLocal(file, options = {}) {
    if (!file?.buffer) {
      throw new CustomError('Upload file buffer is required', HTTP_STATUS.BAD_REQUEST);
    }

    const folder = normalizeUploadFolder(options.folder);
    const filename = `${buildPublicId(options.prefix || 'asset')}${getSafeExtension(file)}`;
    const targetDir = path.join(config.paths.uploads, folder);
    const targetPath = path.join(targetDir, filename);
    const relativePath = `/uploads/${folder}/${filename}`;

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetPath, file.buffer);

    return normalizeLocalUploadResult(file, {
      relativePath,
      publicId: `${folder}/${filename}`,
    });
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
      return await deleteFromCloudinary(publicId, options);
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
        .filter((upload) => upload?.publicId)
        .map((upload) => (
          upload.provider === LOCAL_PROVIDER
            ? this.deleteLocal(upload.publicId)
            : this.delete(upload.publicId, { resourceType: upload.resourceType })
        ))
    );
  }

  static async deleteLocal(publicId) {
    const normalizedPublicId = normalizeLocalPublicId(publicId);
    if (!normalizedPublicId) return null;

    const targetPath = path.resolve(config.paths.uploads, normalizedPublicId);
    const uploadsRoot = path.resolve(config.paths.uploads);

    const relativeTarget = path.relative(uploadsRoot, targetPath);
    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) return null;

    try {
      await fs.unlink(targetPath);
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Local upload cleanup failed', {
          message: error.message,
          publicId,
        });
      }
      return null;
    }
  }
}

export default StorageService;
