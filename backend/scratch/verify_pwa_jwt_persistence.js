const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_URL = process.env.API_URL || 'http://127.0.0.1:5000/api';

async function verifyPwaJwtPersistence() {
  console.log('====================================================');
  console.log('   PWA JWT SESSION PERSISTENCE & REFRESH SUITE      ');
  console.log('====================================================\n');

  try {
    // 1. Test Login & Persistent Tokens
    console.log('1. Testing Login & Token Generation...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      userId: 'nancythomasselva@gmail.com',
      password: 'password123',
      rememberMe: true
    });

    const { token, refreshToken, user, organization } = loginRes.data;

    console.log(`  ✓ Login HTTP Status: ${loginRes.status}`);
    console.log(`  ✓ Access Token Returned: ${Boolean(token)}`);
    console.log(`  ✓ Refresh Token Returned: ${Boolean(refreshToken)}`);
    console.log(`  ✓ User Restored: ${user.name} (${user.email})`);
    console.log(`  ✓ Organization Restored: ${organization?.name} (${organization?.slug})`);

    // Verify token expiration is long-lived (30d) for persistent PWA login
    const decoded = jwt.decode(token);
    const expDays = Math.round((decoded.exp - decoded.iat) / 86400);
    console.log(`  ✓ Access Token Expiration Lifetime: ${expDays} days`);

    if (expDays < 7) {
      console.error('❌ Expected token expiration lifetime to be at least 7 days for PWA persistence!');
      process.exit(1);
    }

    // 2. Test Profile Fetch with Access Token
    console.log('\n2. Testing /auth/profile session verification...');
    const profileRes = await axios.get(`${API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`  ✓ Profile HTTP Status: ${profileRes.status}`);
    console.log(`  ✓ Profile User Email: ${profileRes.data.email}`);

    // 3. Test Silent Token Refresh Endpoint /auth/refresh
    console.log('\n3. Testing /auth/refresh endpoint...');
    const refreshRes = await axios.post(`${API_URL}/auth/refresh`, {
      token,
      refreshToken
    });

    console.log(`  ✓ Refresh HTTP Status: ${refreshRes.status}`);
    console.log(`  ✓ New Access Token Issued: ${Boolean(refreshRes.data.token)}`);
    console.log(`  ✓ New Refresh Token Issued: ${Boolean(refreshRes.data.refreshToken)}`);
    console.log(`  ✓ Refreshed User Email: ${refreshRes.data.user.email}`);

    const newToken = refreshRes.data.token;

    // Verify new refreshed token works against protected routes
    const profileWithNewToken = await axios.get(`${API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${newToken}` }
    });
    console.log(`  ✓ New Refreshed Token Profile Verification Status: ${profileWithNewToken.status}`);

    // 4. Test Multi-Tenant Isolation on Token Renewal
    console.log('\n4. Testing Multi-Tenant Context Preservation on Refresh...');
    const decodedNew = jwt.decode(newToken);
    if (decodedNew.organizationId !== user.organizationId) {
      console.error('❌ Multi-tenant organizationId mismatch in refreshed token!');
      process.exit(1);
    }
    console.log(`  ✓ Refreshed Token retains exact organizationId: ${decodedNew.organizationId}`);

    console.log('\n====================================================');
    console.log('   🎉 PWA JWT SESSION PERSISTENCE VERIFIED 100%!   ');
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ PWA JWT verification failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

verifyPwaJwtPersistence();
