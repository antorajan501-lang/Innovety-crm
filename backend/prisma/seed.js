const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding complete, accurate Innovety CRM dataset...');

  // 0. Default Organizations (INNOVEITY, C2C Global Portal, RENI)
  const innoveityOrg = await prisma.organization.upsert({
    where: { slug: 'innoveity' },
    update: { name: 'INNOVEITY Workspace', companyCode: 'INN001', status: 'ACTIVE' },
    create: { name: 'INNOVEITY Workspace', slug: 'innoveity', companyCode: 'INN001', status: 'ACTIVE', timezone: 'Asia/Kolkata' }
  });

  const c2cOrg = await prisma.organization.upsert({
    where: { slug: 'c2c' },
    update: { name: 'C2C Global Portal', companyCode: 'C2C001', status: 'ACTIVE' },
    create: { name: 'C2C Global Portal', slug: 'c2c', companyCode: 'C2C001', status: 'ACTIVE', timezone: 'Asia/Kolkata' }
  });

  const reniOrg = await prisma.organization.upsert({
    where: { slug: 'reni' },
    update: { name: 'RENI', companyCode: 'RENI001', status: 'ACTIVE' },
    create: { name: 'RENI', slug: 'reni', companyCode: 'RENI001', status: 'ACTIVE', timezone: 'Asia/Kolkata' }
  });

  console.log('Organizations (INNOVEITY, C2C, RENI) verified/created.');

  // Phase 7.1: Seed Default Subscription Plans
  const plans = [
    { name: 'Starter', code: 'STARTER', maxUsers: 25, maxProjects: 5, maxStorageGB: 5, maxAdmins: 2, features: { customBranding: true, prioritySupport: false } },
    { name: 'Growth', code: 'GROWTH', maxUsers: 100, maxProjects: 50, maxStorageGB: 25, maxAdmins: 10, features: { customBranding: true, prioritySupport: true } },
    { name: 'Enterprise', code: 'ENTERPRISE', maxUsers: 999999, maxProjects: 999999, maxStorageGB: 9999, maxAdmins: 999999, features: { customBranding: true, prioritySupport: true, dedicatedManager: true } }
  ];

  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: p,
      create: p
    });
  }
  console.log('Default subscription plans seeded.');

  // Assign any unassigned records across all business models to INNOVEITY
  const innoveityRecord = await prisma.organization.findUnique({ where: { slug: 'innoveity' } });
  if (innoveityRecord) {
    const enterprisePlan = await prisma.subscriptionPlan.findUnique({ where: { code: 'ENTERPRISE' } });
    if (enterprisePlan && !innoveityRecord.subscriptionPlanId) {
      await prisma.organization.update({
        where: { id: innoveityRecord.id },
        data: { subscriptionPlanId: enterprisePlan.id }
      });
      console.log('INNOVEITY assigned to Enterprise subscription plan.');
    }
    const models = ['user', 'project', 'task', 'chatRoom', 'team', 'ticket', 'asset', 'workCalendar'];
    for (const m of models) {
      const res = await prisma[m].updateMany({
        where: { organizationId: null },
        data: { organizationId: innoveityRecord.id }
      });
      if (res.count > 0) {
        console.log(`Assigned ${res.count} unassigned ${m} records to INNOVEITY.`);
      }
    }

    // Phase 4.1: OrganizationSettings default initialization
    const existingOrgSettings = await prisma.organizationSettings.findUnique({
      where: { organizationId: innoveityRecord.id }
    });
    if (!existingOrgSettings) {
      await prisma.organizationSettings.create({
        data: {
          organizationId: innoveityRecord.id,
          companyName: innoveityRecord.name || 'INNOVEITY',
          primaryColor: '#10B981',
          timezone: 'Asia/Kolkata',
          clockInTime: '09:00',
          clockOutTime: '18:00',
          autoClockOutEnabled: true
        }
      });
      console.log('Default OrganizationSettings created for INNOVEITY.');
    }
  }

  // 0. Super Admin User
  const superAdminPass = await bcrypt.hash('SuperAdmin123!', 10);
  await prisma.user.upsert({
    where: { email: 'superadmin@enterprise-crm.com' },
    update: {
      employeeId: 'SUP-001',
      name: 'Super Admin',
      password: superAdminPass,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      department: 'Executive Board'
    },
    create: {
      employeeId: 'SUP-001',
      name: 'Super Admin',
      email: 'superadmin@enterprise-crm.com',
      password: superAdminPass,
      dob: new Date('1985-01-01'),
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      department: 'Executive Board',
      phone: '9998887770',
      joiningDate: new Date('2022-01-01')
    }
  });

  // 1. Admin User
  const adminPass = await bcrypt.hash('Admin123!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@enterprise-crm.com' },
    update: {
      employeeId: 'AD-0001',
      name: 'System Admin',
      password: adminPass,
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
      phone: '9876543210',
      joiningDate: new Date('2023-01-01'),
      profilePic: null
    }
  });

  // 1b. C2C Admin (Vedha) & RENI Admin (John)
  await prisma.user.upsert({
    where: { email: 'vedha@gmail.com' },
    update: {
      employeeId: 'AD-C2C-01',
      name: 'Vedha Admin',
      password: adminPass,
      role: 'ADMIN',
      organizationId: c2cOrg.id,
      status: 'ACTIVE'
    },
    create: {
      employeeId: 'AD-C2C-01',
      name: 'Vedha Admin',
      email: 'vedha@gmail.com',
      password: adminPass,
      role: 'ADMIN',
      organizationId: c2cOrg.id,
      status: 'ACTIVE',
      department: 'Management'
    }
  });

  await prisma.user.upsert({
    where: { email: 'john@gmail.com' },
    update: {
      employeeId: 'AD-RENI-01',
      name: 'John Admin',
      password: adminPass,
      role: 'ADMIN',
      organizationId: reniOrg.id,
      status: 'ACTIVE'
    },
    create: {
      employeeId: 'AD-RENI-01',
      name: 'John Admin',
      email: 'john@gmail.com',
      password: adminPass,
      role: 'ADMIN',
      organizationId: reniOrg.id,
      status: 'ACTIVE',
      department: 'Management'
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
      name: 'Divya R',
      role: 'EMPLOYEE',
      profilePic: '/uploads/profile-pics/1784611100866-782649457-WhatsApp Image 2026-07-21 at 10.45.15 AM.jpeg'
    },
    create: {
      employeeId: 'EM-9001',
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
    update: {
      name: 'E2E Test Employee', role: 'EMPLOYEE', profilePic: null },
    create: {
      employeeId: 'EM-9002',
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
      name: 'Yeshwanth Y',
      role: 'INTERN',
      profilePic: '/uploads/profile-pics/1784613332745-367438346-WhatsApp Image 2026-07-21 at 10.54.42 AM (2).jpeg'
    },
    create: {
      employeeId: 'IN-9001',
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
      name: 'Anto A',
      role: 'INTERN',
      profilePic: '/uploads/profile-pics/1784611752758-479642495-file_00000000b40871fd9d636256e04dfd7e.png'
    },
    create: {
      employeeId: 'IN-9002',
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
      name: 'Raghul Prasath',
      role: 'INTERN',
      profilePic: '/uploads/profile-pics/1784611003235-757691450-WhatsApp Image 2026-07-21 at 10.44.46 AM.jpeg'
    },
    create: {
      employeeId: 'IN-9003',
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
      name: 'Praveen N',
      role: 'INTERN',
      profilePic: '/uploads/profile-pics/1784611528366-422846841-WhatsApp Image 2026-07-21 at 10.54.42 AM.jpeg'
    },
    create: {
      employeeId: 'IN-9004',
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

  // 6. Global Leave Policy & System Leave Types Seeding
  const globalPolicy = await prisma.leavePolicy.findFirst({
    where: { isGlobal: true }
  });

  if (!globalPolicy) {
    await prisma.leavePolicy.create({
      data: {
        isGlobal: true,
        allocationType: 'ANNUAL',
        carryForwardEnabled: true,
        maxCarryForwardDays: 5.0,
        halfDayAllowed: true,
        workingDaysOnly: true,
        autoApproval: false
      }
    });
  }

  const defaultLeaveTypes = [
    {
      name: 'Casual Leave',
      code: 'CL',
      description: 'Paid casual leave for personal obligations',
      color: '#10B981',
      icon: 'Calendar',
      displayOrder: 1,
      isPaid: true,
      annualDays: 12.0,
      monthlyCreditDays: 1.0,
      allowCarryForward: true,
      isSystem: true,
      isActive: true
    },
    {
      name: 'Sick Leave',
      code: 'SL',
      description: 'Paid medical and sick leave',
      color: '#EF4444',
      icon: 'Stethoscope',
      displayOrder: 2,
      isPaid: true,
      annualDays: 10.0,
      monthlyCreditDays: 0.0,
      allowCarryForward: false,
      isSystem: true,
      isActive: true
    },
    {
      name: 'Emergency Leave',
      code: 'EL',
      description: 'Urgent emergency leave',
      color: '#F59E0B',
      icon: 'AlertCircle',
      displayOrder: 3,
      isPaid: true,
      annualDays: 5.0,
      monthlyCreditDays: 0.0,
      allowCarryForward: false,
      isSystem: true,
      isActive: true
    },
    {
      name: 'Loss Of Pay',
      code: 'LOP',
      description: 'Unpaid leave when balance is exhausted',
      color: '#6B7280',
      icon: 'Clock',
      displayOrder: 4,
      isPaid: false,
      annualDays: 0.0,
      monthlyCreditDays: 0.0,
      allowCarryForward: false,
      isSystem: true,
      isActive: true
    }
  ];

  for (const lt of defaultLeaveTypes) {
    await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {
        name: lt.name,
        color: lt.color,
        icon: lt.icon,
        isSystem: true,
        displayOrder: lt.displayOrder
      },
      create: lt
    });
  }

  // Initialize Leave Balances for all users
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const allLeaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });

  for (const u of allUsers) {
    for (const lt of allLeaveTypes) {
      await prisma.userLeaveBalance.upsert({
        where: {
          userId_leaveTypeId: {
            userId: u.id,
            leaveTypeId: lt.id
          }
        },
        update: {},
        create: {
          userId: u.id,
          leaveTypeId: lt.id,
          allocated: lt.annualDays,
          used: 0,
          pending: 0,
          available: lt.annualDays,
          carryForward: 0,
          expired: 0,
          lastCreditedAt: new Date()
        }
      });
    }
  }

  console.log('Database seeding complete: All users, leave policy & default leave types restored with full integrity.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
