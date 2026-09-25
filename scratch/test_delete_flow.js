const axios = require('../backend/node_modules/axios');
const prisma = require('../backend/src/utils/db');

async function testDelete() {
  let token;
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      userId: 'superadmin@enterprise-crm.com',
      password: 'Password123!'
    });
    token = loginRes.data.token;
  } catch (e) {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      userId: 'superadmin@enterprise-crm.com',
      password: 'SuperAdmin123!'
    });
    token = loginRes.data.token;
  }
  const headers = { Authorization: `Bearer ${token}` };

  const getRes = await axios.get('http://localhost:5000/api/leave-policy', { headers });
  console.log('Leave types before delete:');
  getRes.data.leaveTypes.forEach(lt => console.log(` - [${lt.id}] ${lt.name} (${lt.code})`));

  const target = getRes.data.leaveTypes.find(lt => lt.code === 'SUM');
  if (!target) {
    console.log('SUM not found, creating a test leave type...');
    const createRes = await axios.post('http://localhost:5000/api/leave-policy/types', {
      name: 'Test Temp Policy',
      code: 'TTP',
      annualDays: 5,
      monthlyCreditDays: 1,
      isPaid: true
    }, { headers });
    console.log('Created test policy:', createRes.data.leaveType);
  }

  const toDelete = (await axios.get('http://localhost:5000/api/leave-policy', { headers })).data.leaveTypes.find(lt => ['SUM', 'TTP'].includes(lt.code));
  console.log(`\nAttempting to delete: ${toDelete.name} (${toDelete.id})...`);

  try {
    const delRes = await axios.delete(`http://localhost:5000/api/leave-policy/types/${toDelete.id}`, { headers });
    console.log('Delete response:', delRes.data);
  } catch (err) {
    console.error('Delete failed:', err.response?.data || err.message);
  }

  const afterRes = await axios.get('http://localhost:5000/api/leave-policy', { headers });
  console.log('\nLeave types after delete:');
  afterRes.data.leaveTypes.forEach(lt => console.log(` - [${lt.id}] ${lt.name} (${lt.code})`));

  const stillExistsInApi = afterRes.data.leaveTypes.some(lt => lt.id === toDelete.id);
  console.log('Still exists in API GET /leave-policy:', stillExistsInApi);

  const stillInDb = await prisma.leaveType.findUnique({ where: { id: toDelete.id } });
  console.log('Still exists in PostgreSQL DB:', !!stillInDb, stillInDb ? { isActive: stillInDb.isActive } : null);

  await prisma.$disconnect();
}

testDelete().catch(console.error);
