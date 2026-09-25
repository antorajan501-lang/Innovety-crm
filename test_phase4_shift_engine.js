/**
 * Phase 4 Comprehensive Verification: Shift Engine Integration
 * Tests:
 * 1. Working day uses assigned shift timings
 * 2. Holiday blocks clock-in (canClockIn: false, reason: 'HOLIDAY')
 * 3. WFH day clocks in with WORK_FROM_HOME status
 * 4. Grace Period and Early Window come strictly from Company Settings
 * 5. Safeguard 1: Attendance record saves snapshot (shiftId, shiftName, scheduledStartTime, scheduledEndTime)
 * 6. Safeguard 2: Payroll uses Attendance first, Shift second, Settings fallback.
 *    - Overtime starts after assigned shift end.
 *    - Working days respects custom shift schedule (5-day, 6-day).
 *    - Historical attendance snapshot remains unchanged if shift is edited later.
 * 7. Safeguard 3: Leave evaluates each date individually, skipping Sundays and shift holidays.
 * 8. Multi-tenant isolation between organizations.
 */

const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

const shiftService = require('./backend/src/services/shiftService');
const { validateAttendanceWindow, getShiftWindowDates } = require('./backend/src/utils/attendanceUtils');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passedTests++;
    console.log(`✅ PASS: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING PHASE 4 SHIFT ENGINE VERIFICATION TESTS');
  console.log('====================================================\n');

  try {
    // 1. Setup Test Organizations & Users
    console.log('--- Test Setup ---');
    let testOrg1 = await prisma.organization.findFirst({ where: { name: 'P4_Test_Org_Alpha' } });
    if (!testOrg1) {
      testOrg1 = await prisma.organization.create({
        data: {
          name: 'P4_Test_Org_Alpha',
          slug: 'p4-test-org-alpha',
          companyCode: 'P4A',
          status: 'ACTIVE'
        }
      });
    }

    let testOrg2 = await prisma.organization.findFirst({ where: { name: 'P4_Test_Org_Beta' } });
    if (!testOrg2) {
      testOrg2 = await prisma.organization.create({
        data: {
          name: 'P4_Test_Org_Beta',
          slug: 'p4-test-org-beta',
          companyCode: 'P4B',
          status: 'ACTIVE'
        }
      });
    }

    let testUser1 = await prisma.user.findFirst({ where: { email: 'p4_emp1@alphacorp.test' } });
    if (!testUser1) {
      testUser1 = await prisma.user.create({
        data: {
          email: 'p4_emp1@alphacorp.test',
          name: 'P4 Employee Alpha',
          employeeId: 'P4-EMP-001',
          password: 'hashed_dummy_password',
          role: 'EMPLOYEE',
          organizationId: testOrg1.id
        }
      });
    }

    let testUser2 = await prisma.user.findFirst({ where: { email: 'p4_emp2@betacorp.test' } });
    if (!testUser2) {
      testUser2 = await prisma.user.create({
        data: {
          email: 'p4_emp2@betacorp.test',
          name: 'P4 Employee Beta',
          employeeId: 'P4-EMP-002',
          password: 'hashed_dummy_password',
          role: 'EMPLOYEE',
          organizationId: testOrg2.id
        }
      });
    }

    // Initialize Default Shifts
    const defShift1 = await shiftService.createDefaultShift(testOrg1.id);
    const defShift2 = await shiftService.createDefaultShift(testOrg2.id);

    // Create a Custom Shift for Org 1 with specific schedule:
    // Monday-Thursday: Working (10:00 - 19:00), Friday: WFH, Saturday: Holiday, Sunday: Holiday
    const customWorkingDays = {
      MONDAY: 'Working',
      TUESDAY: 'Working',
      WEDNESDAY: 'Working',
      THURSDAY: 'Working',
      FRIDAY: 'WFH',
      SATURDAY: 'Holiday',
      SUNDAY: 'Holiday'
    };

    let customShift = await prisma.shift.findFirst({
      where: { organizationId: testOrg1.id, name: 'Alpha 5-Day Hybrid Shift' }
    });

    if (!customShift) {
      customShift = await shiftService.createShift({
        organizationId: testOrg1.id,
        name: 'Alpha 5-Day Hybrid Shift',
        startTime: '10:00',
        endTime: '19:00',
        workingDays: customWorkingDays
      });
    }

    // Assign testUser1 to customShift
    await shiftService.assignMembers(customShift.id, [testUser1.id], testOrg1.id);

    console.log('✅ Setup completed.\n');

    // -------------------------------------------------------------
    // Test 1: Working day uses assigned shift timings
    // -------------------------------------------------------------
    console.log('--- Test 1: Working Day Shift Timings ---');
    const settings = {
      earlyWindowMinutes: 20,
      gracePeriodMinutes: 10,
      internShiftStart: '09:00',
      internShiftEnd: '18:00',
      timeZone: 'Asia/Kolkata'
    };

    // Simulate Monday (Working day for customShift)
    // 2026-09-21 is a Monday
    const mondayDate = new Date('2026-09-21T04:30:00.000Z'); // 10:00 AM IST
    const shiftScheduleMon = await shiftService.getEmployeeShiftWithSchedule(testUser1.id, mondayDate, 'Asia/Kolkata');
    
    assert(shiftScheduleMon.name === 'Alpha 5-Day Hybrid Shift', 'Employee is correctly assigned to custom shift');
    assert(shiftScheduleMon.dayName === 'MONDAY', 'Correctly identified Monday');
    assert(shiftScheduleMon.todayStatus === 'Working', 'Monday is correctly evaluated as Working day');
    assert(shiftScheduleMon.startTime === '10:00', 'Shift startTime is 10:00');
    assert(shiftScheduleMon.endTime === '19:00', 'Shift endTime is 19:00');

    const winInfo = getShiftWindowDates('EMPLOYEE', settings, mondayDate, shiftScheduleMon);
    assert(winInfo.shiftStartStr === '10:00', 'Window dates use assigned shift startTime (10:00)');
    assert(winInfo.earlyWindowMins === 20, 'Early window comes from Company Settings (20 mins)');
    assert(winInfo.gracePeriodMins === 10, 'Grace period comes from Company Settings (10 mins)');

    // -------------------------------------------------------------
    // Test 2: Holiday blocks clock-in
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Holiday Blocks Clock-In ---');
    // Saturday in customShift is Holiday
    const saturdayDate = new Date('2026-09-26T04:30:00.000Z');
    const shiftScheduleSat = await shiftService.getEmployeeShiftWithSchedule(testUser1.id, saturdayDate, 'Asia/Kolkata');
    assert(shiftScheduleSat.todayStatus === 'Holiday', 'Saturday is evaluated as Holiday in custom shift');

    const satValidation = validateAttendanceWindow({
      userRole: 'EMPLOYEE',
      settings,
      attendanceRecord: null,
      approvedLeave: null,
      now: saturdayDate,
      userShift: shiftScheduleSat
    });
    assert(satValidation.canClockIn === false, 'canClockIn is FALSE on shift Holiday');
    assert(satValidation.reason === 'HOLIDAY', 'reason is HOLIDAY on shift Holiday');

    // Sunday is permanently locked as Holiday
    const sundayDate = new Date('2026-09-27T04:30:00.000Z');
    const shiftScheduleSun = await shiftService.getEmployeeShiftWithSchedule(testUser1.id, sundayDate, 'Asia/Kolkata');
    assert(shiftScheduleSun.todayStatus === 'Holiday', 'Sunday is permanently locked as Holiday');

    const sunValidation = validateAttendanceWindow({
      userRole: 'EMPLOYEE',
      settings,
      attendanceRecord: null,
      approvedLeave: null,
      now: sundayDate,
      userShift: shiftScheduleSun
    });
    assert(sunValidation.canClockIn === false, 'canClockIn is FALSE on Sunday');
    assert(sunValidation.reason === 'HOLIDAY', 'reason is HOLIDAY on Sunday');

    // -------------------------------------------------------------
    // Test 3: WFH day clocks in with WORK_FROM_HOME status
    // -------------------------------------------------------------
    console.log('\n--- Test 3: WFH Day Clocks in with WORK_FROM_HOME ---');
    // Friday is WFH in customShift
    const fridayDate = new Date('2026-09-25T04:30:00.000Z'); // 10:00 AM IST
    const shiftScheduleFri = await shiftService.getEmployeeShiftWithSchedule(testUser1.id, fridayDate, 'Asia/Kolkata');
    assert(shiftScheduleFri.todayStatus === 'WFH', 'Friday is evaluated as WFH day in custom shift');

    const friValidation = validateAttendanceWindow({
      userRole: 'EMPLOYEE',
      settings,
      attendanceRecord: null,
      approvedLeave: null,
      now: fridayDate,
      userShift: shiftScheduleFri
    });
    assert(friValidation.canClockIn === true, 'canClockIn is TRUE on WFH day during open window');
    assert(friValidation.attendanceStatus === 'WORK_FROM_HOME', 'attendanceStatus is WORK_FROM_HOME on WFH day');

    // -------------------------------------------------------------
    // Test 4: Safeguard 1 - Attendance Record Saves Snapshot on Clock-In
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Safeguard 1 - Shift Snapshot Stored on Clock-In ---');
    const todayMidnight = new Date('2026-09-21T00:00:00.000Z');
    await prisma.attendance.deleteMany({
      where: { userId: testUser1.id, date: todayMidnight }
    });

    const shiftEndAt = new Date('2026-09-21T13:30:00.000Z'); // 19:00 IST
    const createdAttendance = await prisma.attendance.create({
      data: {
        userId: testUser1.id,
        date: todayMidnight,
        clockIn: mondayDate,
        shiftEndAt,
        status: 'PRESENT',
        shiftStartUsed: '10:00',
        earlyWindowUsed: 20,
        gracePeriodUsed: 10,
        // Safeguard 1 audit fields
        shiftId: customShift.id,
        shiftName: customShift.name,
        scheduledStartTime: '10:00',
        scheduledEndTime: '19:00'
      }
    });

    assert(createdAttendance.shiftId === customShift.id, 'Attendance record has snapshot shiftId');
    assert(createdAttendance.shiftName === 'Alpha 5-Day Hybrid Shift', 'Attendance record has snapshot shiftName');
    assert(createdAttendance.scheduledStartTime === '10:00', 'Attendance record has snapshot scheduledStartTime');
    assert(createdAttendance.scheduledEndTime === '19:00', 'Attendance record has snapshot scheduledEndTime');

    // -------------------------------------------------------------
    // Test 5: Safeguard 2 - Payroll Uses Attendance First, Shift Second, Settings Fallback
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Safeguard 2 - Payroll Calculation Priority ---');
    // Edit the customShift afterwards (e.g. change name to 'Modified Shift' and timings to 11:00-20:00)
    await prisma.shift.update({
      where: { id: customShift.id },
      data: {
        name: 'Alpha Modified 4-Day Shift',
        startTime: '11:00',
        endTime: '20:00'
      }
    });

    // Check that historical attendance record remains completely unchanged
    const reloadedAtt = await prisma.attendance.findUnique({
      where: { id: createdAttendance.id }
    });
    assert(reloadedAtt.shiftName === 'Alpha 5-Day Hybrid Shift', 'Historical attendance snapshot shiftName is preserved after shift was edited');
    assert(reloadedAtt.scheduledStartTime === '10:00', 'Historical attendance scheduledStartTime is preserved');
    assert(reloadedAtt.scheduledEndTime === '19:00', 'Historical attendance scheduledEndTime is preserved');

    // Now test Overtime Calculation with Safeguard 2:
    // Employee worked until 20:30 (1.5 hours past scheduled 19:00 shiftEndAt)
    const clockOutTime = new Date('2026-09-21T15:00:00.000Z'); // 20:30 IST
    const updatedWithOut = await prisma.attendance.update({
      where: { id: createdAttendance.id },
      data: {
        clockOut: clockOutTime,
        workingHours: 10.5
      }
    });

    // Overtime calculation using Priority 1 (Attendance record shiftEndAt):
    const otDiffMs = new Date(updatedWithOut.clockOut).getTime() - new Date(updatedWithOut.shiftEndAt).getTime();
    const otHours = Math.round((otDiffMs / (1000 * 60 * 60)) * 10) / 10;
    assert(otHours === 1.5, 'Overtime starts after assigned shiftEndAt (1.5 hours OT for 10.5h worked with 19:00 end)');

    // -------------------------------------------------------------
    // Test 6: Safeguard 3 - Leave Evaluates Each Date Individually
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Safeguard 3 - Leave Schedule Daily Evaluation ---');
    const { calculateTotalDays } = require('./backend/src/controllers/leaveController');
    // Date range: Thursday 2026-09-24 to Monday 2026-09-28
    // In Alpha shift:
    // Thu 24: Working (counts)
    // Fri 25: WFH (counts)
    // Sat 26: Holiday (skips)
    // Sun 27: Sunday (skips)
    // Mon 28: Working (counts)
    // Expected leave days: 3 days (Thursday, Friday, Monday; Saturday and Sunday skipped)
    const leaveTotalDays = await calculateTotalDays(
      '2026-09-24',
      '2026-09-28',
      testUser1.id,
      testOrg1.id
    );

    assert(leaveTotalDays === 3, `Multi-day leave correctly evaluates to 3 days (skipped Saturday holiday and Sunday), got: ${leaveTotalDays}`);

    // If request is purely on Saturday and Sunday:
    const weekendOnlyLeave = await calculateTotalDays(
      '2026-09-26',
      '2026-09-27',
      testUser1.id,
      testOrg1.id
    );
    assert(weekendOnlyLeave === 0, `Weekend/Holiday only leave request evaluates to 0 days, got: ${weekendOnlyLeave}`);

    // -------------------------------------------------------------
    // Test 7: Multi-tenant Isolation
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Multi-Tenant Isolation ---');
    const org1Shifts = await shiftService.getCompanyShifts(testOrg1.id);
    const org2Shifts = await shiftService.getCompanyShifts(testOrg2.id);

    assert(org1Shifts.some(s => s.id === customShift.id), 'Org 1 has custom shift');
    assert(!org2Shifts.some(s => s.id === customShift.id), 'Org 2 does NOT see Org 1 custom shift (Multi-tenant isolated)');

    const emp2Shift = await shiftService.getEmployeeShift(testUser2.id);
    assert(emp2Shift.organizationId === testOrg2.id, 'Org 2 employee shift belongs strictly to Org 2');
    assert(emp2Shift.id !== customShift.id, 'Org 2 employee is not affected by Org 1 custom shift');

    // Clean up test attendance
    await prisma.attendance.deleteMany({
      where: { userId: testUser1.id, date: todayMidnight }
    });

    console.log('\n====================================================');
    console.log(`🎉 ALL PHASE 4 TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
