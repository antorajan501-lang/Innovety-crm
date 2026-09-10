const axios = require('axios');
const prisma = require('../src/utils/db');
const bcrypt = require('bcrypt');

const BASE_URL = 'http://localhost:5000/api';

async function runFullLeaveSuiteVerification() {
  console.log('================================================================');
  console.log('       INNOVEITY CRM — COMPREHENSIVE LEAVE VERIFICATION SUITE   ');
  console.log('================================================================\n');

  // Set predictable passwords for test accounts
  const passHash = await bcrypt.hash('Password123!', 10);

  const testEmails = [
    'employee@gmail.com',
    'antorajan501@gmail.com',
    'somusuraj72@gmail.com',
    'preethi@gmail.com',
    'admin@enterprise-crm.com',
    'superadmin@enterprise-crm.com'
  ];

  await prisma.user.updateMany({
    where: { email: { in: testEmails } },
    data: { password: passHash }
  });

  const scenarios = [
    // 1. Employee - Casual Multi-Day
    {
      label: 'INNOVEITY Employee — Casual Multi-Day Leave',
      email: 'employee@gmail.com',
      role: 'EMPLOYEE',
      payload: {
        leaveType: 'CASUAL',
        startDate: '2026-10-01',
        endDate: '2026-10-03',
        isHalfDay: false,
        reason: 'Casual family function leave',
        contactPhone: '9876543210'
      },
      expectedStatus: 201
    },
    // 2. Employee - Sick Half-Day
    {
      label: 'INNOVEITY Employee — Sick Half-Day Leave',
      email: 'employee@gmail.com',
      role: 'EMPLOYEE',
      payload: {
        leaveType: 'SICK',
        startDate: '2026-10-05',
        endDate: '2026-10-05',
        isHalfDay: true,
        reason: 'Doctor appointment morning half-day',
        contactPhone: '9876543210'
      },
      expectedStatus: 201
    },
    // 3. Employee - WFH
    {
      label: 'INNOVEITY Employee — Work From Home (WFH)',
      email: 'employee@gmail.com',
      role: 'EMPLOYEE',
      payload: {
        leaveType: 'WFH',
        startDate: '2026-10-08',
        endDate: '2026-10-08',
        isHalfDay: false,
        reason: 'Working remotely due to home maintenance'
      },
      expectedStatus: 201
    },
    // 4. Intern - Casual Leave
    {
      label: 'INNOVEITY Intern — Casual Leave',
      email: 'antorajan501@gmail.com',
      role: 'INTERN',
      payload: {
        leaveType: 'CASUAL',
        startDate: '2026-10-10',
        endDate: '2026-10-11',
        isHalfDay: false,
        reason: 'Personal urgent leave'
      },
      expectedStatus: 201
    },
    // 5. Team Leader - Sick Leave
    {
      label: 'INNOVEITY Team Leader — Sick Leave',
      email: 'somusuraj72@gmail.com',
      role: 'TEAM_LEADER',
      payload: {
        leaveType: 'SICK',
        startDate: '2026-10-12',
        endDate: '2026-10-13',
        isHalfDay: false,
        reason: 'Fever rest'
      },
      expectedStatus: 201
    },
    // 6. C2C Intern - Casual Leave
    {
      label: 'C2C Global Portal Intern — Casual Leave',
      email: 'preethi@gmail.com',
      role: 'INTERN',
      payload: {
        leaveType: 'CASUAL',
        startDate: '2026-10-15',
        endDate: '2026-10-15',
        isHalfDay: false,
        reason: 'College exam'
      },
      expectedStatus: 201
    },
    // 7. Negative Test: Admin Apply Leave
    {
      label: 'Negative Security Test — Admin Apply Leave Attempt',
      email: 'admin@enterprise-crm.com',
      role: 'ADMIN',
      payload: {
        leaveType: 'CASUAL',
        startDate: '2026-10-20',
        endDate: '2026-10-21',
        reason: 'Admin trying to apply leave'
      },
      expectedStatus: 403
    },
    // 8. Negative Test: Super Admin Apply Leave
    {
      label: 'Negative Security Test — Super Admin Apply Leave Attempt',
      email: 'superadmin@enterprise-crm.com',
      role: 'SUPER_ADMIN',
      payload: {
        leaveType: 'CASUAL',
        startDate: '2026-10-20',
        endDate: '2026-10-21',
        reason: 'Super Admin trying to apply leave'
      },
      expectedStatus: 403
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const s of scenarios) {
    console.log(`Testing: ${s.label}`);
    try {
      const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        email: s.email,
        password: 'Password123!'
      });
      const token = loginRes.data.token;

      const leaveRes = await axios.post(`${BASE_URL}/leaves`, s.payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (leaveRes.status === s.expectedStatus) {
        console.log(`  ✅ PASS (HTTP ${leaveRes.status}) - ID: ${leaveRes.data.id || 'N/A'}, Status: ${leaveRes.data.status}`);
        passed++;
      } else {
        console.log(`  ❌ FAIL (Expected HTTP ${s.expectedStatus}, got ${leaveRes.status})`);
        failed++;
      }
    } catch (err) {
      const actualStatus = err.response?.status;
      if (actualStatus === s.expectedStatus) {
        console.log(`  ✅ PASS (Expected HTTP ${s.expectedStatus}, got ${actualStatus}) - Msg: "${err.response?.data?.message}"`);
        passed++;
      } else {
        console.log(`  ❌ FAIL (Expected HTTP ${s.expectedStatus}, got ${actualStatus || err.message})`);
        console.log(`     Error body:`, err.response?.data);
        failed++;
      }
    }
    console.log('');
  }

  console.log('================================================================');
  console.log(`SUITE COMPLETE: Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  await prisma.$disconnect();
}

runFullLeaveSuiteVerification();
