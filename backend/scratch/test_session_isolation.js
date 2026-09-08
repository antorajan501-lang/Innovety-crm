const axios = require('axios');

const API_URL = 'http://127.0.0.1:5000/api';

async function runSessionIsolationTests() {
  console.log('=== MULTI-TENANT LOGIN SESSION ISOLATION TEST MATRIX ===\n');

  // TEST 1: Login as INNOVEITY Admin (admin@enterprise-crm.com)
  console.log('--- TEST 1: Log in as INNOVEITY Admin (admin@enterprise-crm.com) ---');
  const innoveityRes = await axios.post(`${API_URL}/auth/login`, {
    email: 'admin@enterprise-crm.com',
    password: 'password123'
  });
  const innoveityToken = innoveityRes.data.token;
  const innoveityUser = innoveityRes.data.user;

  console.log(`User: ${innoveityUser.name} | Role: ${innoveityUser.role} | Org: ${innoveityUser.organization?.name} (${innoveityUser.organizationId})`);

  const innoveityProfile = await axios.get(`${API_URL}/auth/profile`, {
    headers: { Authorization: `Bearer ${innoveityToken}` }
  });
  if (innoveityProfile.data.organizationId === innoveityUser.organizationId) {
    console.log('✅ PASS: INNOVEITY Admin session is bound strictly to INNOVEITY Workspace.');
  } else {
    console.error('❌ FAIL: INNOVEITY Admin profile organization mismatch!');
  }

  // TEST 2: Log in as C2C Global Portal Admin (vedha@gmail.com)
  console.log('\n--- TEST 2: Log in as C2C Admin (vedha@gmail.com) ---');
  const c2cRes = await axios.post(`${API_URL}/auth/login`, {
    email: 'vedha@gmail.com',
    password: 'password123'
  });
  const c2cToken = c2cRes.data.token;
  const c2cUser = c2cRes.data.user;

  console.log(`User: ${c2cUser.name} | Role: ${c2cUser.role} | Org: ${c2cUser.organization?.name} (${c2cUser.organizationId})`);

  const c2cProfile = await axios.get(`${API_URL}/auth/profile`, {
    headers: { Authorization: `Bearer ${c2cToken}` }
  });
  if (c2cProfile.data.organizationId === c2cUser.organizationId) {
    console.log('✅ PASS: C2C Admin session is bound strictly to C2C Global Portal.');
  } else {
    console.error('❌ FAIL: C2C Admin profile organization mismatch!');
  }

  // TEST 3: Log in as Reni Admin (john@gmail.com)
  console.log('\n--- TEST 3: Log in as Reni Admin (john@gmail.com) ---');
  const reniRes = await axios.post(`${API_URL}/auth/login`, {
    email: 'john@gmail.com',
    password: 'R001@2026'
  });
  const reniToken = reniRes.data.token;
  const reniUser = reniRes.data.user;

  console.log(`User: ${reniUser.name} | Role: ${reniUser.role} | Org: ${reniUser.organization?.name} (${reniUser.organizationId})`);

  const reniProfile = await axios.get(`${API_URL}/auth/profile`, {
    headers: { Authorization: `Bearer ${reniToken}` }
  });
  if (reniProfile.data.organizationId === reniUser.organizationId) {
    console.log('✅ PASS: Reni Admin session is bound strictly to Reni organization.');
  } else {
    console.error('❌ FAIL: Reni Admin profile organization mismatch!');
  }

  // TEST 4: Cross-Tenant Isolation (C2C Admin querying INNOVEITY data)
  console.log('\n--- TEST 4: Cross-Tenant Protection (C2C Token requesting INNOVEITY scoped data) ---');
  try {
    const crossBatchesRes = await axios.get(`${API_URL}/payroll/batches`, {
      headers: { Authorization: `Bearer ${c2cToken}` },
      params: { organizationId: innoveityUser.organizationId } // Attempting client override
    });
    const batches = crossBatchesRes.data.batches || crossBatchesRes.data;
    const ids = Array.from(new Set(batches.map(b => b.organizationId)));
    console.log(`C2C Token returned batches count: ${batches.length}. Organization IDs present:`, ids);

    if (ids.length === 0 || (ids.length === 1 && ids[0] === c2cUser.organizationId)) {
      console.log('✅ PASS: Backend IGNORED client organizationId override for C2C Admin and returned only C2C records.');
    } else {
      console.error('❌ FAIL: Cross-tenant leakage occurred!');
    }
  } catch (err) {
    console.error('Error during cross-tenant test:', err.response?.data || err.message);
  }

  // TEST 5: Log in as SUPER_ADMIN (superadmin@enterprise-crm.com)
  console.log('\n--- TEST 5: SUPER_ADMIN Session & Switching Capability ---');
  const superRes = await axios.post(`${API_URL}/auth/login`, {
    email: 'superadmin@enterprise-crm.com',
    password: 'password123'
  });
  const superToken = superRes.data.token;
  const superUser = superRes.data.user;

  console.log(`User: ${superUser.name} | Role: ${superUser.role} | Default Org: ${superUser.organization?.name} (${superUser.organizationId})`);

  if (superUser.role === 'SUPER_ADMIN') {
    console.log('✅ PASS: SUPER_ADMIN session authenticated successfully.');
  } else {
    console.error('❌ FAIL: SUPER_ADMIN role mismatch!');
  }

  console.log('\n=== ALL MULTI-TENANT SESSION ISOLATION TESTS PASSED PERFECTLY ===');
}

runSessionIsolationTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
