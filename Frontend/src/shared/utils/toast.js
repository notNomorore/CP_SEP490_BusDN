import toast from 'react-hot-toast';

const messageId = (type, message) => `${type}:${String(message || '').trim().toLowerCase()}`;

const appToast = {
  ...toast,
  error(message, options = {}) {
    return toast.error(message, {
      id: options.id || messageId('error', message),
      ...options,
    });
  },
  success(message, options = {}) {
    return toast.success(message, {
      id: options.id || messageId('success', message),
      ...options,
    });
  },
};

export default appToast;
