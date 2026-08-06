const RENDER_API_BASE_URL = 'https://cp-sep490-busdn.onrender.com/api';
const RENDER_SOCKET_URL = 'https://cp-sep490-busdn.onrender.com';
const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const config = {
  // Mobile luôn sử dụng Backend đã deploy. Không cho biến môi trường cũ
  // hoặc địa chỉ Metro/local ghi đè URL ở runtime.
  apiBaseUrl: RENDER_API_BASE_URL,
  configuredApiBaseUrl: RENDER_API_BASE_URL,
  socketUrl: trimTrailingSlash(RENDER_SOCKET_URL),
};
