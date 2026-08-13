const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  try {
    const testDepts = await prisma.departmentMaster.findMany({
      where: {
        OR: [
          { name: { contains: 'Dept To Delete', mode: 'insensitive' } },
          { name: { contains: 'Test Temp Dept', mode: 'insensitive' } },
          { name: { contains: 'Dept With Members', mode: 'insensitive' } },
          { code: { contains: 'DEPT-DEL', mode: 'insensitive' } },
          { code: { contains: 'TEMP-DEPT', mode: 'insensitive' } },
          { code: { contains: 'DEPT-MEM', mode: 'insensitive' } }
        ]
      }
    });

    console.log('Found test departments to delete:', testDepts);

    for (const d of testDepts) {
      // Reassign any users to null or unassigned before deleting
      await prisma.user.updateMany({
        where: { departmentId: d.id },
        data: { departmentId: null, department: null }
      });
      await prisma.departmentMaster.delete({ where: { id: d.id } });
      console.log(`Deleted temp department: "${d.name}" (${d.code})`);
    }

    const allDepts = await prisma.departmentMaster.findMany({ select: { name: true, code: true } });
    console.log('Remaining departments in database:', allDepts);
  } catch (err) {
    console.error('Cleanup error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
