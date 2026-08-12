const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetAttendanceData() {
  try {
    // 1. Count existing Attendance records before reset
    const beforeCount = await prisma.attendance.count();
    console.log(`Before reset:\nAttendance records: ${beforeCount}\n`);

    if (beforeCount === 0) {
      console.log('No attendance records to delete. Attendance table is already empty.');
      return;
    }

    console.log('Deleting old attendance data...');

    // 2. Delete all records strictly from the Attendance table ONLY
    const deleteResult = await prisma.attendance.deleteMany({});

    console.log(`\nDeleted: ${deleteResult.count}\n`);

    // 3. Verify remaining count is 0
    const afterCount = await prisma.attendance.count();
    console.log(`After reset:\nAttendance records: ${afterCount}`);

    if (afterCount === 0) {
      console.log('\nSUCCESS: Attendance records completely reset to 0.');
    } else {
      console.error(`\nWARNING: Expected 0 attendance records, but found ${afterCount}.`);
    }
  } catch (error) {
    console.error('Reset attendance data failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetAttendanceData();
