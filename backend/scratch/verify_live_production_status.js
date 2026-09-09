const axios = require('axios');

const PROD_DOMAIN = 'https://crm.innoveity.tech';
const PROD_API = 'https://crm.innoveity.tech/api';

async function verifyProduction() {
  console.log('================================================================');
  console.log('  LIVE PRODUCTION SERVER ENDPOINT & RESPONSE VERIFICATION');
  console.log('  Domain: https://crm.innoveity.tech');
  console.log('================================================================\n');

  const results = {
    endpoints: [],
    sshStatus: 'UNAVAILABLE'
  };

  // 1. Health Probe
  try {
    const healthRes = await axios.get(`${PROD_DOMAIN}/health`, { timeout: 8000 });
    console.log(`[PROD PROBE 1] GET ${PROD_DOMAIN}/health -> HTTP ${healthRes.status}`);
    console.log(`               Content-Type: ${healthRes.headers['content-type']}`);
    results.endpoints.push({ name: '/health', status: healthRes.status, type: 'HTML/Web App' });
  } catch (err) {
    console.log(`[PROD PROBE 1] GET ${PROD_DOMAIN}/health -> HTTP ${err.response?.status || 'FAIL'}`);
    results.endpoints.push({ name: '/health', status: err.response?.status || 'FAIL' });
  }

  // 2. API Health Probe
  try {
    const apiHealthRes = await axios.get(`${PROD_API}/health`, { timeout: 8000 });
    console.log(`[PROD PROBE 2] GET ${PROD_API}/health -> HTTP ${apiHealthRes.status}`);
    console.log(`               Body: ${JSON.stringify(apiHealthRes.data)}`);
    results.endpoints.push({ name: '/api/health', status: apiHealthRes.status, body: apiHealthRes.data });
  } catch (err) {
    console.log(`[PROD PROBE 2] GET ${PROD_API}/health -> HTTP ${err.response?.status || 'FAIL'}`);
    results.endpoints.push({ name: '/api/health', status: err.response?.status || 'FAIL' });
  }

  // 3. Platform Settings Probe
  try {
    const settingsRes = await axios.get(`${PROD_API}/platform/settings`, { timeout: 8000 });
    console.log(`[PROD PROBE 3] GET ${PROD_API}/platform/settings -> HTTP ${settingsRes.status}`);
    console.log(`               Body: ${JSON.stringify(settingsRes.data).slice(0, 150)}`);
    results.endpoints.push({ name: '/api/platform/settings', status: settingsRes.status, data: settingsRes.data });
  } catch (err) {
    console.log(`[PROD PROBE 3] GET ${PROD_API}/platform/settings -> HTTP ${err.response?.status || 'FAIL'}`);
    results.endpoints.push({ name: '/api/platform/settings', status: err.response?.status || 'FAIL' });
  }

  // 4. Organizations Probe
  try {
    const orgsRes = await axios.get(`${PROD_API}/organizations`, { timeout: 8000 });
    console.log(`[PROD PROBE 4] GET ${PROD_API}/organizations -> HTTP ${orgsRes.status}`);
    console.log(`               Body: ${JSON.stringify(orgsRes.data)}`);
    results.endpoints.push({ name: '/api/organizations', status: orgsRes.status, data: orgsRes.data });
  } catch (err) {
    console.log(`[PROD PROBE 4] GET ${PROD_API}/organizations -> HTTP ${err.response?.status || 'FAIL'}`);
    results.endpoints.push({ name: '/api/organizations', status: err.response?.status || 'FAIL' });
  }

  // 5. Auth Login Endpoint Probe
  try {
    const loginRes = await axios.post(`${PROD_API}/auth/login`, {
      email: 'superadmin@enterprise-crm.com',
      password: 'Password123!'
    }, { timeout: 8000 });
    console.log(`[PROD PROBE 5] POST ${PROD_API}/auth/login -> HTTP ${loginRes.status}`);
    console.log(`               Body: ${JSON.stringify(loginRes.data).slice(0, 150)}`);
    results.endpoints.push({ name: '/api/auth/login', status: loginRes.status, data: loginRes.data });
  } catch (err) {
    console.log(`[PROD PROBE 5] POST ${PROD_API}/auth/login -> HTTP ${err.response?.status || 'FAIL'}`);
    console.log(`               Body: ${JSON.stringify(err.response?.data)}`);
    results.endpoints.push({ name: '/api/auth/login', status: err.response?.status || 'FAIL', error: err.response?.data });
  }

  console.log('\n================================================================');
  console.log('  PROBE COMPLETE');
  console.log('================================================================');
}

verifyProduction();
