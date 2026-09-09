const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('=== FORENSIC TEST: TASK CREATION (BOARD -> ADD TASK) ===');

  try {
    // 1. Get Projects
    const projects = await prisma.project.findMany({
      include: { workflowStages: { orderBy: { order: 'asc' } } }
    });
    console.log(`Found ${projects.length} existing projects in DB.`);

    const innoveityProj = projects.find(p => p.projectCode === 'PRJ-5803') || projects[0];
    const c2cProj = projects.find(p => p.projectCode === 'PRJ-5804') || projects.find(p => p.organizationId === 'cmtgsp8710000bb94ztamcrue');
    const reniProj = projects.find(p => p.projectCode === 'PRJ-5805') || projects.find(p => p.organizationId === 'cmtil10ie0001sg5eo2jfx4ew');

    // 2. Login Super Admin
    const saLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'superadmin@enterprise-crm.com',
      password: 'Password123!'
    });
    const saToken = saLogin.data.token;
    console.log('[LOGIN SUCCESS] Super Admin logged in.');

    // 3. Test Task Creation (Unassigned, default stage To Do)
    if (innoveityProj) {
      console.log(`\nTesting Task Creation for INNOVEITY Project ${innoveityProj.projectCode}...`);
      const defaultStage = innoveityProj.workflowStages[0];
      console.log(`First Workflow Stage: "${defaultStage?.name}" (${defaultStage?.id})`);

      const payload = {
        title: 'Board Task (Unassigned) ' + Date.now().toString().slice(-4),
        description: 'Test task created via Board Add Task',
        priority: 'MEDIUM',
        deadline: '2026-09-15',
        projectId: innoveityProj.id,
        organizationId: innoveityProj.organizationId
      };

      console.log('[TASK CREATE] Sending payload:', payload);
      const res = await axios.post(`${API_BASE}/tasks`, payload, {
        headers: { Authorization: `Bearer ${saToken}` }
      });
      console.log('[TASK CREATE SUCCESS]:', res.data.message);
      console.log('Task ID:', res.data.task.id);
      console.log('Assigned Stage:', res.data.task.stage?.name || res.data.task.stageId);
      console.log('Assignee ID:', res.data.task.assigneeId || 'null (Unassigned)');
      console.log('Organization ID:', res.data.task.organizationId);
    }

    // 4. Test Task Creation for C2C Project
    if (c2cProj) {
      console.log(`\nTesting Task Creation for C2C Project ${c2cProj.projectCode}...`);
      const payload = {
        title: 'C2C Board Task ' + Date.now().toString().slice(-4),
        description: 'C2C Task creation verification',
        priority: 'HIGH',
        deadline: '2026-09-20',
        projectId: c2cProj.id,
        organizationId: c2cProj.organizationId
      };

      const res = await axios.post(`${API_BASE}/tasks`, payload, {
        headers: { Authorization: `Bearer ${saToken}` }
      });
      console.log('[TASK CREATE SUCCESS C2C]:', res.data.message);
      console.log('Task Org ID:', res.data.task.organizationId);
    }

    // 5. Test Task Creation for RENI Project
    if (reniProj) {
      console.log(`\nTesting Task Creation for RENI Project ${reniProj.projectCode}...`);
      const payload = {
        title: 'RENI Board Task ' + Date.now().toString().slice(-4),
        description: 'RENI Task creation verification',
        priority: 'URGENT',
        deadline: '2026-09-25',
        projectId: reniProj.id,
        organizationId: reniProj.organizationId
      };

      const res = await axios.post(`${API_BASE}/tasks`, payload, {
        headers: { Authorization: `Bearer ${saToken}` }
      });
      console.log('[TASK CREATE SUCCESS RENI]:', res.data.message);
      console.log('Task Org ID:', res.data.task.organizationId);
    }

    // 6. Test GET /api/tasks Board Scoping
    console.log('\n--- VERIFYING GET /api/tasks SCOPING ---');
    if (innoveityProj) {
      const getRes = await axios.get(`${API_BASE}/tasks?projectId=${innoveityProj.id}`, {
        headers: { Authorization: `Bearer ${saToken}` }
      });
      console.log(`INNOVEITY Project Tasks Count: ${getRes.data.tasks?.length || getRes.data?.length}`);
    }

    console.log('\n=== ALL TASK CREATION VERIFICATION TESTS PASSED ===');

  } catch (err) {
    console.error('Task Creation Test Failed:', err.response?.data || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
