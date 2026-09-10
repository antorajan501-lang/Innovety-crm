const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function auditLocalDb() {
  try {
    const orgs = await prisma.organization.count().catch(() => 0);
    const users = await prisma.user.count().catch(() => 0);
    const projects = await prisma.project.count().catch(() => 0);
    const tasks = await prisma.task.count().catch(() => 0);
    const attendance = await prisma.attendance.count().catch(() => 0);
    const leaveRequests = await prisma.leaveRequest.count().catch(() => 0);
    const systemSettings = await prisma.systemSettings.count().catch(() => 0);
    const platformSettings = await prisma.platformSettings.count().catch(() => 0);

    console.log('=== PHASE 1: LOCAL DATABASE AUDIT REPORT ===');
    console.log(`Organizations: ${orgs}`);
    console.log(`Users: ${users}`);
    console.log(`Projects: ${projects}`);
    console.log(`Tasks: ${tasks}`);
    console.log(`Attendance Records: ${attendance}`);
    console.log(`Leave Requests: ${leaveRequests}`);
    console.log(`System Settings: ${systemSettings}`);
    console.log(`Platform Settings: ${platformSettings}`);

    const orgList = await prisma.organization.findMany({ select: { id: true, name: true, slug: true } });
    console.log('Organizations list:', JSON.stringify(orgList, null, 2));

    const userList = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, organizationId: true }
    });
    console.log(`User list (${userList.length}):`);
    userList.forEach(u => console.log(` - ${u.name} (${u.email}) [${u.role}] -> Org: ${u.organizationId}`));
  } catch (err) {
    console.error('Error auditing DB:', err);
  } finally {
    await prisma.$disconnect();
  }
}

auditLocalDb();
