const prisma = require('../backend/src/utils/db');

async function testWfhPersistenceFlow() {
  console.log('=== TEST: WFH Leave Policy Edit & Persistence ===\n');

  // 1. Log in as Super Admin
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'superadmin@enterprise-crm.com',
      password: 'SuperAdmin123!'
    })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
  console.log('✓ Super Admin authenticated.');

  // 2. Fetch current policy & leave types (simulates opening Super Admin -> Leave Policy)
  const initialRes = await fetch('http://localhost:5000/api/leave-policy', { headers });
  const initialData = await initialRes.json();
  const wfhInitial = initialData.leaveTypes.find(lt => lt.code === 'WFH');
  if (!wfhInitial) {
    throw new Error('WFH leave type not found in initial leave policy fetch!');
  }
  console.log(`✓ Found WFH initial state: Annual=${wfhInitial.annualDays}, Monthly=${wfhInitial.monthlyCreditDays}, isSystem=${wfhInitial.isSystem}`);

  // 3. Edit WFH: Change Monthly from 2 to 5, Change Annual from 24 to 60
  console.log('\n--- Step 3: Editing WFH (Monthly: 5, Annual: 60) ---');
  const updateRes = await fetch(`http://localhost:5000/api/leave-policy/types/${wfhInitial.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      name: wfhInitial.name,
      code: 'WFH',
      annualDays: 60,
      monthlyCreditDays: 5,
      isPaid: wfhInitial.isPaid,
      color: wfhInitial.color,
      icon: wfhInitial.icon,
      description: wfhInitial.description,
      allowCarryForward: wfhInitial.allowCarryForward,
      requireDoc: wfhInitial.requireDoc,
      allowHalfDay: wfhInitial.allowHalfDay
    })
  });

  const updateData = await updateRes.json();
  console.log('✓ Update response:', updateData.message);
  console.log('✓ Returned WFH record:', {
    annualDays: updateData.leaveType?.annualDays,
    monthlyCreditDays: updateData.leaveType?.monthlyCreditDays
  });

  if (updateData.leaveType?.annualDays !== 60 || updateData.leaveType?.monthlyCreditDays !== 5) {
    throw new Error('Update response did not return expected values 60 and 5!');
  }

  // 4. Simulate Page Refresh (Calling GET /api/leave-policy, which triggers getGlobalLeavePolicy & ensureSystemLeaveTypesSeeded)
  console.log('\n--- Step 4: Simulating Page Refresh (GET /api/leave-policy) ---');
  const refreshRes = await fetch('http://localhost:5000/api/leave-policy', { headers });
  const refreshData = await refreshRes.json();
  const wfhRefreshed = refreshData.leaveTypes.find(lt => lt.code === 'WFH');
  console.log(`✓ After refresh: Annual=${wfhRefreshed.annualDays}, Monthly=${wfhRefreshed.monthlyCreditDays}, isSystem=${wfhRefreshed.isSystem}`);

  if (wfhRefreshed.annualDays !== 60 || wfhRefreshed.monthlyCreditDays !== 5) {
    throw new Error(`FAIL: Values reverted after refresh! Got Annual=${wfhRefreshed.annualDays}, Monthly=${wfhRefreshed.monthlyCreditDays}`);
  }
  console.log('✓ PASS: Values persisted after refresh (Monthly remains 5, Annual remains 60)!');

  // 5. Verify Database State directly
  console.log('\n--- Step 5: Direct Database Record Verification ---');
  const dbWfhList = await prisma.leaveType.findMany({ where: { code: 'WFH' } });
  console.log(`✓ Total WFH records in DB: ${dbWfhList.length}`);
  if (dbWfhList.length !== 1) {
    throw new Error(`FAIL: Expected 1 WFH record in DB, found ${dbWfhList.length}!`);
  }
  const dbWfh = dbWfhList[0];
  console.log(`✓ DB Record: Annual=${dbWfh.annualDays}, Monthly=${dbWfh.monthlyCreditDays}, isSystem=${dbWfh.isSystem}`);
  if (dbWfh.annualDays !== 60 || dbWfh.monthlyCreditDays !== 5) {
    throw new Error('FAIL: DB record does not match 60 and 5!');
  }
  console.log('✓ PASS: No duplicate WFH policy created. DB has exact expected values.');

  // 6. Verify Other Leave Policies (CL, SL, etc.) are unaffected
  console.log('\n--- Step 6: Verifying other leave policies are unaffected ---');
  const cl = refreshData.leaveTypes.find(lt => lt.code === 'CL');
  const sl = refreshData.leaveTypes.find(lt => lt.code === 'SL');
  console.log(`✓ Casual Leave (CL): Annual=${cl?.annualDays}, Monthly=${cl?.monthlyCreditDays}, isSystem=${cl?.isSystem}`);
  console.log(`✓ Sick Leave (SL): Annual=${sl?.annualDays}, Monthly=${sl?.monthlyCreditDays}, isSystem=${sl?.isSystem}`);
  if (!cl || !sl) {
    throw new Error('CL or SL missing!');
  }

  // 7. Verify Negative Validation Rule
  console.log('\n--- Step 7: Negative Allowance Validation Check ---');
  const negRes = await fetch(`http://localhost:5000/api/leave-policy/types/${wfhInitial.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      annualDays: -10,
      monthlyCreditDays: 5
    })
  });
  if (negRes.status === 400) {
    const errData = await negRes.json();
    console.log('✓ Correctly rejected negative annualDays with HTTP 400:', errData.message);
  } else {
    throw new Error(`Expected HTTP 400 for negative allowance, got ${negRes.status}`);
  }

  console.log('\n=== ALL PERSISTENCE TESTS PASSED SUCCESSFULLY! ===');
  await prisma.$disconnect();
}

testWfhPersistenceFlow().catch(err => {
  console.error('\n❌ Test failed with error:', err.message);
  process.exit(1);
});
