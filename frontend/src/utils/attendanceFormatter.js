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
