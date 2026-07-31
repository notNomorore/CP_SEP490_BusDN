import { describe, expect, it } from 'vitest';
import { getAdminMessage, translateAdminPhrase } from './adminI18n.js';

describe('frontend i18n', () => {
  it('translates semantic navigation keys in both languages', () => {
    expect(getAdminMessage('en', 'admin.sidebar.fareOperations')).toBe('Fare Operations');
    expect(getAdminMessage('vi', 'admin.sidebar.fareOperations')).toBe('Vận hành giá vé');
  });

  it('translates catalog phrases in both directions', () => {
    expect(translateAdminPhrase('Add New Policy', 'vi')).toBe('Thêm chính sách mới');
    expect(translateAdminPhrase('Tạo bản nháp mới', 'en')).toBe('Create new draft');
  });

  it('uses BusDN terminology overrides for operational labels', () => {
    expect(translateAdminPhrase('Fleet Operations', 'vi')).toBe('Vận hành đội xe');
    expect(translateAdminPhrase('Walk-in Ticket Monitoring', 'vi')).toBe('Giám sát vé mua trực tiếp');
    expect(translateAdminPhrase('Acknowledge delay', 'vi')).toBe('Xác nhận chuyến trễ');
  });

  it('translates common statuses and dynamic result text', () => {
    expect(translateAdminPhrase('PENDING', 'vi')).toBe('Chờ xử lý');
    expect(translateAdminPhrase('Showing 1–10 of 24', 'vi')).toBe('Hiển thị 1–10 trong 24');
  });

  it('translates passenger navigation and route-search copy', () => {
    expect(getAdminMessage('en', 'passenger.nav.routes')).toBe('Routes');
    expect(getAdminMessage('vi', 'passenger.nav.routes')).toBe('Tuyến xe');
    expect(translateAdminPhrase('Route Planner', 'vi')).toBe('Lập kế hoạch tuyến xe');
    expect(translateAdminPhrase('Passenger Feedback', 'vi')).toBe('Phản hồi hành khách');
  });

  it('translates Vietnamese passenger source text back to English', () => {
    expect(translateAdminPhrase('Nơi xuất phát', 'en')).toBe('Departure');
    expect(translateAdminPhrase('Tuyến đường phổ biến', 'en')).toBe('Popular routes');
  });
});
