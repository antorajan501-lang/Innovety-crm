const prisma = require('../src/utils/db');

async function clockInJefferson() {
  const jefferson = await prisma.user.findFirst({ where: { email: 'jeffersonsamuel003@gmail.com' } });
  if (!jefferson) return;

  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayDate = new Date(`${todayStr}T00:00:00.000Z`);

  await prisma.attendance.upsert({
    where: {
      userId_date: {
        userId: jefferson.id,
        date: todayDate
      }
    },
    update: {
      clockIn: new Date(),
      status: 'PRESENT',
      workLocation: 'OFFICE'
    },
    create: {
      userId: jefferson.id,
      date: todayDate,
      clockIn: new Date(),
      status: 'PRESENT',
      workLocation: 'OFFICE'
    }
  });

  console.log(`✓ Clocked in Jefferson (${jefferson.email}) for today (${todayStr}).`);
  await prisma.$disconnect();
}

clockInJefferson();
