const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runCleanup() {
  console.log('Starting cleanup for existing LEAVE attendance records...');
  
  // Count records before update
  const totalLeaveRecords = await prisma.attendance.count({
    where: { status: 'LEAVE' }
  });
  console.log(`Found ${totalLeaveRecords} attendance record(s) with status = 'LEAVE'.`);

  // Perform update ONLY for status = 'LEAVE'
  const result = await prisma.attendance.updateMany({
    where: { status: 'LEAVE' },
    data: {
      clockIn: null,
      clockOut: null
    }
  });

  console.log(`Successfully updated ${result.count} LEAVE attendance record(s) to set clockIn = null and clockOut = null.`);
  
  // Verify real attendance records remain untouched
  const activeRecordsCount = await prisma.attendance.count({
    where: { status: { in: ['PRESENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME'] } }
  });
  console.log(`Verified ${activeRecordsCount} active attendance record(s) (PRESENT/LATE/HALF_DAY/WORK_FROM_HOME) remain untouched.`);

  await prisma.$disconnect();
}

runCleanup().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
