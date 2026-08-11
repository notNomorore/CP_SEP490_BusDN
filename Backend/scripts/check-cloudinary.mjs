import cloudinary from '../src/config/cloudinary.js';
import { config } from '../src/config/environment.js';

const mask = (value) => {
  const text = String(value || '');
  if (text.length <= 4) return '<set>';
  return `${text.slice(0, 2)}...${text.slice(-2)}`;
};

const getCloudinaryError = (error) => error?.error || error;

try {
  const result = await cloudinary.api.ping();
  console.log('Cloudinary configuration is valid.');
  console.log(`cloudName=${config.cloudinary.cloudName}`);
  console.log(`apiKey=${mask(config.cloudinary.apiKey)}`);
  console.log(`status=${result.status || 'ok'}`);
} catch (error) {
  const cloudinaryError = getCloudinaryError(error);

  console.error('Cloudinary configuration check failed.');
  console.error(`cloudName=${config.cloudinary.cloudName || '<missing>'}`);
  console.error(`apiKey=${mask(config.cloudinary.apiKey)}`);
  console.error(`message=${cloudinaryError?.message || 'Unknown Cloudinary error'}`);
  if (cloudinaryError?.http_code) console.error(`httpCode=${cloudinaryError.http_code}`);
  process.exit(1);
}
