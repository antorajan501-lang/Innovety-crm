/**
 * Calculates consecutive on-time attendance streak for a user.
 * Rules:
 * - PRESENT / WORK_FROM_HOME -> +1 streak day.
 * - LATE / ABSENT / HALF_DAY -> Breaks on-time streak.
 * - Sundays (day = 0) -> Skipped (does NOT break or count towards streak).
 * - Company Holidays (HolidayCalendar) -> Skipped (does NOT break or count towards streak).
 * - Current day not yet checked in -> Skipped without breaking streak.
 */
export const calculateAttendanceStreak = (attendanceLogs = [], holidays = [], now = new Date()) => {
  if (!attendanceLogs) return 0;

  // Build set of holiday date strings ('YYYY-MM-DD')
  const holidaySet = new Set();
  (holidays || []).forEach(h => {
    const rawDate = h?.date || h;
    if (rawDate) {
      const dStr = new Date(rawDate).toISOString().split('T')[0];
      holidaySet.add(dStr);
    }
  });

  // Build map of dateStr -> status
  const attMap = new Map();
  (attendanceLogs || []).forEach(log => {
    if (log && log.date) {
      const dStr = new Date(log.date).toISOString().split('T')[0];
      attMap.set(dStr, log.status);
    }
  });

  let streak = 0;
  let curr = new Date(now);

  // Check today's date
  const todayStr = curr.toISOString().split('T')[0];
  const isTodaySunday = curr.getDay() === 0;
  const isTodayHoliday = holidaySet.has(todayStr);

  if (!isTodaySunday && !isTodayHoliday) {
    const todayStatus = attMap.get(todayStr);
    if (todayStatus === 'PRESENT' || todayStatus === 'WORK_FROM_HOME') {
      streak += 1;
    } else if (todayStatus === 'LATE' || todayStatus === 'ABSENT' || todayStatus === 'HALF_DAY') {
      // Clocked in late or marked absent today -> on-time streak breaks
      return 0;
    }
    // If today status is undefined (not checked in yet today), move to yesterday to count prior streak
  }

  // Go backwards day by day from yesterday
  curr.setDate(curr.getDate() - 1);

  // Scan up to 365 days backwards
  for (let i = 0; i < 365; i++) {
    const dateStr = curr.toISOString().split('T')[0];
    const isSunday = curr.getDay() === 0;
    const isHoliday = holidaySet.has(dateStr);

    if (isSunday || isHoliday) {
      // Skip non-working day
      curr.setDate(curr.getDate() - 1);
      continue;
    }

    const status = attMap.get(dateStr);

    if (status === 'PRESENT' || status === 'WORK_FROM_HOME') {
      streak += 1;
    } else {
      // LATE, ABSENT, HALF_DAY, or unlogged working day -> streak breaks!
      break;
    }

    curr.setDate(curr.getDate() - 1);
  }

  return streak;
};

/**
 * Formats streak count with correct singular/plural grammar.
 * Examples:
 *   0 -> "0 Days"
 *   1 -> "1 Day"
 *   2 -> "2 Days"
 *   3 -> "3 Days"
 */
export const formatStreakDays = (streak) => {
  const count = Number(streak || 0);
  return `${count} ${count === 1 ? 'Day' : 'Days'}`;
};
