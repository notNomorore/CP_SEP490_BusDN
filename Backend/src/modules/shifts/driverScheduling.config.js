export const DRIVER_SCHEDULING_RULES = Object.freeze({
  operatingStart: '05:30',
  operatingEnd: '18:30',
  morningShiftStart: '05:30',
  morningShiftEnd: '12:00',
  afternoonShiftStart: '12:00',
  afternoonShiftEnd: '18:30',
  minimumTurnaroundMinutes: 15,
  defaultTransferMinutes: 20,
  maxContinuousDrivingMinutes: 240,
  minimumBreakMinutes: 30,
  minimumRestMinutes: Number(process.env.ROSTER_MINIMUM_REST_MINUTES || 600),
  maxDailyWorkingMinutes: 480,
  maxWeeklyWorkingMinutes: Number(process.env.ROSTER_MAX_WEEKLY_MINUTES || 2400),
  maxShiftsPerWeek: Number(process.env.ROSTER_MAX_SHIFTS_PER_WEEK || 6),
  maxConsecutiveWorkingDays: Number(process.env.ROSTER_MAX_CONSECUTIVE_DAYS || 6),
});

export default DRIVER_SCHEDULING_RULES;
