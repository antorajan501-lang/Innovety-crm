const prisma = require('./src/utils/db');

async function main() {
  const targetOrgName = process.argv[2] || 'INNOVEITY Workspace';
  console.log(`=== RESETTING PAYROLL DATA FOR ORGANIZATION: "${targetOrgName}" ===\n`);

  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { name: { contains: targetOrgName, mode: 'insensitive' } },
        { id: targetOrgName }
      ]
    }
  });

  if (!org) {
    console.error(`❌ Organization "${targetOrgName}" not found in database.`);
    process.exit(1);
  }

  const targetOrgId = org.id;
  console.log(`Target Organization ID: ${targetOrgId} (${org.name})\n`);

  // 1. Delete Payslips
  const payslipsResult = await prisma.payslip.deleteMany({
    where: { organizationId: targetOrgId }
  });
  console.log(`- Deleted ${payslipsResult.count} Payslips.`);

  // 2. Delete PayrollBatches
  const batchesResult = await prisma.payrollBatch.deleteMany({
    where: { organizationId: targetOrgId }
  });
  console.log(`- Deleted ${batchesResult.count} Payroll Batches.`);

  // 3. Delete SalaryRevisions
  const revisionsResult = await prisma.salaryRevision.deleteMany({
    where: { organizationId: targetOrgId }
  });
  console.log(`- Deleted ${revisionsResult.count} Salary Revisions.`);

  // 4. Delete SalaryStructures
  const structuresResult = await prisma.salaryStructure.deleteMany({
    where: { organizationId: targetOrgId }
  });
  console.log(`- Deleted ${structuresResult.count} Salary Structures.`);

  // 5. Reset PayrollSettings
  const existingSettings = await prisma.payrollSettings.findFirst({
    where: { organizationId: targetOrgId }
  });

  if (existingSettings) {
    await prisma.payrollSettings.update({
      where: { id: existingSettings.id },
      data: {
        cycleStartDay: 1,
        payDay: 30,
        currency: 'INR',
        overtimeHourlyRate: 150.0,
        holidayPayMultiplier: 2.0,
        weekendPayMultiplier: 1.5,
        lateDeductionRule: 'FLAT_RATE',
        lateDeductionRate: 100.0,
        halfDayDeductionRate: 0.5,
        minimumWorkingHours: 4.0,
        roundingRule: 'ROUND_HALF_UP',
        payslipTemplate: 'STANDARD'
      }
    });
    console.log(`- Reset PayrollSettings to defaults.`);
  }

  // Verify User count remained intact
  const activeUserCount = await prisma.user.count({
    where: {
      organizationId: targetOrgId,
      status: 'ACTIVE',
      role: { in: ['ADMIN', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN'] }
    }
  });

  console.log(`\n✅ PAYROLL RESET COMPLETE FOR "${org.name}"!`);
  console.log(`- Active Workforce Intact: ${activeUserCount} employees.`);
  console.log(`- Assigned Salary Structures: 0.`);
  console.log(`- Pending Structure Assignments: ${activeUserCount}.`);
  console.log(`- Published Payroll Batches: 0.`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during payroll reset:', err);
  process.exit(1);
});
