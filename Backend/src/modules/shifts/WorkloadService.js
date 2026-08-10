import DRIVER_SCHEDULING_RULES from './driverScheduling.config.js';

const id = (value) => String(value?._id || value || '');
const minutes = (value) => { const [hour, minute] = String(value || '').split(':').map(Number); return (hour * 60) + minute; };
const dateKey = (value) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };

export const consecutiveDays = (dates = []) => {
  const unique = [...new Set(dates.map(dateKey))].sort();
  let longest = 0;
  let current = 0;
  let previous = null;
  unique.forEach((value) => {
    const day = new Date(`${value}T00:00:00`);
    current = previous && day.getTime() - previous.getTime() === 86400000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  });
  return longest;
};

export const calculateWorkload = (assignments = [], resourceField) => {
  const grouped = new Map();
  assignments.forEach((assignment) => {
    const resource = assignment[resourceField];
    const shift = assignment.shiftId;
    if (!resource || !shift) return;
    const key = id(resource);
    const current = grouped.get(key) || { staffId: key, name: resource.fullName || '', assignments: [] };
    current.assignments.push(assignment);
    grouped.set(key, current);
  });
  return [...grouped.values()].map((item) => {
    const totalMinutes = item.assignments.reduce((sum, assignment) => sum + Math.max(0, minutes(assignment.shiftId.endTime) - minutes(assignment.shiftId.startTime) - Number(assignment.shiftId.breakMinutes || 0)), 0);
    const morningShifts = item.assignments.filter((assignment) => assignment.shiftId.shiftType === 'MORNING').length;
    const afternoonShifts = item.assignments.filter((assignment) => assignment.shiftId.shiftType === 'AFTERNOON').length;
    return {
      staffId: item.staffId,
      name: item.name,
      totalShifts: item.assignments.length,
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(1)),
      morningShifts,
      afternoonShifts,
      consecutiveWorkingDays: consecutiveDays(item.assignments.map((assignment) => assignment.workDate)),
      remainingCapacity: Math.max(0, DRIVER_SCHEDULING_RULES.maxShiftsPerWeek - item.assignments.length),
    };
  });
};

export default { calculateWorkload, consecutiveDays };
