export const timeStringToMinutes = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 47 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
};

export const startOfLocalDay = (date = new Date()) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};

export const endOfLocalDay = (date = new Date()) => {
  const day = startOfLocalDay(date);
  day.setDate(day.getDate() + 1);
  return day;
};
