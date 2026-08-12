const prisma = require('../src/utils/db');

async function migrate() {
  try {
    const projects = await prisma.project.findMany({
      include: { workflowStages: true, tasks: true }
    });

    console.log(`Found ${projects.length} projects to check for workflow migration.`);

    for (const p of projects) {
      if (!p.workflowStages || p.workflowStages.length === 0) {
        console.log(`Synthesizing workflow stages for project: ${p.name} (${p.projectCode})`);

        const s1 = await prisma.projectWorkflowStage.create({
          data: {
            projectId: p.id,
            name: 'To Do',
            color: '#64748B',
            order: 0,
            requiresApproval: false,
            isCompletedStage: false
          }
        });

        const s2 = await prisma.projectWorkflowStage.create({
          data: {
            projectId: p.id,
            name: 'In Progress',
            color: '#EAB308',
            order: 1,
            requiresApproval: false,
            isCompletedStage: false
          }
        });

        const s3 = await prisma.projectWorkflowStage.create({
          data: {
            projectId: p.id,
            name: 'In Review',
            color: '#8B5CF6',
            order: 2,
            requiresApproval: true,
            approverRole: 'PROJECT_LEADER',
            isCompletedStage: false
          }
        });

        const s4 = await prisma.projectWorkflowStage.create({
          data: {
            projectId: p.id,
            name: 'Done',
            color: '#10B981',
            order: 3,
            requiresApproval: false,
            isCompletedStage: true
          }
        });

        const stageMap = {
          'PENDING': s1.id,
          'REJECTED': s1.id,
          'IN_PROGRESS': s2.id,
          'WAITING_FOR_REVIEW': s3.id,
          'APPROVED': s4.id,
          'COMPLETED': s4.id
        };

        for (const t of p.tasks) {
          const targetStageId = stageMap[t.status] || s1.id;
          await prisma.task.update({
            where: { id: t.id },
            data: { stageId: targetStageId }
          });
        }
      }
    }

    console.log('Workflow migration successfully completed!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
