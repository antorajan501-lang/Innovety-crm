const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  try {
    const innoveityOrg = await prisma.organization.findFirst({ where: { slug: 'innoveity' } });
    const c2cOrg = await prisma.organization.findFirst({ where: { name: { contains: 'C2C', mode: 'insensitive' } } });
    const reniOrg = await prisma.organization.findFirst({ where: { name: { contains: 'Reni', mode: 'insensitive' } } });

    console.log('Orgs found:', {
      innoveity: innoveityOrg?.id,
      c2c: c2cOrg?.id,
      reni: reniOrg?.id
    });

    // 1. Assign existing departments to INNOVEITY if organizationId is null
    const existingDepts = await prisma.departmentMaster.findMany();
    for (const d of existingDepts) {
      if (!d.organizationId && innoveityOrg) {
        await prisma.departmentMaster.update({
          where: { id: d.id },
          data: { organizationId: innoveityOrg.id }
        });
        console.log(`Updated department "${d.name}" -> Org ${innoveityOrg.id}`);
      }
    }

    // 2. Ensure C2C has departments if none exist
    if (c2cOrg) {
      const c2cDepts = await prisma.departmentMaster.findMany({
        where: { organizationId: c2cOrg.id }
      });
      if (c2cDepts.length === 0) {
        console.log('Creating default departments for C2C Global Portal...');
        await prisma.departmentMaster.createMany({
          data: [
            { name: 'Design', code: 'DES', description: 'Design & UX Department', organizationId: c2cOrg.id, status: 'ACTIVE' },
            { name: 'Engineering', code: 'ENG', description: 'Software Engineering Department', organizationId: c2cOrg.id, status: 'ACTIVE' },
            { name: 'Human Resources', code: 'HR', description: 'HR & Operations', organizationId: c2cOrg.id, status: 'ACTIVE' }
          ]
        });
        console.log('Created default C2C departments (Design, Engineering, Human Resources)');
      }
    }

    // 3. Ensure RENI has departments if none exist
    if (reniOrg) {
      const reniDepts = await prisma.departmentMaster.findMany({
        where: { organizationId: reniOrg.id }
      });
      if (reniDepts.length === 0) {
        console.log('Creating default departments for RENI...');
        await prisma.departmentMaster.createMany({
          data: [
            { name: 'Design', code: 'DES', description: 'Design Department', organizationId: reniOrg.id, status: 'ACTIVE' },
            { name: 'Development', code: 'DEV', description: 'Development Department', organizationId: reniOrg.id, status: 'ACTIVE' }
          ]
        });
        console.log('Created default RENI departments (Design, Development)');
      }
    }

    // 4. Also ensure C2C has positions if none exist
    if (c2cOrg) {
      const c2cPositions = await prisma.position.findMany({
        where: { organizationId: c2cOrg.id }
      });
      if (c2cPositions.length === 0) {
        console.log('Creating default positions for C2C Global Portal...');
        await prisma.position.createMany({
          data: [
            { organizationId: c2cOrg.id, name: 'Intern', code: 'INT', level: 1, color: '#10B981' },
            { organizationId: c2cOrg.id, name: 'Junior Developer', code: 'JR-DEV', level: 2, color: '#3B82F6' },
            { organizationId: c2cOrg.id, name: 'Senior Developer', code: 'SR-DEV', level: 3, color: '#8B5CF6' }
          ]
        });
        console.log('Created default C2C positions');
      }
    }

  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
