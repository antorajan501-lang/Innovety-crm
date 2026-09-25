const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function repairDatabase() {
  console.log('====================================================');
  console.log('STARTING IDEMPOTENT DATABASE INTEGRITY REPAIR');
  console.log('====================================================');

  // 1. Ensure Default Organizations Exist
  const innoveityOrg = await prisma.organization.upsert({
    where: { slug: 'innoveity' },
    update: { name: 'INNOVEITY Workspace', companyCode: 'INN001', status: 'ACTIVE' },
    create: { name: 'INNOVEITY Workspace', slug: 'innoveity', companyCode: 'INN001', status: 'ACTIVE', timezone: 'Asia/Kolkata' }
  });

  await prisma.organization.upsert({
    where: { slug: 'c2c' },
    update: { name: 'C2C Global Portal', companyCode: 'C2C001', status: 'ACTIVE' },
    create: { name: 'C2C Global Portal', slug: 'c2c', companyCode: 'C2C001', status: 'ACTIVE', timezone: 'Asia/Kolkata' }
  });

  await prisma.organization.upsert({
    where: { slug: 'reni' },
    update: { name: 'RENI', companyCode: 'RENI001', status: 'ACTIVE' },
    create: { name: 'RENI', slug: 'reni', companyCode: 'RENI001', status: 'ACTIVE', timezone: 'Asia/Kolkata' }
  });

  console.log('[1] Organizations verified (INNOVEITY, C2C, RENI).');

  // 2. Ensure Default Subscription Plans Exist
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
  console.log('[2] Subscription plans verified.');

  // 3. Ensure OrganizationSettings for All Organizations
  const allOrgs = await prisma.organization.findMany();
  for (const org of allOrgs) {
    const existing = await prisma.organizationSettings.findUnique({
      where: { organizationId: org.id }
    });

    if (!existing) {
      await prisma.organizationSettings.create({
        data: {
          organizationId: org.id,
          branding: { companyName: org.name, companyLogo: org.logo || null, selectedTheme: 'emerald', themeMode: 'light' },
          theme: { selectedTheme: 'emerald', themeMode: 'light' },
          chatEnabledForAdmins: true,
          chatEnabledForUsers: true
        }
      });
      console.log(` Created missing OrganizationSettings for [${org.name}]`);
    } else {
      await prisma.organizationSettings.update({
        where: { organizationId: org.id },
        data: {
          chatEnabledForAdmins: true,
          chatEnabledForUsers: true
        }
      });
    }
  }
  console.log('[3] OrganizationSettings records verified.');

  // 4. Backfill Unassigned Records to Default INNOVEITY Org
  const models = ['user', 'project', 'task', 'chatRoom', 'team', 'ticket', 'asset', 'workCalendar'];
  for (const m of models) {
    try {
      const res = await prisma[m].updateMany({
        where: { organizationId: null },
        data: { organizationId: innoveityOrg.id }
      });
      if (res.count > 0) {
        console.log(`[4] Backfilled ${res.count} unassigned ${m} records to INNOVEITY.`);
      }
    } catch (e) {
      console.warn(`[4] Notice backfilling ${m}:`, e.message);
    }
  }

  // 5. Ensure Super Admin Account
  const superAdminPass = await bcrypt.hash('SuperAdmin123!', 10);
  await prisma.user.upsert({
    where: { email: 'superadmin@enterprise-crm.com' },
    update: { status: 'ACTIVE', role: 'SUPER_ADMIN' },
    create: {
      employeeId: 'SUP-001',
      name: 'Super Admin',
      email: 'superadmin@enterprise-crm.com',
      password: superAdminPass,
      dob: new Date('1985-01-01'),
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      department: 'Executive Board',
      organizationId: innoveityOrg.id
    }
  });
  console.log('[5] Super Admin account verified.');

  // 6. Ensure Default Company Shifts and Member Assignments
  const { ensureDefaultShiftsForExistingOrgs } = require('../src/services/shiftService');
  const shiftResults = await ensureDefaultShiftsForExistingOrgs(prisma);
  console.log(`[6] Verified default company shifts for ${shiftResults.length} organization(s).`);

  console.log('====================================================');
  console.log('DATABASE REPAIR COMPLETED SUCCESSFULLY');
  console.log('====================================================');
}

repairDatabase()
  .catch(err => {
    console.error('Database repair error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
