const { createZonedDate, getZonedParts } = require('../src/utils/attendanceUtils');

const parseInputDate = (inputVal, timeZone = 'Asia/Kolkata') => {
  if (!inputVal) return null;
  if (inputVal instanceof Date) return isNaN(inputVal.getTime()) ? null : inputVal;

  const str = String(inputVal).trim();
  if (str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  const parts = str.split(/[T ]/);
  if (parts.length >= 2) {
    const [year, month, day] = parts[0].split('-').map(Number);
    const [hour, minute] = parts[1].split(':').map(Number);
    if (year && month && day && !isNaN(hour) && !isNaN(minute)) {
      return createZonedDate(year, month, day, hour, minute, timeZone);
    }
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const testCases = [
  { input: '2026-08-16T09:00', label: '09:00 AM IST', expectedUTC: '2026-08-16T03:30:00.000Z' },
  { input: '2026-08-16T10:00', label: '10:00 AM IST', expectedUTC: '2026-08-16T04:30:00.000Z' },
  { input: '2026-08-16T12:00', label: '12:00 PM IST', expectedUTC: '2026-08-16T06:30:00.000Z' },
  { input: '2026-08-16T14:30', label: '02:30 PM IST', expectedUTC: '2026-08-16T09:00:00.000Z' },
  { input: '2026-08-16T18:45', label: '06:45 PM IST', expectedUTC: '2026-08-16T13:15:00.000Z' },
  { input: '2026-08-16T18:30', label: '06:30 PM IST (Clock Out)', expectedUTC: '2026-08-16T13:00:00.000Z' }
];

console.log('=== ATTENDANCE TIMEZONE PARSING & CONVERSION TEST ===');
console.log(`Current Server process.env.TZ = "${process.env.TZ || 'Default'}"`);

let allPassed = true;

testCases.forEach(({ input, label, expectedUTC }) => {
  // Test 1: Timezone-less string input
  const dateObj1 = parseInputDate(input, 'Asia/Kolkata');
  const actualUTC1 = dateObj1 ? dateObj1.toISOString() : 'INVALID';

  // Test 2: ISO string input (sent from frontend)
  const dateObj2 = parseInputDate(expectedUTC, 'Asia/Kolkata');
  const actualUTC2 = dateObj2 ? dateObj2.toISOString() : 'INVALID';

  const match1 = actualUTC1 === expectedUTC;
  const match2 = actualUTC2 === expectedUTC;

  console.log(`[TEST] ${label} ("${input}"):`);
  console.log(`  Local string parse -> UTC: ${actualUTC1} (Expected: ${expectedUTC}) [${match1 ? 'PASS' : 'FAIL'}]`);
  console.log(`  ISO string parse   -> UTC: ${actualUTC2} (Expected: ${expectedUTC}) [${match2 ? 'PASS' : 'FAIL'}]`);

  if (!match1 || !match2) allPassed = false;
});

// Test Shift Start Late Minutes Calculation
console.log('\n--- Shift Start & Late Minutes Calculation Test ---');
const clockInDate = parseInputDate('2026-08-16T10:15', 'Asia/Kolkata'); // 10:15 AM (15 mins late for 09:30 shift)
const timeZone = 'Asia/Kolkata';
const shiftH = 9;
const shiftM = 30;

const { year, month, day } = getZonedParts(clockInDate, timeZone);
const shiftStart = createZonedDate(year, month, day, shiftH, shiftM, timeZone);
const diffMins = Math.floor((clockInDate.getTime() - shiftStart.getTime()) / 60000);

console.log(`Clock In UTC: ${clockInDate.toISOString()}`);
console.log(`Shift Start UTC: ${shiftStart.toISOString()}`);
console.log(`Late Minutes: ${diffMins} (Expected: 45) [${diffMins === 45 ? 'PASS' : 'FAIL'}]`);
if (diffMins !== 45) allPassed = false;

if (allPassed) {
  console.log('\n=== ALL TIMEZONE VERIFICATION TESTS PASSED ===');
} else {
  console.error('\n=== TIMEZONE VERIFICATION TEST FAILED ===');
  process.exit(1);
}
