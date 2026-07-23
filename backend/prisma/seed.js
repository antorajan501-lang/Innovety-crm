const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding complete, accurate Innovety CRM dataset...');

  // 1. Admin User
  const adminPass = await bcrypt.hash('Admin123!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@enterprise-crm.com' },
    update: {
      employeeId: 'AD-0001',
      name: 'System Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      department: 'Management',
      phone: '9876543210',
      joiningDate: new Date('2023-01-01'),
      profilePic: null
    },
    create: {
      employeeId: 'AD-0001',
      name: 'System Admin',
      email: 'admin@enterprise-crm.com',
      password: adminPass,
      dob: new Date('1990-01-01'),
      role: 'ADMIN',
      status: 'ACTIVE',
      department: 'Management',
      phone: '9876543210',
      joiningDate: new Date('2023-01-01'),
      profilePic: null
    }
  });

  // 2. Team Leaders
  await prisma.user.upsert({
    where: { email: 'paulrenine9487@gmail.com' },
    update: { employeeId: 'TL-1001', name: 'Paul Renine', role: 'TEAM_LEADER', profilePic: null },
    create: {
      employeeId: 'TL-1001',
      name: 'Paul Renine',
      email: 'paulrenine9487@gmail.com',
      password: await bcrypt.hash('01012000', 10),
      dob: new Date('2000-01-01'),
      role: 'TEAM_LEADER',
      status: 'ACTIVE',
      department: 'Engineering',
      college: 'IIT Madras',
      phone: '9840123456',
      joiningDate: new Date('2023-06-01'),
      profilePic: null
    }
  });

  await prisma.user.upsert({
    where: { email: 'somusuraj72@gmail.com' },
    update: { employeeId: 'TL-1002', name: 'Suraj S', role: 'TEAM_LEADER', profilePic: null },
    create: {
      employeeId: 'TL-1002',
      name: 'Suraj S',
      email: 'somusuraj72@gmail.com',
      password: await bcrypt.hash('01012001', 10),
      dob: new Date('2001-01-01'),
      role: 'TEAM_LEADER',
      status: 'ACTIVE',
      department: 'Engineering',
      college: 'Anna University',
      phone: '9840999888',
      joiningDate: new Date('2023-08-01'),
      profilePic: null
    }
  });

  // 3. Employees
  await prisma.user.upsert({
    where: { email: 'employee@gmail.com' },
    update: {
      employeeId: 'EM-1001',
      name: 'Divya R',
      role: 'EMPLOYEE',
      profilePic: '/uploads/profile-pics/1784611100866-782649457-WhatsApp Image 2026-07-21 at 10.45.15 AM.jpeg'
    },
    create: {
      employeeId: 'EM-1001',
      name: 'Divya R',
      email: 'employee@gmail.com',
      password: await bcrypt.hash('01012004', 10),
      dob: new Date('2004-01-01'),
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      department: 'Engineering',
      college: 'Anna University',
      phone: '9790123456',
      joiningDate: new Date('2024-01-10'),
      profilePic: '/uploads/profile-pics/1784611100866-782649457-WhatsApp Image 2026-07-21 at 10.45.15 AM.jpeg'
    }
  });

  await prisma.user.upsert({
    where: { email: 'e2etest.employee@crm.com' },
    update: { employeeId: 'EM-1002', name: 'E2E Test Employee', role: 'EMPLOYEE', profilePic: null },
    create: {
      employeeId: 'EM-1002',
      name: 'E2E Test Employee',
      email: 'e2etest.employee@crm.com',
      password: await bcrypt.hash('15051999', 10),
      dob: new Date('1999-05-15'),
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      department: 'Engineering',
      college: 'PSG Tech',
      phone: '9876543210',
      joiningDate: new Date('2024-01-15'),
      profilePic: null
    }
  });

  // 4. Interns (IN-1001 to IN-1006)
  await prisma.user.upsert({
    where: { email: 'yeshwanthy1504@gmail.com' },
    update: {
      employeeId: 'IN-1001',
      name: 'Yeshwanth Y',
      role: 'INTERN',
      profilePic: '/uploads/profile-pics/1784613332745-367438346-WhatsApp Image 2026-07-21 at 10.54.42 AM (2).jpeg'
    },
    create: {
      employeeId: 'IN-1001',
      name: 'Yeshwanth Y',
      email: 'yeshwanthy1504@gmail.com',
      password: await bcrypt.hash('15042004', 10),
      dob: new Date('2004-04-15'),
      role: 'INTERN',
      status: 'ACTIVE',
      department: 'Software Engineering',
      college: 'R.M.K Engineering College',
      phone: '9440123456',
      joiningDate: new Date('2024-02-01'),
      profilePic: '/uploads/profile-pics/1784613332745-367438346-WhatsApp Image 2026-07-21 at 10.54.42 AM (2).jpeg'
    }
  });

  await prisma.user.upsert({
    where: { email: 'antorajan501@gmail.com' },
    update: {
      employeeId: 'IN-1002',
      name: 'Anto A',
      role: 'INTERN',
      profilePic: '/uploads/profile-pics/1784611752758-479642495-file_00000000b40871fd9d636256e04dfd7e.png'
    },
    create: {
      employeeId: 'IN-1002',
      name: 'Anto A',
      email: 'antorajan501@gmail.com',
      password: await bcrypt.hash('10062004', 10),
      dob: new Date('2004-06-10'),
      role: 'INTERN',
      status: 'ACTIVE',
      department: 'Computer Science',
      college: 'Madras Christian College',
      phone: '9500123456',
      joiningDate: new Date('2024-02-01'),
      profilePic: '/uploads/profile-pics/1784611752758-479642495-file_00000000b40871fd9d636256e04dfd7e.png'
    }
  });

  await prisma.user.upsert({
    where: { email: 'prasathragul75@gmail.com' },
    update: {
      employeeId: 'IN-1003',
      name: 'Raghul Prasath',
      role: 'INTERN',
      profilePic: '/uploads/profile-pics/1784611003235-757691450-WhatsApp Image 2026-07-21 at 10.44.46 AM.jpeg'
    },
    create: {
      employeeId: 'IN-1003',
      name: 'Raghul Prasath',
      email: 'prasathragul75@gmail.com',
      password: await bcrypt.hash('29092003', 10),
      dob: new Date('2003-09-29'),
      role: 'INTERN',
      status: 'ACTIVE',
      department: 'Software Engineering',
      college: 'Madras Christian College',
      phone: '9600123456',
      joiningDate: new Date('2024-02-01'),
      profilePic: '/uploads/profile-pics/1784611003235-757691450-WhatsApp Image 2026-07-21 at 10.44.46 AM.jpeg'
    }
  });

  await prisma.user.upsert({
    where: { email: 'praveen.natarajan.in@gmail.com' },
    update: {
      employeeId: 'IN-1004',
      name: 'Praveen N',
      role: 'INTERN',
      profilePic: '/uploads/profile-pics/1784611528366-422846841-WhatsApp Image 2026-07-21 at 10.54.42 AM.jpeg'
    },
    create: {
      employeeId: 'IN-1004',
      name: 'Praveen N',
      email: 'praveen.natarajan.in@gmail.com',
      password: await bcrypt.hash('12032004', 10),
      dob: new Date('2004-03-12'),
      role: 'INTERN',
      status: 'ACTIVE',
      department: 'MCA',
      college: 'Madras Christian College',
      phone: '9700123456',
      joiningDate: new Date('2024-02-01'),
      profilePic: '/uploads/profile-pics/1784611528366-422846841-WhatsApp Image 2026-07-21 at 10.54.42 AM.jpeg'
    }
  });

  await prisma.user.upsert({
    where: { email: 'nancythomasselva@gmail.com' },
    update: {
      employeeId: 'IN-1005',
      name: 'Nancy Narmadha T',
      role: 'INTERN',
      profilePic: '/uploads/profile-pics/1784611100866-782649457-WhatsApp Image 2026-07-21 at 10.45.15 AM.jpeg'
    },
    create: {
      employeeId: 'IN-1005',
      name: 'Nancy Narmadha T',
      email: 'nancythomasselva@gmail.com',
      password: await bcrypt.hash('18082004', 10),
      dob: new Date('2004-08-18'),
      role: 'INTERN',
      status: 'ACTIVE',
      department: 'MCA',
      college: 'Madras Christian College',
      phone: '9800123456',
      joiningDate: new Date('2024-02-01'),
      profilePic: '/uploads/profile-pics/1784611100866-782649457-WhatsApp Image 2026-07-21 at 10.45.15 AM.jpeg'
    }
  });

  await prisma.user.upsert({
    where: { email: 'zubairyasalamkhan213@gmail.com' },
    update: {
      employeeId: 'IN-1006',
      name: 'Zubairya Salam Khan',
      role: 'INTERN',
      profilePic: '/uploads/profile-pics/1784611814307-802463753-WhatsApp Image 2026-07-21 at 10.54.42 AM (1).jpeg'
    },
    create: {
      employeeId: 'IN-1006',
      name: 'Zubairya Salam Khan',
      email: 'zubairyasalamkhan213@gmail.com',
      password: await bcrypt.hash('25112004', 10),
      dob: new Date('2004-11-25'),
      role: 'INTERN',
      status: 'ACTIVE',
      department: 'MCA',
      college: 'Madras Christian College',
      phone: '9900123456',
      joiningDate: new Date('2024-02-01'),
      profilePic: '/uploads/profile-pics/1784611814307-802463753-WhatsApp Image 2026-07-21 at 10.54.42 AM (1).jpeg'
    }
  });

  // 5. System Settings
  await prisma.systemSettings.upsert({
    where: { id: 'GLOBAL' },
    update: {},
    create: {
      id: 'GLOBAL',
      companyName: 'INNOVEITY CRM',
      senderEmail: 'no-reply@enterprise-crm.com',
      internShiftStart: '09:30',
      internShiftEnd: '18:30',
      tlShiftStart: '09:30',
      tlShiftEnd: '18:30',
      officeLatitude: 12.971598,
      officeLongitude: 77.594562,
      allowedRadiusMeters: 200.0,
      officeLocationName: 'INNOVEITY Headquarters'
    }
  });

  console.log('Database seeding complete: All users restored with full integrity.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
