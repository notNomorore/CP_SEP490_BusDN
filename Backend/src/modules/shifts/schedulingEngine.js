export const OPERATING_START = '05:30';
export const OPERATING_END = '18:30';
export const MAX_DAILY_WORK_MINUTES = 8 * 60;
export const TARGET_WEEKLY_WORK_MINUTES = 40 * 60;
export const MIN_REST_MINUTES = 60;

export const DEFAULT_TIME_SLOTS = [
  { startTime: '05:30', endTime: '09:00' },
  { startTime: '09:00', endTime: '12:30' },
  { startTime: '12:30', endTime: '16:00' },
  { startTime: '16:00', endTime: '18:30' },
];

export const toMinutes = (value) => {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60) + minutes;
};

export const timeRange = ({ startTime, endTime }) => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  return start === null || end === null || start >= end ? null : { start, end };
};

export const rangesOverlap = (first, second) => {
  const left = first?.start === undefined ? timeRange(first || {}) : first;
  const right = second?.start === undefined ? timeRange(second || {}) : second;
  return Boolean(left && right && left.start < right.end && left.end > right.start);
};

export const validateOperatingWindow = ({ startTime, endTime }) => {
  const range = timeRange({ startTime, endTime });
  const errors = [];
  if (!range) errors.push('Giờ bắt đầu phải nhỏ hơn giờ kết thúc.');
  if (range && (range.start < toMinutes(OPERATING_START) || range.end > toMinutes(OPERATING_END))) {
    errors.push(`Thời gian phải nằm trong khung vận hành ${OPERATING_START} - ${OPERATING_END}.`);
  }
  return errors;
};

export const restMinutesBetween = (range, assignments = []) => assignments.reduce((minimum, assignment) => {
  const current = timeRange(assignment);
  if (!current) return minimum;
  const rest = current.end <= range.start
    ? range.start - current.end
    : (range.end <= current.start ? current.start - range.end : 0);
  return Math.min(minimum, rest);
}, Number.POSITIVE_INFINITY);

export const workloadStatus = (assignedMinutes, targetMinutes = MAX_DAILY_WORK_MINUTES) => {
  if (assignedMinutes > targetMinutes) return 'OVER_LIMIT';
  if (assignedMinutes >= targetMinutes * 0.9) return 'NEAR_LIMIT';
  if (assignedMinutes >= targetMinutes * 0.75) return 'BALANCED';
  return 'UNDER_HOURS';
};

export const evaluateResource = ({
  resource,
  shift,
  assignments = [],
  assignedMinutes = 0,
  maxMinutes = MAX_DAILY_WORK_MINUTES,
  onLeave = false,
  operational = true,
  minimumRestMinutes = MIN_REST_MINUTES,
}) => {
  const errors = validateOperatingWindow(shift);
  const range = timeRange(shift);
  if (!resource || resource.status !== 'ACTIVE') errors.push('Trạng thái tài khoản không hợp lệ.');
  if (onLeave) errors.push('Nhân sự đang nghỉ phép.');
  if (!operational) errors.push('Phương tiện không sẵn sàng vận hành.');
  if (range && assignments.some((item) => rangesOverlap(range, item))) errors.push('Trùng lịch đã phân.');
  const duration = range ? range.end - range.start : 0;
  if (assignedMinutes + duration > maxMinutes) errors.push('Vượt thời lượng làm việc tối đa.');
  if (range && assignments.length && restMinutesBetween(range, assignments) < minimumRestMinutes) errors.push('Không đủ thời gian nghỉ tối thiểu.');
  return { eligible: errors.length === 0, errors, duration };
};

export const scoreDriver = ({
  driverId,
  eligible = true,
  errors = [],
  assignedMinutes = 0,
  targetMinutes = MAX_DAILY_WORK_MINUTES,
  morningShiftCount = 0,
  afternoonShiftCount = 0,
  peakShiftCount = 0,
  routeExperience = false,
  restMinutes = 24 * 60,
  futureCoverageShortage = 0,
  shiftType,
}) => {
  if (!eligible) return { driverId, score: 0, eligible: false, reasons: [], warnings: errors };
  let score = 60;
  const reasons = ['Rảnh toàn bộ khung giờ và không trùng lịch'];
  const warnings = [];
  if (assignedMinutes < targetMinutes * 0.75) { score += 18; reasons.push('Đang thiếu giờ làm mục tiêu'); }
  score += Math.max(0, Math.round((targetMinutes - assignedMinutes) / 120));
  if (routeExperience) { score += 8; reasons.push('Đã có kinh nghiệm trên tuyến'); }
  if (restMinutes >= 120) { score += 5; reasons.push('Có thời gian nghỉ tốt'); }
  if (shiftType === 'MORNING' && morningShiftCount > afternoonShiftCount) score -= 7;
  if (shiftType === 'AFTERNOON' && afternoonShiftCount > morningShiftCount) score -= 7;
  score -= peakShiftCount * 2;
  if (assignedMinutes >= targetMinutes * 0.9) { score -= 15; warnings.push('Gần giới hạn giờ làm'); }
  if (futureCoverageShortage > 0) {
    score -= futureCoverageShortage * 20;
    warnings.push(`Làm thiếu ${futureCoverageShortage} tài xế cho khung giờ sau`);
  }
  return { driverId, score: Math.max(1, Math.min(100, score)), eligible: true, reasons, warnings };
};

export const checkFutureStaffCoverage = ({ candidateId, futureSlots = [], candidates = [] }) => {
  const shortages = futureSlots.map((slot) => {
    const available = candidates.filter((candidate) => (
      String(candidate.id) !== String(candidateId)
      && candidate.availableSlots?.some((availableSlot) => rangesOverlap(availableSlot, slot))
    )).length;
    return { ...slot, available, shortage: Math.max(0, Number(slot.requiredDrivers || 0) - available) };
  }).filter((slot) => slot.shortage > 0);
  return { allowed: shortages.length === 0, shortages };
};
