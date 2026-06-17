// Backend configuration and environment setup
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// Load environment variables from the backend root, independent of the shell cwd.
dotenv.config({ path: path.join(rootDir, '.env.local') });
dotenv.config({ path: path.join(rootDir, '.env') });

const getEnv = (key, fallback = undefined) => {
  const value = process.env[key];

  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
};

const toNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toList = (value, fallback = []) => {
  const source = typeof value === 'string' ? value : '';
  const list = source
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return list.length ? list : fallback;
};

const createCorsOrigin = () => {
  const allowedOrigins = toList(getEnv('CORS_ORIGIN'), ['http://localhost:5173']);
  const isDevelopment = getEnv('NODE_ENV', 'development') === 'development';
  const localDevOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

  return (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin) || (isDevelopment && localDevOriginPattern.test(origin))) {
      return callback(null, true);
    }

    return callback(new Error(`CORS origin not allowed: ${origin}`), false);
  };
};

export const config = {
  // Server
  port: toNumber(getEnv('PORT'), 3000),
  host: getEnv('HOST', 'localhost'),
  nodeEnv: getEnv('NODE_ENV', 'development'),

  // Database
  mongodb: {
    uri: getEnv('MONGODB_URI'),
    dbName: getEnv('DATABASE_NAME'),
    options: {
      retryWrites: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    },
  },

  // JWT
  jwt: {
    secret: getEnv('JWT_SECRET', 'dev_secret_key_do_not_use_in_production'),
    expire: getEnv('JWT_EXPIRE', '7d'),
    refreshExpire: getEnv('JWT_REFRESH_EXPIRE', '30d'),
  },

  // Session
  session: {
    secret: getEnv('SESSION_SECRET', 'dev_session_secret'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: getEnv('NODE_ENV', 'development') === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  },

  // Email
  smtp: {
    host: getEnv('SMTP_HOST', 'localhost'),
    port: toNumber(getEnv('SMTP_PORT', '587'), 587),
    user: getEnv('SMTP_USER'),
    password: getEnv('SMTP_PASSWORD'),
  },

  emailFrom: {
    name: getEnv('EMAIL_FROM_NAME', 'BusDN'),
    email: getEnv('EMAIL_FROM', 'noreply@veridian-transit.com'),
  },

  // CORS
  cors: {
    origin: createCorsOrigin(),
    credentials: true,
  },

  // File Upload
  upload: {
    dir: getEnv('UPLOAD_DIR', './uploads'),
    maxSize: toNumber(getEnv('MAX_FILE_SIZE', '5242880'), 5242880), // 5MB
  },

  // Stripe
  stripe: {
    secretKey: getEnv('STRIPE_SECRET_KEY'),
    publicKey: getEnv('STRIPE_PUBLIC_KEY'),
  },

  // Redis
  redis: {
    url: getEnv('REDIS_URL', 'redis://localhost:6379'),
  },

  // Google Maps Platform
  googleMaps: {
    apiKey: getEnv('GOOGLE_MAPS_API_KEY'),
  },

  // Da Nang public bus data
  danabus: {
    stopApiUrl: getEnv(
      'DANABUS_STOP_API_URL',
      'https://ecobus.danang.gov.vn/api/api/BusStop/GetListBusStop'
    ),
    requestTimeoutMs: toNumber(getEnv('DANABUS_REQUEST_TIMEOUT_MS', '20000'), 20000),
  },

  // Logging
  logging: {
    level: getEnv('LOG_LEVEL', 'info'),
  },

  rateLimit: {
    windowMs: toNumber(getEnv('RATE_LIMIT_WINDOW_MS', '900000'), 900000),
    apiMax: toNumber(
      getEnv('RATE_LIMIT_API_MAX', getEnv('NODE_ENV', 'development') === 'development' ? '5000' : '1000'),
      getEnv('NODE_ENV', 'development') === 'development' ? 5000 : 1000
    ),
    authMax: toNumber(
      getEnv('RATE_LIMIT_AUTH_MAX', getEnv('NODE_ENV', 'development') === 'development' ? '100' : '10'),
      getEnv('NODE_ENV', 'development') === 'development' ? 100 : 10
    ),
  },

  // Paths
  paths: {
    root: rootDir,
    src: __dirname,
    uploads: path.join(rootDir, 'uploads'),
  },

  // Feature Flags
  features: {
    enableAnalytics: getEnv('ENABLE_ANALYTICS', 'false') === 'true',
    enableSentry: getEnv('ENABLE_SENTRY', 'false') === 'true',
  },
};

export default config;
