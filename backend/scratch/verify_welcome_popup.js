const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://127.0.0.1:5000/api';

async function verifyWelcomePopupFlow() {
  console.log('====================================================');
  console.log('   WELCOME POPUP (FIRST LOGIN ONLY) TEST SUITE     ');
  console.log('====================================================\n');

  try {
    // 1. Find a test user (e.g. Employee or Intern or Admin)
    const testUser = await prisma.user.findFirst({
      where: { email: 'nancythomasselva@gmail.com' }
    });

    if (!testUser) {
      console.error('❌ Test user nancythomasselva@gmail.com not found!');
      process.exit(1);
    }

    console.log(`Test User: ${testUser.name} (${testUser.email})`);

    // Reset user welcomePopupSeen to false initially
    await prisma.user.update({
      where: { id: testUser.id },
      data: { welcomePopupSeen: false }
    });

    console.log('Initial DB State: welcomePopupSeen = false');

    // 2. Login to get JWT Token & user object
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      userId: testUser.email,
      password: 'password123'
    });

    const { token, user } = loginRes.data;
    console.log(`✓ Login Response includes welcomePopupSeen: ${user.welcomePopupSeen}`);

    if (user.welcomePopupSeen !== false) {
      console.error('❌ Expected welcomePopupSeen to be false on first login!');
      process.exit(1);
    }

    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 3. Test POST /api/users/me/welcome-complete
    console.log('\nTesting POST /api/users/me/welcome-complete ...');
    const completeRes = await axios.post(`${API_URL}/users/me/welcome-complete`, {}, authHeaders);

    console.log(`✓ Endpoint Response Status: ${completeRes.status}`);
    console.log(`✓ Returned user.welcomePopupSeen: ${completeRes.data.user?.welcomePopupSeen}`);

    // Verify DB update
    const dbUserAfterComplete = await prisma.user.findUnique({ where: { id: testUser.id } });
    if (dbUserAfterComplete.welcomePopupSeen !== true) {
      console.error('❌ DB verify failed: welcomePopupSeen is not true after completion endpoint!');
      process.exit(1);
    }
    console.log('✓ DB Verified: welcomePopupSeen is now TRUE');

    // 4. Test Login again after completion
    const loginRes2 = await axios.post(`${API_URL}/auth/login`, {
      userId: testUser.email,
      password: 'password123'
    });
    console.log(`✓ Subsequent Login Response user.welcomePopupSeen: ${loginRes2.data.user?.welcomePopupSeen}`);
    if (loginRes2.data.user?.welcomePopupSeen !== true) {
      console.error('❌ Expected subsequent login to return welcomePopupSeen = true!');
      process.exit(1);
    }

    // 5. Test Admin Reset: POST /api/admin/users/:id/reset-welcome
    // Login as Admin
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN', status: 'ACTIVE' }
    });

    const adminLogin = await axios.post(`${API_URL}/auth/login`, {
      userId: adminUser.email,
      password: 'password123'
    });
    const adminAuthHeaders = { headers: { Authorization: `Bearer ${adminLogin.data.token}` } };

    console.log(`\nTesting Admin Reset POST /api/admin/users/${testUser.id}/reset-welcome ...`);
    const resetRes = await axios.post(`${API_URL}/admin/users/${testUser.id}/reset-welcome`, {}, adminAuthHeaders);

    console.log(`✓ Reset Endpoint Status: ${resetRes.status}`);
    console.log(`✓ Returned user.welcomePopupSeen: ${resetRes.data.user?.welcomePopupSeen}`);

    // Verify DB reset
    const dbUserAfterReset = await prisma.user.findUnique({ where: { id: testUser.id } });
    if (dbUserAfterReset.welcomePopupSeen !== false) {
      console.error('❌ DB verify failed: welcomePopupSeen is not false after admin reset!');
      process.exit(1);
    }
    console.log('✓ DB Verified: welcomePopupSeen is reset to FALSE');

    // Re-complete for clean test state
    await prisma.user.update({
      where: { id: testUser.id },
      data: { welcomePopupSeen: true }
    });

    console.log('\n====================================================');
    console.log('   🎉 ALL WELCOME POPUP TESTS PASSED 100%!           ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Verification script error:', err.response?.data || err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyWelcomePopupFlow();
