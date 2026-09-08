const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://127.0.0.1:5000/api';

async function verifyAllLogins() {
  console.log('====================================================');
  console.log('   AUTHENTICATION & LOGIN VERIFICATION SUITE       ');
  console.log('====================================================\n');

  try {
    // 1. Fetch all organizations
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: 'asc' }
    });

    let overallSuccess = true;

    for (const org of orgs) {
      console.log(`${org.name.toUpperCase()} (Slug: ${org.slug}, Code: ${org.companyCode})`);

      const users = await prisma.user.findMany({
        where: { organizationId: org.id },
        orderBy: { role: 'asc' }
      });

      for (const u of users) {
        // Determine test password candidates
        const passwordCandidates = [
          'password123',
          'Admin123!',
          `${org.companyCode}@2026`,
          'R001@2026',
          'INV01@2026'
        ];

        let loginSuccess = false;
        let successPass = '';
        let lastMessage = '';

        for (const pass of passwordCandidates) {
          try {
            const res = await axios.post(`${API_URL}/auth/login`, {
              userId: u.email,
              password: pass,
              organizationSlug: org.slug
            });

            if (res.data && res.data.token && res.data.user) {
              loginSuccess = true;
              successPass = pass;
              break;
            }
          } catch (err) {
            lastMessage = err.response?.data?.message || err.message;
          }
        }

        if (loginSuccess) {
          console.log(`  ✓ ${u.role} (${u.name} - ${u.email}) [Password: ${successPass}]`);
        } else {
          overallSuccess = false;
          console.log(`  ❌ ${u.role} (${u.name} - ${u.email}) - FAILED: ${lastMessage}`);
        }
      }
      console.log('');
    }

    // 2. Negative Test Cases Verification (Phase 7 & 8)
    console.log('NEGATIVE TEST CASES VERIFICATION:');

    // Case A: Wrong Password
    try {
      const activeUser = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
      await axios.post(`${API_URL}/auth/login`, {
        userId: activeUser.email,
        password: 'WrongPassword999!'
      });
      console.log('  ❌ Wrong Password test failed (expected HTTP 401 error, got 200 OK)');
      overallSuccess = false;
    } catch (err) {
      if (err.response?.status === 401 && err.response?.data?.message === 'Incorrect password.') {
        console.log('  ✓ Wrong Password returns 401 "Incorrect password."');
      } else {
        console.log(`  ❌ Wrong Password returned unexpected error: HTTP ${err.response?.status} - "${err.response?.data?.message}"`);
        overallSuccess = false;
      }
    }

    // Case B: Missing User
    try {
      await axios.post(`${API_URL}/auth/login`, {
        userId: 'nonexistentuser999999@domain.com',
        password: 'password123'
      });
      console.log('  ❌ Missing User test failed (expected HTTP 404 error, got 200 OK)');
      overallSuccess = false;
    } catch (err) {
      if (err.response?.status === 404 && err.response?.data?.message === 'Account not found.') {
        console.log('  ✓ Missing User returns 404 "Account not found."');
      } else {
        console.log(`  ❌ Missing User returned unexpected error: HTTP ${err.response?.status} - "${err.response?.data?.message}"`);
        overallSuccess = false;
      }
    }

    // Case C: Inactive User
    const inactiveUser = await prisma.user.findFirst({ where: { status: 'INACTIVE' } });
    if (inactiveUser) {
      try {
        await axios.post(`${API_URL}/auth/login`, {
          userId: inactiveUser.email,
          password: 'password123'
        });
        console.log('  ❌ Inactive User test failed (expected HTTP 403 error, got 200 OK)');
        overallSuccess = false;
      } catch (err) {
        if (err.response?.status === 403 && err.response?.data?.message === 'Account disabled.') {
          console.log('  ✓ Inactive User returns 403 "Account disabled."');
        } else {
          console.log(`  ❌ Inactive User returned unexpected error: HTTP ${err.response?.status} - "${err.response?.data?.message}"`);
          overallSuccess = false;
        }
      }
    } else {
      console.log('  ℹ️ Creating temporary INACTIVE user to verify 403 response...');
      const testOrg = await prisma.organization.findFirst();
      const tempUser = await prisma.user.create({
        data: {
          name: 'Test Inactive User',
          email: 'test_inactive_temp_check@domain.com',
          employeeId: 'EMP_INACTIVE_TEST',
          password: '$2b$10$wT0Xk123456789012345678901234567890123456789012345678', // mock hash
          role: 'EMPLOYEE',
          status: 'INACTIVE',
          organizationId: testOrg.id
        }
      });

      try {
        await axios.post(`${API_URL}/auth/login`, {
          userId: tempUser.email,
          password: 'password123'
        });
        console.log('  ❌ Inactive User test failed (expected HTTP 403 error, got 200 OK)');
        overallSuccess = false;
      } catch (err) {
        if (err.response?.status === 403 && err.response?.data?.message === 'Account disabled.') {
          console.log('  ✓ Inactive User returns 403 "Account disabled."');
        } else {
          console.log(`  ❌ Inactive User returned unexpected error: HTTP ${err.response?.status} - "${err.response?.data?.message}"`);
          overallSuccess = false;
        }
      } finally {
        await prisma.user.delete({ where: { id: tempUser.id } });
      }
    }

    console.log('\n====================================================');
    if (overallSuccess) {
      console.log('   🎉 ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY!  ');
    } else {
      console.log('   ⚠️ SOME AUTHENTICATION TESTS FAILED. CHECK LOGS.  ');
    }
    console.log('====================================================\n');

    process.exit(overallSuccess ? 0 : 1);
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAllLogins();
