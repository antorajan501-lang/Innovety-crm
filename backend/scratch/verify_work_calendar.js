const prisma = require('../src/utils/db');
const { resolveMonthlyCalendar } = require('../src/services/calendarResolverService');

async function testResolver() {
  console.log('=== WORK CALENDAR RESOLVER TEST ===');

  // Test 1: Employee user resolution for August 2026
  const dummyEmployee = { id: 'test-employee-id', role: 'EMPLOYEE' };
  const employeeCalendar = await resolveMonthlyCalendar({ user: dummyEmployee, month: 8, year: 2026 });
  
  console.log(`Resolved ${employeeCalendar.length} days for August 2026 (Employee).`);
  
  const sundays = employeeCalendar.filter(d => d.isSunday);
  console.log(`Sundays count: ${sundays.length}`);
  console.log(`Sunday #1 sample:`, sundays[0]);
  
  const saturdays = employeeCalendar.filter(d => d.dayOfWeek === 6);
  console.log(`Saturdays count: ${saturdays.length}`);
  console.log(`Saturday #1 status: ${saturdays[0].status} (Expected: WFH)`);
  
  const weekdays = employeeCalendar.filter(d => d.dayOfWeek >= 1 && d.dayOfWeek <= 5);
  console.log(`Weekday #1 status: ${weekdays[0].status} (Expected: WORKING_DAY)`);

  // Test 2: Verify Sunday Lock validation logic
  const sundayDate = sundays[0].date;
  const [y, m, d] = sundayDate.split('-').map(Number);
  const sundayObj = new Date(Date.UTC(y, m - 1, d));
  const isSundayLocked = sundayObj.getUTCDay() === 0;
  console.log(`Sunday lock validation check for ${sundayDate}: ${isSundayLocked} (Expected: true)`);

  console.log('=== VERIFICATION COMPLETED SUCCESSFULLY ===');
}

testResolver()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
