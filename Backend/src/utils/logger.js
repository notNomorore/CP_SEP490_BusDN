// Logger utility with different log levels
import { config } from '../config/environment.js';

const levels = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

const getColorForLevel = (level) => {
  switch (level) {
    case 'ERROR':
      return colors.red;
    case 'WARN':
      return colors.yellow;
    case 'INFO':
      return colors.green;
    case 'DEBUG':
      return colors.blue;
    default:
      return colors.reset;
  }
};

const getCurrentLevel = () => {
  const level = config.logging.level?.toUpperCase() || 'INFO';
  return levels[level] || levels.INFO;
};

const formatTimestamp = () => {
  return new Date().toISOString();
};

const log = (level, message, meta = null) => {
  const currentLevel = getCurrentLevel();
  const msgLevel = levels[level] || 0;

  // Skip if message level is below current level
  if (msgLevel > currentLevel) return;

  const timestamp = formatTimestamp();
  const color = getColorForLevel(level);
  const prefix = `${color}[${timestamp}] [${level}]${colors.reset}`;

  if (meta) {
    console.log(`${prefix}`, message, meta);
  } else {
    console.log(`${prefix}`, message);
  }
};

const logger = {
  error: (message, meta) => log('ERROR', message, meta),
  warn: (message, meta) => log('WARN', message, meta),
  info: (message, meta) => log('INFO', message, meta),
  debug: (message, meta) => log('DEBUG', message, meta),
  
  // Aliases
  log: (message, meta) => log('INFO', message, meta),
  warning: (message, meta) => log('WARN', message, meta),
};

export default logger;
