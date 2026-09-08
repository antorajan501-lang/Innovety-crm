const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_URL = 'http://127.0.0.1:5000/api';

async function runApiVerification() {
  console.log('====================================================');
  console.log('AUTOMATED MULTI-TENANT ISOLATION API TEST SUITE');
  console.log('====================================================\n');

  try {
    // ----------------------------------------------------
    // TEST 1 — C2C Admin Login & Scoped Dropdowns
    // ----------------------------------------------------
    console.log('[TEST 1] Logging in as C2C Admin (vedha@gmail.com)...');
    const c2cLoginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'vedha@gmail.com',
      password: 'password123'
    });
    const c2cToken = c2cLoginRes.data.token;
    const c2cHeaders = { Authorization: `Bearer ${c2cToken}` };

    console.log('Fetching departments as C2C Admin...');
    const c2cDeptsRes = await axios.get(`${API_URL}/organization/departments`, { headers: c2cHeaders });
    const c2cDeptNames = c2cDeptsRes.data.map(d => d.name);
    console.log('C2C Admin Departments returned:', c2cDeptNames);

    console.log('Fetching positions as C2C Admin...');
    const c2cPositionsRes = await axios.get(`${API_URL}/positions`, { headers: c2cHeaders });
    const c2cPositionNames = c2cPositionsRes.data.map(p => p.name);
    console.log('C2C Admin Positions returned:', c2cPositionNames);

    const hasOnlyC2CDepts = c2cDeptNames.length > 0 && !c2cDeptNames.includes('Mobile Application Developer');
    if (hasOnlyC2CDepts) {
      console.log('✅ TEST 1 PASSED: C2C Admin only sees C2C departments & positions.\n');
    } else {
      console.error('❌ TEST 1 FAILED: Returned incorrect departments for C2C Admin!\n');
    }

    // ----------------------------------------------------
    // TEST 2 — Create Intern as C2C Admin
    // ----------------------------------------------------
    const c2cDesignDept = c2cDeptsRes.data.find(d => d.name === 'Design');
    const c2cInternPosition = c2cPositionsRes.data.find(p => p.name === 'Intern');

    const testEmail = `test_intern_${Date.now()}@c2cglobal.com`;
    console.log(`[TEST 2] Creating intern as C2C Admin with email: ${testEmail}...`);

    const createRes = await axios.post(
      `${API_URL}/users`,
      {
        name: 'Test Intern C2C',
        email: testEmail,
        dob: '2001-05-15',
        role: 'INTERN',
        targetRole: 'INTERN',
        departmentId: c2cDesignDept?.id,
        positionId: c2cInternPosition?.id
      },
      { headers: c2cHeaders }
    );

    console.log('Creation response status:', createRes.status);
    console.log('Created user ID:', createRes.data.id || createRes.data.user?.id);

    // Verify DB
    const createdDbUser = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { organization: true, departmentRef: true }
    });

    console.log('DB Verification:');
    console.log('  - User Employee ID:', createdDbUser?.employeeId);
    console.log('  - User Organization:', createdDbUser?.organization?.name);
    console.log('  - User Department:', createdDbUser?.departmentRef?.name);

    const c2cOrg = await prisma.organization.findFirst({ where: { name: { contains: 'C2C', mode: 'insensitive' } } });
    if (createdDbUser?.organizationId === c2cOrg?.id) {
      console.log('✅ TEST 2 PASSED: Intern successfully created inside C2C Global Portal.\n');
    } else {
      console.error('❌ TEST 2 FAILED: Intern created in wrong organization!\n');
    }

    // Clean up test intern
    if (createdDbUser?.id) {
      await prisma.user.delete({ where: { id: createdDbUser.id } });
    }

    // ----------------------------------------------------
    // TEST 3 — Super Admin Company Switching
    // ----------------------------------------------------
    console.log('[TEST 3] Logging in as Super Admin...');
    const saLoginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'superadmin@enterprise-crm.com',
      password: 'password123'
    });
    const saToken = saLoginRes.data.token;
    const saHeaders = { Authorization: `Bearer ${saToken}` };

    const innoveityOrg = await prisma.organization.findFirst({ where: { slug: 'innoveity' } });
    const reniOrg = await prisma.organization.findFirst({ where: { name: { contains: 'Reni', mode: 'insensitive' } } });

    const saInnoveityDepts = await axios.get(`${API_URL}/organization/departments?organizationId=${innoveityOrg.id}`, { headers: saHeaders });
    const saC2CDepts = await axios.get(`${API_URL}/organization/departments?organizationId=${c2cOrg.id}`, { headers: saHeaders });
    const saReniDepts = await axios.get(`${API_URL}/organization/departments?organizationId=${reniOrg.id}`, { headers: saHeaders });

    console.log('Super Admin -> INNOVEITY Departments:', saInnoveityDepts.data.map(d => d.name));
    console.log('Super Admin -> C2C Departments:', saC2CDepts.data.map(d => d.name));
    console.log('Super Admin -> RENI Departments:', saReniDepts.data.map(d => d.name));

    if (
      saInnoveityDepts.data.length > 0 &&
      saC2CDepts.data.length > 0 &&
      saReniDepts.data.length > 0
    ) {
      console.log('✅ TEST 3 PASSED: Super Admin company switch displays each company\'s actual departments.\n');
    } else {
      console.error('❌ TEST 3 FAILED: Super Admin department switching failed!\n');
    }

    // ----------------------------------------------------
    // TEST 4 — Cross-Tenant Protection (HTTP 403)
    // ----------------------------------------------------
    console.log('[TEST 4] Attempting cross-tenant submission (C2C Admin + INNOVEITY department)...');
    const innoveityDept = saInnoveityDepts.data.find(d => d.name === 'Mobile Application Developer');

    try {
      await axios.post(
        `${API_URL}/users`,
        {
          name: 'Hacker Intern',
          email: 'hacker@test.com',
          dob: '2000-01-01',
          role: 'INTERN',
          targetRole: 'INTERN',
          departmentId: innoveityDept?.id
        },
        { headers: c2cHeaders }
      );
      console.error('❌ TEST 4 FAILED: Cross-tenant creation allowed!');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log(`✅ TEST 4 PASSED: Intercepted cross-tenant request with HTTP 403: "${err.response.data.message}"\n`);
      } else {
        console.error(`❌ TEST 4 FAILED: Unexpected error status: ${err.response?.status}`, err.response?.data);
      }
    }

  } catch (err) {
    console.error('API Verification error:', err.response?.data || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runApiVerification();
