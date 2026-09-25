const axios = require('../backend/node_modules/axios');
const prisma = require('../backend/src/utils/db');
const jwt = require('../backend/node_modules/jsonwebtoken');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const API_BASE = 'http://localhost:5000/api';
const ARTIFACT_DIR = 'C:\\Users\\Luffy\\.gemini\\antigravity-ide\\brain\\75ea4882-487b-4396-9efa-d94c041b3aeb';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function run() {
  console.log('===============================================================');
  console.log('PHASE 5: END-TO-END VERIFICATION');
  console.log('===============================================================\n');

  const orgId = 'cmteaqlih0000sj52wckjbgci'; // Innoveity Tech
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const adminToken = jwt.sign({ id: superAdmin.id, role: superAdmin.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  const tlUser = await prisma.user.findFirst({
    where: { organizationId: orgId, role: 'TEAM_LEADER' }
  });
  console.log(`Team Leader user: ${tlUser.name} (${tlUser.email}, ID: ${tlUser.id})`);

  // Ensure EL exists in DB and assigned to org
  let elType = await prisma.leaveType.findFirst({ where: { code: 'EL' } });
  if (!elType) {
    elType = await prisma.leaveType.create({
      data: {
        name: 'Emergency Leave',
        code: 'EL',
        description: 'Leave for unforeseen emergencies',
        color: '#F59E0B',
        icon: 'AlertCircle',
        displayOrder: 3,
        isPaid: true,
        annualDays: 6.0,
        monthlyCreditDays: 0.0,
        allowCarryForward: false,
        requireDoc: false,
        allowHalfDay: true,
        isSystem: false,
        isActive: true
      }
    });
  }

  const wfhType = await prisma.leaveType.findFirst({ where: { code: 'WFH' } });
  if (wfhType && wfhType.monthlyCreditDays !== 3.0) {
    await prisma.leaveType.update({
      where: { id: wfhType.id },
      data: { monthlyCreditDays: 3.0 }
    });
  }

  // -------------------------------------------------------------
  // TEST 1: Super Admin Configuration
  // Mode: MONTHLY, CL=5, SL=8, EL=0, WFH=3
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Super Admin sets MONTHLY Mode (CL=5, SL=8, EL=0, WFH=3) ---');
  await axios.put(`${API_BASE}/leave-policy`, {
    organizationId: orgId,
    allocationType: 'MONTHLY',
    carryForwardEnabled: true,
    maxCarryForwardDays: 5,
    halfDayAllowed: true,
    workingDaysOnly: true,
    autoApproval: false
  }, { headers: adminHeaders });

  const tlSaveRes = await axios.put(`${API_BASE}/leave-policy`, {
    organizationId: orgId,
    role: 'TEAM_LEADER',
    allocationType: 'MONTHLY',
    carryForwardEnabled: true,
    maxCarryForwardDays: 5,
    halfDayAllowed: true,
    workingDaysOnly: true,
    autoApproval: false,
    allowances: {
      CL: { annualDays: 5, monthlyCreditDays: 5 },
      SL: { annualDays: 8, monthlyCreditDays: 8 },
      EL: { annualDays: 0, monthlyCreditDays: 0 },
      WFH: { annualDays: 36, monthlyCreditDays: 3 }
    }
  }, { headers: adminHeaders });
  console.log('✓ Super Admin Saved TL Policy:', tlSaveRes.data.message);

  // -------------------------------------------------------------
  // TEST 2: Team Leader Balances in Monthly Mode
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Login as Team Leader & Verify Balances ---');
  const tlToken = jwt.sign({ id: tlUser.id, role: tlUser.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });
  const tlHeaders = { Authorization: `Bearer ${tlToken}` };

  const tlBalRes = await axios.get(`${API_BASE}/leaves/balances`, { headers: tlHeaders });
  const dataT2 = tlBalRes.data;

  console.log(`Team Leader allocationMode: ${dataT2.allocationMode} (Expected: MONTHLY)`);
  const clBal = dataT2.leaveTypes.find(t => t.code === 'CL');
  const slBal = dataT2.leaveTypes.find(t => t.code === 'SL');
  const elBal = dataT2.leaveTypes.find(t => t.code === 'EL');
  const wfhBal = dataT2.leaveTypes.find(t => t.code === 'WFH');

  console.log(`  CL available: ${clBal?.available} (Expected: 5)`);
  console.log(`  SL available: ${slBal?.available} (Expected: 8)`);
  console.log(`  EL available: ${elBal?.available} (Expected: 0)`);
  console.log(`  WFH available: ${wfhBal?.available} (Expected: 3)`);

  if (dataT2.allocationMode !== 'MONTHLY') throw new Error(`Expected MONTHLY, got ${dataT2.allocationMode}`);
  if (clBal?.available !== 5) throw new Error(`Expected CL=5, got ${clBal?.available}`);
  if (slBal?.available !== 8) throw new Error(`Expected SL=8, got ${slBal?.available}`);
  if (elBal?.available !== 0) throw new Error(`Expected EL=0, got ${elBal?.available}`);
  if (wfhBal?.available !== 3) throw new Error(`Expected WFH=3, got ${wfhBal?.available}`);

  console.log('✓ PASS TEST 1 & TEST 2: Team Leader received exact expected Monthly balances (5, 8, 0, 3)!');

  // -------------------------------------------------------------
  // TEST 3: Change WFH to 6 without server restart
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Change WFH to 6 without restarting server ---');
  const currentWfh = await prisma.leaveType.findFirst({ where: { code: 'WFH' } });
  await axios.put(`${API_BASE}/leave-policy/types/${currentWfh.id}`, {
    ...currentWfh,
    monthlyCreditDays: 6.0,
    organizationId: orgId
  }, { headers: adminHeaders });

  // Re-fetch Team Leader balances immediately
  const tlBalResT3 = await axios.get(`${API_BASE}/leaves/balances`, { headers: tlHeaders });
  const wfhBalT3 = tlBalResT3.data.leaveTypes.find(t => t.code === 'WFH');
  console.log(`  WFH available after update: ${wfhBalT3?.available} (Expected: 6)`);

  if (wfhBalT3?.available !== 6) throw new Error(`Expected WFH=6, got ${wfhBalT3?.available}`);
  console.log('✓ PASS TEST 3: WFH dynamically updated to 6 without server restart!');

  // -------------------------------------------------------------
  // TEST 4: Switch company policy to Annual
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Switch company policy to Annual ---');
  await axios.put(`${API_BASE}/leave-policy`, {
    organizationId: orgId,
    allocationType: 'ANNUAL',
    carryForwardEnabled: true,
    maxCarryForwardDays: 5,
    halfDayAllowed: true,
    workingDaysOnly: true,
    autoApproval: false
  }, { headers: adminHeaders });

  const tlBalResT4 = await axios.get(`${API_BASE}/leaves/balances`, { headers: tlHeaders });
  const dataT4 = tlBalResT4.data;

  console.log(`Team Leader allocationMode: ${dataT4.allocationMode} (Expected: ANNUAL)`);
  const clBalT4 = dataT4.leaveTypes.find(t => t.code === 'CL');
  const slBalT4 = dataT4.leaveTypes.find(t => t.code === 'SL');
  const elBalT4 = dataT4.leaveTypes.find(t => t.code === 'EL');
  const wfhBalT4 = dataT4.leaveTypes.find(t => t.code === 'WFH');

  console.log(`  CL annual available: ${clBalT4?.available} (Expected: 5)`);
  console.log(`  SL annual available: ${slBalT4?.available} (Expected: 8)`);
  console.log(`  EL annual available: ${elBalT4?.available} (Expected: 0)`);
  console.log(`  WFH annual available: ${wfhBalT4?.available} (Expected: 36)`);

  if (dataT4.allocationMode !== 'ANNUAL') throw new Error(`Expected ANNUAL, got ${dataT4.allocationMode}`);
  if (clBalT4?.available !== 5) throw new Error(`Expected CL=5, got ${clBalT4?.available}`);
  if (slBalT4?.available !== 8) throw new Error(`Expected SL=8, got ${slBalT4?.available}`);
  if (elBalT4?.available !== 0) throw new Error(`Expected EL=0, got ${elBalT4?.available}`);
  if (wfhBalT4?.available !== 36) throw new Error(`Expected WFH=36, got ${wfhBalT4?.available}`);

  console.log('✓ PASS TEST 4: Team Leader immediately shows annual balances (5, 8, 0, 36)!');

  // Switch back to Monthly with WFH=3 so browser screenshots capture the exact requested configuration
  console.log('\n--- Resetting to Monthly Mode (CL=5, SL=8, EL=0, WFH=3) for screenshots ---');
  await axios.put(`${API_BASE}/leave-policy`, {
    organizationId: orgId,
    allocationType: 'MONTHLY',
    carryForwardEnabled: true,
    maxCarryForwardDays: 5,
    halfDayAllowed: true,
    workingDaysOnly: true,
    autoApproval: false
  }, { headers: adminHeaders });

  await axios.put(`${API_BASE}/leave-policy/types/${currentWfh.id}`, {
    ...currentWfh,
    monthlyCreditDays: 3.0,
    organizationId: orgId
  }, { headers: adminHeaders });

  console.log('✓ Final state ready for browser UI capture.');
}

run().catch(err => {
  console.error('Test execution failed:', err.message);
  process.exit(1);
}).finally(() => prisma.$disconnect());
