import cloudinary from '../../config/cloudinary.js';

export class CloudinaryStorage {
  static uploadBuffer(file, options = {}) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          public_id: options.publicId,
          resource_type: options.resourceType || 'auto',
          overwrite: false,
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        }
      );

      stream.end(file.buffer);
    });
  }

  static delete(publicId, options = {}) {
    if (!publicId) return Promise.resolve(null);

    return cloudinary.uploader.destroy(publicId, {
      resource_type: options.resourceType || 'image',
      invalidate: true,
    });
  }
}

export default CloudinaryStorage;
