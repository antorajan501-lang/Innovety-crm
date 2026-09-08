/**
 * Formats late duration in minutes into human-readable hours and minutes.
 * Examples:
 *   0 -> ""
 *   1 -> "Late by 1 min"
 *   45 -> "Late by 45 mins"
 *   60 -> "Late by 1 hr"
 *   61 -> "Late by 1 hr 1 min"
 *   120 -> "Late by 2 hrs"
 *   125 -> "Late by 2 hrs 5 mins"
 *   244 -> "Late by 4 hrs 4 mins"
 */
export const formatLateDuration = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return '';
  const minsNum = Number(totalMinutes);
  const hours = Math.floor(minsNum / 60);
  const remainingMins = minsNum % 60;

  const hrStr = hours > 0 ? `${hours} ${hours === 1 ? 'hr' : 'hrs'}` : '';
  const minStr = remainingMins > 0 ? `${remainingMins} ${remainingMins === 1 ? 'min' : 'mins'}` : '';

  if (hours > 0 && remainingMins > 0) {
    return `Late by ${hrStr} ${minStr}`;
  }
  if (hours > 0) {
    return `Late by ${hrStr}`;
  }
  return `Late by ${minStr}`;
};

export const formatLateMinutesCompact = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return '';
  const minsNum = Number(totalMinutes);
  const hours = Math.floor(minsNum / 60);
  const remainingMins = minsNum % 60;

  const hrStr = hours > 0 ? `${hours} ${hours === 1 ? 'hr' : 'hrs'}` : '';
  const minStr = remainingMins > 0 ? `${remainingMins} ${remainingMins === 1 ? 'min' : 'mins'}` : '';

  if (hours > 0 && remainingMins > 0) {
    return `${hrStr} ${minStr}`;
  }
  if (hours > 0) {
    return hrStr;
  }
  return minStr;
};

/**
 * Formats a 24-hour time string ("09:00", "18:00", "18:00:00") into a 12-hour formatted time ("09:00 AM", "06:00 PM").
 * Handles raw strings, strips seconds, and formats 12-hour AM/PM correctly.
 */
export const formatTime12Hour = (time) => {
  if (!time || typeof time !== 'string') return '--';

  const parts = time.trim().split(':');
  if (parts.length < 2) return time;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) return time;

  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;

  const paddedHours = String(hours12).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');

  return `${paddedHours}:${paddedMinutes} ${period}`;
};

/**
 * Formats start and end time into a clean working hours range ("09:00 AM – 06:00 PM").
 */
export const formatWorkingHoursRange = (startTime = '09:00', endTime = '18:00') => {
  const formattedStart = formatTime12Hour(startTime || '09:00');
  const formattedEnd = formatTime12Hour(endTime || '18:00');
  return `${formattedStart} – ${formattedEnd}`;
};
