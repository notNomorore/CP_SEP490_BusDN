import type { LostItemCategory } from '@/api/passenger.api';

export const lostItemCategories: Array<{ value: LostItemCategory; label: string }> = [
  { value: 'PERSONAL_BELONGINGS', label: 'Vật dụng cá nhân' },
  { value: 'ELECTRONICS', label: 'Thiết bị điện tử' },
  { value: 'WALLET_DOCUMENTS', label: 'Ví / Giấy tờ' },
  { value: 'CLOTHING', label: 'Quần áo' },
  { value: 'BAGS_LUGGAGE', label: 'Túi xách / Hành lý' },
  { value: 'OTHER_ITEMS', label: 'Vật dụng khác' },
];

export const lostItemStatuses = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'SUBMITTED', label: 'Đã gửi' },
  { value: 'UNDER_REVIEW', label: 'Đang xem xét' },
  { value: 'SEARCHING', label: 'Đang tìm kiếm' },
  { value: 'ITEM_FOUND', label: 'Đã tìm thấy' },
  { value: 'RESOLVED', label: 'Đã giải quyết' },
  { value: 'CLOSED', label: 'Đã đóng' },
];

export const getLostItemCategoryLabel = (value?: string) => (
  lostItemCategories.find((item) => item.value === value)?.label || value || 'Vật dụng khác'
);

export const getLostItemStatusInfo = (status?: string) => {
  const value = String(status || 'SUBMITTED').toUpperCase();
  if (value === 'ITEM_FOUND' || value === 'FOUND') return { label: 'Đã tìm thấy', tone: 'success' as const };
  if (value === 'RESOLVED' || value === 'RETURNED') return { label: 'Đã giải quyết', tone: 'success' as const };
  if (value === 'SEARCHING') return { label: 'Đang tìm kiếm', tone: 'warning' as const };
  if (value === 'UNDER_REVIEW' || value === 'IN_PROGRESS') return { label: 'Đang xem xét', tone: 'warning' as const };
  if (value === 'CLOSED') return { label: 'Đã đóng', tone: 'neutral' as const };
  if (value === 'REJECTED' || value === 'UNRECOVERED') return { label: 'Không tìm thấy', tone: 'danger' as const };
  return { label: 'Đã gửi', tone: 'neutral' as const };
};

export const formatLostItemCaseCode = (code?: string) => {
  const value = String(code || '');
  const parts = value.split('-').filter(Boolean);
  if (parts.length >= 3 && /^\d{10,}$/.test(parts[1])) return `${parts[0]}-${parts[2]}`;
  return value || 'Chưa có mã';
};
