const prisma = require('../backend/src/utils/db');

async function main() {
  try {
    const res = await prisma.leaveType.delete({
      where: { id: '1dbeb453-3a15-4bb2-99ed-7946cd40c743' }
    });
    console.log('Successfully deleted:', res);
  } catch (err) {
    console.error('DELETE ERROR Code:', err.code);
    console.error('DELETE ERROR Message:', err.message);
    console.error('DELETE ERROR Meta:', err.meta);
  } finally {
    await prisma.$disconnect();
  }
}

main();
