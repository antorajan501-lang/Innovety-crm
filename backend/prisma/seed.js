const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@enterprise-crm.com';
  
  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    const dobDate = new Date('1990-01-01');

    const admin = await prisma.user.create({
      data: {
        employeeId: 'AD-0001',
        name: 'System Admin',
        email: adminEmail,
        password: hashedPassword,
        dob: dobDate,
        role: 'ADMIN',
        status: 'ACTIVE',
        department: 'Management',
        phone: '1234567890',
        joiningDate: new Date()
      }
    });

    console.log('Seeded Initial Admin User:', admin.email);
  } else {
    console.log('Admin user already exists. Skipping seeding.');
  }

  // Seed default repositories if empty
  await prisma.repository.deleteMany();
  const repoCount = await prisma.repository.count();
  if (repoCount === 0) {
    await prisma.repository.create({
      data: {
        name: 'mrf-crm-frontend',
        url: 'https://github.com/mrf-enterprise/mrf-crm-frontend',
        lang: 'React/JS',
        status: 'Passing',
        commitsCount: 142,
        branches: {
          create: [
            { name: 'main', url: 'https://github.com/mrf-enterprise/mrf-crm-frontend/tree/main', isDefault: true },
            { name: 'develop', url: 'https://github.com/mrf-enterprise/mrf-crm-frontend/tree/develop' },
            { name: 'feat/attendance-geocoding', url: 'https://github.com/mrf-enterprise/mrf-crm-frontend/tree/feat/attendance-geocoding' }
          ]
        }
      }
    });

    await prisma.repository.create({
      data: {
        name: 'mrf-crm-backend',
        url: 'https://github.com/mrf-enterprise/mrf-crm-backend',
        lang: 'Node/Express/Prisma',
        status: 'Passing',
        commitsCount: 98,
        branches: {
          create: [
            { name: 'main', url: 'https://github.com/mrf-enterprise/mrf-crm-backend/tree/main', isDefault: true },
            { name: 'develop', url: 'https://github.com/mrf-enterprise/mrf-crm-backend/tree/develop' }
          ]
        }
      }
    });
    console.log('Seeded default git repositories and branches.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
