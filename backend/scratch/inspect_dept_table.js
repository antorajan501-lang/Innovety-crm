const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  try {
    const sampleDept = await prisma.departmentMaster.findFirst();
    console.log('Sample department record:', sampleDept);

    const cols = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'DepartmentMaster'
    `;
    console.log('DepartmentMaster columns:', cols);

    const orgs = await prisma.organization.findMany({ select: { id: true, name: true, companyCode: true } });
    console.log('Organizations:', orgs);
  } catch (err) {
    console.error('Inspect error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
