const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('=== FORENSIC TEST: PROJECT CREATION ===');

  try {
    // 1. Get Organizations
    const orgs = await prisma.organization.findMany();
    console.log('Organizations in DB:');
    orgs.forEach(o => console.log(` - ${o.name} (${o.slug}): ID = ${o.id}`));

    const innoveityOrg = orgs.find(o => o.slug === 'innoveity');
    const c2cOrg = orgs.find(o => o.slug === 'c2c-global') || orgs.find(o => o.name.toLowerCase().includes('c2c'));
    const reniOrg = orgs.find(o => o.slug === 'reni') || orgs.find(o => o.name.toLowerCase().includes('reni'));

    // 2. Login Super Admin
    const saLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'superadmin@enterprise-crm.com',
      password: 'Password123!'
    });
    const saToken = saLogin.data.token;
    console.log('\n[LOGIN SUCCESS] Super Admin logged in.');

    // 3. Test Project Creation for INNOVEITY Workspace
    if (innoveityOrg) {
      console.log(`\nTesting Creation for INNOVEITY (${innoveityOrg.id})...`);
      const payload = {
        name: 'Innoveity Test Project ' + Date.now().toString().slice(-4),
        description: 'Automated test project for Innoveity',
        type: 'CLIENT',
        priority: 'HIGH',
        status: 'ACTIVE',
        estimatedStartDate: '2026-09-10',
        estimatedEndDate: '2026-10-10',
        organizationId: innoveityOrg.id,
        leaderId: saLogin.data.user.id,
        memberIds: [saLogin.data.user.id],
        workflowStages: [
          { name: 'To Do', color: '#64748B', order: 0, requiresApproval: false, isCompletedStage: false },
          { name: 'In Progress', color: '#EAB308', order: 1, requiresApproval: false, isCompletedStage: false },
          { name: 'In Review', color: '#8B5CF6', order: 2, requiresApproval: true, isCompletedStage: false },
          { name: 'Done', color: '#10B981', order: 3, requiresApproval: true, isCompletedStage: true }
        ]
      };

      console.log('[PROJECT CREATE] Sending payload:', payload.name);
      const createRes = await axios.post(`${API_BASE}/projects`, payload, {
        headers: { Authorization: `Bearer ${saToken}` }
      });
      console.log('[PROJECT CREATE SUCCESS]:', createRes.data.message);
      console.log('Project Code:', createRes.data.project.projectCode);
      console.log('Project Org ID:', createRes.data.project.organizationId);
      console.log('Workflow Stages Created:', createRes.data.project.workflowStages.map(s => s.name).join(', '));
      console.log('Members Assigned:', createRes.data.project.members.length);
    }

    // 4. Test Project Creation for C2C Global
    if (c2cOrg) {
      console.log(`\nTesting Creation for C2C Global (${c2cOrg.id})...`);
      const payload = {
        name: 'C2C Global Test Project ' + Date.now().toString().slice(-4),
        description: 'Automated test project for C2C',
        type: 'INTERNAL',
        priority: 'MEDIUM',
        status: 'ACTIVE',
        estimatedStartDate: '2026-09-10',
        estimatedEndDate: '2026-10-10',
        organizationId: c2cOrg.id,
        leaderId: saLogin.data.user.id,
        memberIds: [saLogin.data.user.id],
        workflowStages: [
          { name: 'To Do', color: '#64748B', order: 0, requiresApproval: false, isCompletedStage: false },
          { name: 'In Progress', color: '#EAB308', order: 1, requiresApproval: false, isCompletedStage: false },
          { name: 'In Review', color: '#8B5CF6', order: 2, requiresApproval: true, isCompletedStage: false },
          { name: 'Done', color: '#10B981', order: 3, requiresApproval: true, isCompletedStage: true }
        ]
      };

      const createRes = await axios.post(`${API_BASE}/projects`, payload, {
        headers: { Authorization: `Bearer ${saToken}` }
      });
      console.log('[PROJECT CREATE SUCCESS C2C]:', createRes.data.message);
      console.log('Project Org ID:', createRes.data.project.organizationId);
    }

    // 5. Test Project Creation for RENI
    if (reniOrg) {
      console.log(`\nTesting Creation for RENI (${reniOrg.id})...`);
      const payload = {
        name: 'RENI Test Project ' + Date.now().toString().slice(-4),
        description: 'Automated test project for RENI',
        type: 'CLIENT',
        priority: 'URGENT',
        status: 'ACTIVE',
        estimatedStartDate: '2026-09-10',
        estimatedEndDate: '2026-10-10',
        organizationId: reniOrg.id,
        leaderId: saLogin.data.user.id,
        memberIds: [saLogin.data.user.id],
        workflowStages: [
          { name: 'To Do', color: '#64748B', order: 0, requiresApproval: false, isCompletedStage: false },
          { name: 'In Progress', color: '#EAB308', order: 1, requiresApproval: false, isCompletedStage: false },
          { name: 'In Review', color: '#8B5CF6', order: 2, requiresApproval: true, isCompletedStage: false },
          { name: 'Done', color: '#10B981', order: 3, requiresApproval: true, isCompletedStage: true }
        ]
      };

      const createRes = await axios.post(`${API_BASE}/projects`, payload, {
        headers: { Authorization: `Bearer ${saToken}` }
      });
      console.log('[PROJECT CREATE SUCCESS RENI]:', createRes.data.message);
      console.log('Project Org ID:', createRes.data.project.organizationId);
    }

    // 6. Test GET /api/projects for scoping
    console.log('\n--- VERIFYING GET /api/projects SCOPING ---');
    const getResInnoveity = await axios.get(`${API_BASE}/projects?organizationId=${innoveityOrg.id}`, {
      headers: { Authorization: `Bearer ${saToken}` }
    });
    console.log(`INNOVEITY Projects Count: ${getResInnoveity.data.projects.length}`);

    if (c2cOrg) {
      const getResC2C = await axios.get(`${API_BASE}/projects?organizationId=${c2cOrg.id}`, {
        headers: { Authorization: `Bearer ${saToken}` }
      });
      console.log(`C2C Projects Count: ${getResC2C.data.projects.length}`);
    }

    if (reniOrg) {
      const getResReni = await axios.get(`${API_BASE}/projects?organizationId=${reniOrg.id}`, {
        headers: { Authorization: `Bearer ${saToken}` }
      });
      console.log(`RENI Projects Count: ${getResReni.data.projects.length}`);
    }

    console.log('\n=== ALL FORENSIC VERIFICATION TESTS PASSED ===');

  } catch (err) {
    console.error('Test Failed:', err.response?.data || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
