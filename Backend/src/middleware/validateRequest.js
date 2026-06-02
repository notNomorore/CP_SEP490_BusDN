import { CustomError } from './errorHandler.js';

export const validateRequest = (validator, target = 'body') => (req, res, next) => {
  const payload = req[target] || {};
  const errors = validator(payload, req);

  if (errors && Object.keys(errors).length > 0) {
    return next(new CustomError('Validation failed', 422, errors));
  }

  return next();
};

export default validateRequest;
