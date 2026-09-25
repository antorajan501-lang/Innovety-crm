const http = require('http');
const jwt = require('jsonwebtoken');
const prisma = require('../src/utils/db');
const { provisionOrganizationWorkspace } = require('../src/services/organizationProvisioningService');
const shiftService = require('../src/services/shiftService');

const JWT_SECRET = process.env.JWT_SECRET || 'enterprise_internship_crm_super_secret_jwt_key_123!';

async function makeRequest(token, method, queryPath, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: queryPath,
      method: method.toUpperCase(),
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runVerification() {
  console.log('====================================================');
  console.log('PHASE 1: SHIFT MANAGEMENT FOUNDATION VERIFICATION');
  console.log('====================================================\n');

  // 1. Verify Database Models & Existing Organizations
  console.log('[1] Verifying Shift & ShiftMember database tables...');
  const shiftsCount = await prisma.shift.count();
  const membersCount = await prisma.shiftMember.count();
  console.log(` - Shifts count in database: ${shiftsCount}`);
  console.log(` - ShiftMember assignments: ${membersCount}`);

  if (shiftsCount === 0) {
    throw new Error('FAIL: No shifts found in database.');
  }

  // 2. Verify Default Shifts for Existing Organizations
  console.log('\n[2] Verifying Company Default shift properties...');
  const defaultShifts = await prisma.shift.findMany({
    where: { name: 'Company Default' },
    include: { _count: { select: { members: true } } }
  });

  console.log(` - Found ${defaultShifts.length} default shift(s):`);
  for (const ds of defaultShifts) {
    console.log(`   * Shift ID: ${ds.id} | Org: ${ds.organizationId} | Start: ${ds.startTime} | End: ${ds.endTime} | Members: ${ds._count.members}`);
    if (ds.startTime !== '09:00' || ds.endTime !== '18:00' || ds.status !== 'ACTIVE') {
      throw new Error(`FAIL: Invalid default shift configuration for ${ds.id}`);
    }
  }

  // 3. Test Provisioning: Create Company with Auto-Shift Provisioning
  console.log('\n[3] Testing Company Creation with Auto Default Shift...');
  const testCompanyCode = 'SHIFTCO1';
  const testAdminEmail = 'admin@shiftco1.com';

  // Cleanup old test org if exists
  const existingOrg = await prisma.organization.findUnique({ where: { companyCode: testCompanyCode } });
  if (existingOrg) {
    await prisma.user.deleteMany({ where: { organizationId: existingOrg.id } });
    await prisma.shiftMember.deleteMany({ where: { shift: { organizationId: existingOrg.id } } });
    await prisma.shift.deleteMany({ where: { organizationId: existingOrg.id } });
    await prisma.organizationSettings.deleteMany({ where: { organizationId: existingOrg.id } });
    await prisma.organization.delete({ where: { id: existingOrg.id } });
  }

  const provResult = await provisionOrganizationWorkspace({
    name: 'Shift Test Corporation',
    companyCode: testCompanyCode,
    email: 'contact@shiftco1.com',
    adminName: 'Shift Admin',
    adminEmail: testAdminEmail,
    adminEmployeeId: 'SHT-101'
  });

  console.log(` - Company created: ${provResult.organization.name} (${provResult.organization.id})`);
  
  // Verify default shift was created during provisioning
  const provShift = await prisma.shift.findFirst({
    where: { organizationId: provResult.organization.id, name: 'Company Default' }
  });

  if (!provShift) {
    throw new Error('FAIL: Default shift was not created during company provisioning.');
  }
  console.log(` - Auto-created default shift: "${provShift.name}" (${provShift.id})`);

  // Verify created admin is assigned to default shift
  const adminShiftMember = await prisma.shiftMember.findUnique({
    where: { userId: provResult.admin.id },
    include: { shift: true }
  });

  if (!adminShiftMember || adminShiftMember.shiftId !== provShift.id) {
    throw new Error('FAIL: Admin user was not assigned to default shift.');
  }
  console.log(` - Admin member assigned to shift: ${adminShiftMember.shift.name} (PASS)`);

  // 4. Test API Endpoints
  console.log('\n[4] Testing /api/shifts REST Endpoints...');
  const adminUser = await prisma.user.findUnique({ where: { email: testAdminEmail } });
  const adminToken = jwt.sign(
    { id: adminUser.id, role: adminUser.role, organizationId: adminUser.organizationId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // A. GET /api/shifts
  const getShiftsRes = await makeRequest(adminToken, 'GET', `/api/shifts?organizationId=${adminUser.organizationId}`);
  console.log(` - GET /api/shifts -> HTTP ${getShiftsRes.status} (Found ${getShiftsRes.body.count} shift(s))`);
  if (getShiftsRes.status !== 200 || getShiftsRes.body.count < 1) {
    throw new Error('FAIL: GET /api/shifts failed.');
  }

  // B. POST /api/shifts (Create Custom Shift)
  const createShiftRes = await makeRequest(adminToken, 'POST', '/api/shifts', {
    name: 'Night Shift',
    startTime: '21:00',
    endTime: '05:00',
    organizationId: adminUser.organizationId
  });
  console.log(` - POST /api/shifts -> HTTP ${createShiftRes.status} (Created "${createShiftRes.body.shift?.name}")`);
  if (createShiftRes.status !== 201) {
    throw new Error('FAIL: POST /api/shifts failed.');
  }
  const customShiftId = createShiftRes.body.shift.id;

  // C. GET /api/shifts/my-shift
  const getMyShiftRes = await makeRequest(adminToken, 'GET', '/api/shifts/my-shift');
  console.log(` - GET /api/shifts/my-shift -> HTTP ${getMyShiftRes.status} (My Shift: "${getMyShiftRes.body.shift?.name}")`);
  if (getMyShiftRes.status !== 200 || getMyShiftRes.body.shift?.name !== 'Company Default') {
    throw new Error('FAIL: GET /api/shifts/my-shift failed.');
  }

  // D. PUT /api/shifts/:id
  const updateShiftRes = await makeRequest(adminToken, 'PUT', `/api/shifts/${customShiftId}`, {
    name: 'Rotational Night Shift',
    startTime: '22:00'
  });
  console.log(` - PUT /api/shifts/:id -> HTTP ${updateShiftRes.status} (Updated name to "${updateShiftRes.body.shift?.name}")`);
  if (updateShiftRes.status !== 200) {
    throw new Error('FAIL: PUT /api/shifts/:id failed.');
  }

  // E. DELETE /api/shifts/:id
  const deleteShiftRes = await makeRequest(adminToken, 'DELETE', `/api/shifts/${customShiftId}`);
  console.log(` - DELETE /api/shifts/:id -> HTTP ${deleteShiftRes.status} (${deleteShiftRes.body.message})`);
  if (deleteShiftRes.status !== 200) {
    throw new Error('FAIL: DELETE /api/shifts/:id failed.');
  }

  // 5. Cleanup Test Company
  console.log('\n[5] Cleaning up test organization...');
  await prisma.user.deleteMany({ where: { organizationId: provResult.organization.id } });
  await prisma.shiftMember.deleteMany({ where: { shift: { organizationId: provResult.organization.id } } });
  await prisma.shift.deleteMany({ where: { organizationId: provResult.organization.id } });
  await prisma.organizationSettings.deleteMany({ where: { organizationId: provResult.organization.id } });
  await prisma.organization.delete({ where: { id: provResult.organization.id } });
  console.log(' - Test organization cleaned up successfully.');

  // 6. Regression Verification: Core Modules Unchanged
  console.log('\n[6] Running Regression Check on Core Modules...');
  const saUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const saToken = jwt.sign(
    { id: saUser.id, role: saUser.role, organizationId: saUser.organizationId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const regCheckModules = [
    { name: 'Attendance Status', path: '/api/attendance/status' },
    { name: 'Dashboard Overview', path: `/api/dashboard/overview?organizationId=${saUser.organizationId}` },
    { name: 'Leaves API', path: `/api/leaves?organizationId=${saUser.organizationId}` },
    { name: 'Platform Settings', path: '/api/platform/settings' }
  ];

  for (const mod of regCheckModules) {
    const res = await makeRequest(saToken, 'GET', mod.path);
    const pass = res.status === 200 || res.status === 304;
    console.log(` - Regression [${mod.name}] -> HTTP ${res.status} (${pass ? 'PASS' : 'FAIL'})`);
    if (!pass) throw new Error(`FAIL: Regression check failed on ${mod.name}`);
  }

  console.log('\n====================================================');
  console.log('ALL PHASE 1 FOUNDATION TESTS PASSED (100%)');
  console.log('====================================================');
}

runVerification()
  .catch(err => {
    console.error('\nVERIFICATION ERROR:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
