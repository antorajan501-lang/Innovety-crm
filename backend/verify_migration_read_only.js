const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function runReadOnlyVerification() {
  console.log('====================================================');
  console.log('      READ-ONLY DATABASE MIGRATION VERIFICATION     ');
  console.log('====================================================\n');

  // PHASE 1: LOCAL DATABASE AUDIT VERIFICATION
  console.log('--- PHASE 1: LOCAL DATABASE AUDIT VERIFICATION ---');
  const orgCount = await prisma.organization.count();
  const userCount = await prisma.user.count();
  const projectCount = await prisma.project.count();
  const taskCount = await prisma.task.count();
  const attendanceCount = await prisma.attendance.count();
  const leaveCount = await prisma.leaveRequest.count();

  console.log(`Organizations: Expected = 3  | Actual = ${orgCount}  | Status = ${orgCount === 3 ? 'MATCH' : 'MISMATCH'}`);
  console.log(`Users:         Expected = 16 | Actual = ${userCount} | Status = ${userCount === 16 ? 'MATCH' : 'MISMATCH'}`);
  console.log(`Projects:      Expected = 28 | Actual = ${projectCount} | Status = ${projectCount === 28 ? 'MATCH' : 'MISMATCH'}`);
  console.log(`Tasks:         Expected = 31 | Actual = ${taskCount} | Status = ${taskCount === 31 ? 'MATCH' : 'MISMATCH'}`);
  console.log(`Attendance:    Expected = 68 | Actual = ${attendanceCount} | Status = ${attendanceCount === 68 ? 'MATCH' : 'MISMATCH'}`);
  console.log(`LeaveRequests: Expected = 51 | Actual = ${leaveCount} | Status = ${leaveCount === 51 ? 'MATCH' : 'MISMATCH'}\n`);

  // PHASE 4: DATA INTEGRITY & HIDDEN RISKS AUDIT
  console.log('--- PHASE 4: DATA INTEGRITY & HIDDEN RISKS AUDIT ---');
  
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true, employeeId: true, organizationId: true } });
  const userIds = new Set(allUsers.map(u => u.id));
  const allProjects = await prisma.project.findMany({ select: { id: true } });
  const projectIds = new Set(allProjects.map(p => p.id));

  // 1. Orphan records check
  const attendances = await prisma.attendance.findMany({ select: { id: true, userId: true } });
  const orphanAttendances = attendances.filter(a => !userIds.has(a.userId));

  const leaves = await prisma.leaveRequest.findMany({ select: { id: true, userId: true } });
  const orphanLeaves = leaves.filter(l => !userIds.has(l.userId));

  const tasks = await prisma.task.findMany({ select: { id: true, projectId: true } });
  const orphanTasks = tasks.filter(t => t.projectId && !projectIds.has(t.projectId));

  // 2. Duplicate emails & Emp IDs
  const emailCounts = {};
  const empIdCounts = {};
  allUsers.forEach(u => {
    if (u.email) emailCounts[u.email.toLowerCase()] = (emailCounts[u.email.toLowerCase()] || 0) + 1;
    if (u.employeeId) empIdCounts[u.employeeId] = (empIdCounts[u.employeeId] || 0) + 1;
  });

  const duplicateEmails = Object.keys(emailCounts).filter(e => emailCounts[e] > 1);
  const duplicateEmpIds = Object.keys(empIdCounts).filter(e => empIdCounts[e] > 1);

  // 3. Duplicate Org Slugs
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, slug: true } });
  const slugCounts = {};
  orgs.forEach(o => { if (o.slug) slugCounts[o.slug.toLowerCase()] = (slugCounts[o.slug.toLowerCase()] || 0) + 1; });
  const duplicateSlugs = Object.keys(slugCounts).filter(s => slugCounts[s] > 1);

  // 4. Missing Organization Assignments (Null organizationId)
  const unassignedUsers = await prisma.user.count({ where: { organizationId: null } });
  const unassignedProjects = await prisma.project.count({ where: { organizationId: null } });
  const unassignedTasks = await prisma.task.count({ where: { organizationId: null } });
  const unassignedAttendance = await prisma.attendance.count({ where: { user: { organizationId: null } } });
  const unassignedLeave = await prisma.leaveRequest.count({ where: { user: { organizationId: null } } });

  console.log(`Orphan Attendance Records (invalid userId): ${orphanAttendances.length}`);
  console.log(`Orphan LeaveRequests (invalid userId):       ${orphanLeaves.length}`);
  console.log(`Orphan Tasks (invalid projectId):            ${orphanTasks.length}`);
  console.log(`Duplicate User Emails:                       ${duplicateEmails.length > 0 ? duplicateEmails.join(', ') : 'None (0)'}`);
  console.log(`Duplicate Employee IDs:                      ${duplicateEmpIds.length > 0 ? duplicateEmpIds.join(', ') : 'None (0)'}`);
  console.log(`Duplicate Org Slugs:                          ${duplicateSlugs.length > 0 ? duplicateSlugs.join(', ') : 'None (0)'}`);
  console.log(`Unassigned Users (null organizationId):      ${unassignedUsers}`);
  console.log(`Unassigned Projects (null organizationId):   ${unassignedProjects}`);
  console.log(`Unassigned Tasks (null organizationId):      ${unassignedTasks}`);
  console.log(`Unassigned Attendance (null organizationId): ${unassignedAttendance}`);
  console.log(`Unassigned Leave (null organizationId):      ${unassignedLeave}\n`);

  // PHASE 5: MULTI-TENANT INTEGRITY VERIFICATION
  console.log('--- PHASE 5: MULTI-TENANT INTEGRITY VERIFICATION ---');
  for (const org of orgs) {
    const uCount = await prisma.user.count({ where: { organizationId: org.id } });
    const pCount = await prisma.project.count({ where: { organizationId: org.id } });
    const tCount = await prisma.task.count({ where: { organizationId: org.id } });
    const aCount = await prisma.attendance.count({ where: { user: { organizationId: org.id } } });
    const lCount = await prisma.leaveRequest.count({ where: { user: { organizationId: org.id } } });
    console.log(`Org: [${org.slug.toUpperCase()}] "${org.name}" (ID: ${org.id})`);
    console.log(`   Users: ${uCount} | Projects: ${pCount} | Tasks: ${tCount} | Attendance: ${aCount} | Leaves: ${lCount}`);
  }

  await prisma.$disconnect();
}

runReadOnlyVerification().catch(err => {
  console.error('Verification script failed:', err);
  prisma.$disconnect();
});
