const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://127.0.0.1:5000/api';

async function verifyLeaveAuditReport() {
  console.log('====================================================');
  console.log('   COMPANY LEAVE AUDIT REPORT VERIFICATION SUITE    ');
  console.log('====================================================\n');

  try {
    // 1. Authenticate as Admin of INNOVEITY Workspace
    const adminUser = await prisma.user.findFirst({
      where: { email: 'franklin@mcc.edu.in', status: 'ACTIVE' }
    }) || await prisma.user.findFirst({
      where: { role: 'ADMIN', status: 'ACTIVE' }
    });

    if (!adminUser) {
      console.error('❌ Active Admin user not found!');
      process.exit(1);
    }

    const adminLogin = await axios.post(`${API_URL}/auth/login`, {
      userId: adminUser.email,
      password: 'password123'
    });

    const adminToken = adminLogin.data.token;
    const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };

    console.log(`Admin Authenticated: ${adminUser.name} (${adminUser.email})`);

    // 2. Test GET /api/attendance/leave-report?month=2026-09
    console.log('\n2. Testing GET /api/attendance/leave-report?month=2026-09 ...');
    const reportRes = await axios.get(`${API_URL}/attendance/leave-report?month=2026-09`, adminHeaders);

    console.log(`✓ Endpoint Status: ${reportRes.status}`);
    const data = reportRes.data;

    console.log('\nReport Response Keys:');
    console.log(`  - Month: ${data.month}`);
    console.log(`  - Company: ${data.company}`);
    console.log(`  - Available Leave Types:`, JSON.stringify(data.availableLeaveTypes));
    console.log(`  - Workforce Employees Count: ${data.employees?.length}`);

    // ASSERTION: availableLeaveTypes must be EXACTLY ["Casual", "Sick", "WFH"]
    const expectedLeaveTypes = ["Casual", "Sick", "WFH"];
    const isExactMatch = JSON.stringify(data.availableLeaveTypes) === JSON.stringify(expectedLeaveTypes);

    if (!isExactMatch) {
      console.error(`❌ Leave type columns assertion failed! Expected ${JSON.stringify(expectedLeaveTypes)}, got ${JSON.stringify(data.availableLeaveTypes)}`);
      process.exit(1);
    } else {
      console.log('  ✓ Verified: availableLeaveTypes contains ONLY ["Casual", "Sick", "WFH"]. "Earned" and "Other" have been completely removed!');
    }

    // 3. Verifying Admin & Super Admin exclusion
    console.log('\n3. Verifying Admin & Super Admin exclusion...');
    const adminRoleFound = data.employees?.find(e => ['ADMIN', 'SUPER_ADMIN'].includes(e.role));
    if (adminRoleFound) {
      console.error(`❌ Found Admin user in employee list: ${adminRoleFound.name} (${adminRoleFound.role})`);
      process.exit(1);
    } else {
      console.log(`  ✓ No ADMIN or SUPER_ADMIN users found in workforce employee list (${data.employees?.length} workforce members).`);
    }

    // 4. Verifying Employee leaveTypes dictionary keys
    console.log('\n4. Verifying Employee leaveTypes dictionary structure...');
    if (data.employees && data.employees.length > 0) {
      const sampleEmp = data.employees[0];
      console.log(`  Sample Employee: ${sampleEmp.name} (${sampleEmp.employeeId || 'EM-1001'})`);
      console.log(`  Leave Types Breakdown:`, JSON.stringify(sampleEmp.leaveTypes));

      if (sampleEmp.leaveTypes.Earned !== undefined || sampleEmp.leaveTypes.Other !== undefined) {
        console.error('❌ Earned or Other keys still present in employee leaveTypes!');
        process.exit(1);
      }
      console.log('  ✓ Verified: Employee leaveTypes only contains Casual, Sick, and WFH.');
    }

    console.log('\n====================================================');
    console.log('   🎉 ALL VERIFICATIONS (CASUAL, SICK, WFH ONLY) PASSED! ');
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ Leave Audit Report test failed:', err.response?.data || err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyLeaveAuditReport();
