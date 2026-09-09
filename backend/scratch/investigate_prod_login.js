const axios = require('axios');

const PROD_BASE = 'https://crm.innoveity.tech/api';

async function investigate() {
  console.log('=== FORENSIC INVESTIGATION: PRODUCTION LOGIN 404 ===\n');

  // 1. Check health / endpoints
  console.log('--- Phase 1 & 6: Endpoint Status Comparison ---');
  const endpoints = [
    { name: 'Health', url: 'https://crm.innoveity.tech/health' },
    { name: 'API Health', url: `${PROD_BASE}/health` },
    { name: 'Platform Settings', url: `${PROD_BASE}/platform/settings` },
    { name: 'Organizations', url: `${PROD_BASE}/organizations` }
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep.url, { timeout: 10000 });
      console.log(`[GET ${ep.name}] Status: ${res.status}`);
      console.log(`  Headers: server=${res.headers['server']}, content-type=${res.headers['content-type']}`);
      console.log(`  Data: ${JSON.stringify(res.data).slice(0, 150)}`);
    } catch (err) {
      console.log(`[GET ${ep.name}] Error: Status ${err.response?.status || 'NO_RESPONSE'}`);
      if (err.response) {
        console.log(`  Headers: server=${err.response.headers['server']}, content-type=${err.response.headers['content-type']}`);
        console.log(`  Data: ${JSON.stringify(err.response.data).slice(0, 150)}`);
      } else {
        console.log(`  Message: ${err.message}`);
      }
    }
  }

  // 2. Test Login Payload Variants
  console.log('\n--- Phase 1 & 2: Login Endpoint Response Forensics ---');
  const testPayloads = [
    { label: 'superadmin@enterprise-crm.com (Standard)', data: { userId: 'superadmin@enterprise-crm.com', password: 'Password123!' } },
    { label: 'email field instead of userId', data: { email: 'superadmin@enterprise-crm.com', password: 'Password123!' } },
    { label: 'login field', data: { login: 'superadmin@enterprise-crm.com', password: 'Password123!' } },
    { label: 'anto@innoveity.com', data: { userId: 'anto@innoveity.com', password: 'Password123!' } },
    { label: 'admin@enterprise-crm.com', data: { userId: 'admin@enterprise-crm.com', password: 'Password123!' } },
    { label: 'vedha@gmail.com', data: { userId: 'vedha@gmail.com', password: 'Password123!' } },
    { label: 'Non-existent account test', data: { userId: 'non_existent_test_123456@domain.com', password: 'Password123!' } }
  ];

  for (const tp of testPayloads) {
    try {
      const res = await axios.post(`${PROD_BASE}/auth/login`, tp.data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      console.log(`[POST ${tp.label}] SUCCESS Status: ${res.status}`);
      console.log(`  Response: ${JSON.stringify(res.data).slice(0, 200)}`);
    } catch (err) {
      console.log(`[POST ${tp.label}] Status: ${err.response?.status || 'NO_RESPONSE'}`);
      if (err.response) {
        console.log(`  Response Headers: server=${err.response.headers['server']}, content-type=${err.response.headers['content-type']}`);
        console.log(`  Response Body: ${JSON.stringify(err.response.data)}`);
      } else {
        console.log(`  Error Message: ${err.message}`);
      }
    }
  }

  console.log('\n=== INVESTIGATION RUN COMPLETE ===');
}

investigate();
