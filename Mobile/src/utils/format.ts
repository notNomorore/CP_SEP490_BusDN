export const formatCurrency = (value?: number) => {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('vi-VN')} VND`;
};

export const formatDate = (value?: string | Date) => {
  if (!value) return 'Chưa có lịch';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export const todayInputDate = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
