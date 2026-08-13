const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupStaleDepartments() {
  try {
    console.log('Running database cleanup for stale department references...');

    // 1. Delete any "Unassigned" or temp test department rows from DepartmentMaster
    const deletedDepts = await prisma.departmentMaster.deleteMany({
      where: {
        OR: [
          { name: { in: ['Unassigned', 'Dept To Delete', 'Test Temp Dept', 'Dept With Members'] } },
          { code: { in: ['DEP-UNASSIGNED', 'DEPT-DEL', 'TEMP-DEPT', 'DEPT-MEM'] } }
        ]
      }
    });
    console.log(`Deleted ${deletedDepts.count} system/test department records from DepartmentMaster.`);

    // 2. Clear department fields for users with 'Unassigned' or invalid references
    const updatedUsers1 = await prisma.user.updateMany({
      where: {
        OR: [
          { department: 'Unassigned' },
          { department: 'DEP-UNASSIGNED' }
        ]
      },
      data: {
        departmentId: null,
        department: null
      }
    });
    console.log(`Cleared stale department fields for ${updatedUsers1.count} users with string "Unassigned".`);

    // 3. Clear orphaned department IDs
    const validDepts = await prisma.departmentMaster.findMany({ select: { id: true } });
    const validIds = validDepts.map(d => d.id);

    const updatedUsers2 = await prisma.user.updateMany({
      where: {
        departmentId: { notIn: validIds, not: null }
      },
      data: {
        departmentId: null,
        department: null
      }
    });
    console.log(`Cleared orphaned department IDs for ${updatedUsers2.count} users.`);

    console.log('Database cleanup completed successfully!');
  } catch (err) {
    console.error('Cleanup error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupStaleDepartments();
