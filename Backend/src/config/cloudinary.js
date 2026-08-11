import { v2 as cloudinary } from 'cloudinary';

import { config } from './environment.js';

const requiredKeys = [
  ['CLOUDINARY_CLOUD_NAME', config.cloudinary.cloudName],
  ['CLOUDINARY_API_KEY', config.cloudinary.apiKey],
  ['CLOUDINARY_API_SECRET', config.cloudinary.apiSecret],
  ['CLOUDINARY_UPLOAD_PRESET', config.cloudinary.uploadPreset],
];

const missingKeys = requiredKeys
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  throw new Error(`Missing required Cloudinary environment variables: ${missingKeys.join(', ')}`);
}

if (config.cloudinary.cloudName === 'busdn') {
  throw new Error(
    'Invalid CLOUDINARY_CLOUD_NAME: "busdn" is the app/upload folder name, not a Cloudinary cloud name. Use the Cloud name shown in your Cloudinary dashboard.'
  );
}

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

export default cloudinary;
