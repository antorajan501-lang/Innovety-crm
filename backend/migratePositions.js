const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Enterprise Organization & Position Seeding & User Migration...');

  // 1. Seed Default Positions
  const defaultPositions = [
    { name: 'Intern', code: 'POS-INT', level: 1, color: '#6366F1', textColor: '#FFFFFF', icon: 'UserCheck', priority: 1, sortOrder: 1, description: 'Trainee or Student Intern position' },
    { name: 'Junior', code: 'POS-JUN', level: 2, color: '#3B82F6', textColor: '#FFFFFF', icon: 'Award', priority: 2, sortOrder: 2, description: 'Junior Staff / Associate Software Engineer' },
    { name: 'Associate', code: 'POS-ASC', level: 3, color: '#06B6D4', textColor: '#FFFFFF', icon: 'Briefcase', priority: 3, sortOrder: 3, description: 'Mid-level Staff Professional' },
    { name: 'Senior', code: 'POS-SNR', level: 4, color: '#10B981', textColor: '#FFFFFF', icon: 'Star', priority: 4, sortOrder: 4, description: 'Senior Specialist / Senior Developer' },
    { name: 'Lead', code: 'POS-LED', level: 5, color: '#F59E0B', textColor: '#FFFFFF', icon: 'Zap', priority: 5, sortOrder: 5, description: 'Team Leader / Technical Lead' },
    { name: 'Manager', code: 'POS-MGR', level: 6, color: '#8B5CF6', textColor: '#FFFFFF', icon: 'Shield', priority: 6, sortOrder: 6, description: 'Department Manager / Administrator' },
    { name: 'Senior Manager', code: 'POS-SMG', level: 7, color: '#EC4899', textColor: '#FFFFFF', icon: 'Crown', priority: 7, sortOrder: 7, description: 'Senior Operations & Delivery Manager' },
    { name: 'Director', code: 'POS-DIR', level: 8, color: '#EF4444', textColor: '#FFFFFF', icon: 'Globe', priority: 8, sortOrder: 8, description: 'Executive Officer / Executive Director / Super Admin' }
  ];

  const positionMap = {};

  for (const posData of defaultPositions) {
    const pos = await prisma.position.upsert({
      where: { code: posData.code },
      update: {
        name: posData.name,
        level: posData.level,
        color: posData.color,
        textColor: posData.textColor,
        icon: posData.icon,
        priority: posData.priority,
        sortOrder: posData.sortOrder,
        description: posData.description
      },
      create: posData
    });
    positionMap[pos.code] = pos;
    console.log(`  ✓ Position seeded: ${pos.name} (${pos.code}) - Level ${pos.level}`);
  }

  // 2. Seed Default Branches
  const defaultBranches = [
    { name: 'Headquarters (Bangalore)', code: 'BR-BLR', city: 'Bangalore', country: 'India' },
    { name: 'Tech Hub (Chennai)', code: 'BR-MAA', city: 'Chennai', country: 'India' },
    { name: 'Innovation Center (Hyderabad)', code: 'BR-HYD', city: 'Hyderabad', country: 'India' }
  ];
  const branchMap = {};
  for (const b of defaultBranches) {
    const branch = await prisma.orgBranch.upsert({
      where: { code: b.code },
      update: { name: b.name, city: b.city },
      create: b
    });
    branchMap[b.name] = branch;
  }

  // 3. Seed Default Departments
  const defaultDepartments = [
    { name: 'Software Development', code: 'DEP-DEV', description: 'Core Engineering & Software Architecture' },
    { name: 'Quality Assurance & Testing', code: 'DEP-QA', description: 'Quality Engineering & Automation Testing' },
    { name: 'Human Resources & Talent', code: 'DEP-HR', description: 'HR, Recruitment & Talent Management' },
    { name: 'Finance & Payroll', code: 'DEP-FIN', description: 'Finance, Payroll & Accounts' },
    { name: 'Product & Design', code: 'DEP-PRD', description: 'Product Management & UX Design' }
  ];
  const deptMap = {};
  for (const d of defaultDepartments) {
    const dept = await prisma.departmentMaster.upsert({
      where: { code: d.code },
      update: { name: d.name, description: d.description },
      create: d
    });
    deptMap[dept.name] = dept;
  }

  // 4. Seed Default Designations
  const defaultDesignations = [
    { name: 'Frontend Engineer', code: 'DES-FE', deptName: 'Software Development' },
    { name: 'Backend Engineer', code: 'DES-BE', deptName: 'Software Development' },
    { name: 'Full Stack Developer', code: 'DES-FS', deptName: 'Software Development' },
    { name: 'QA Engineer', code: 'DES-QA', deptName: 'Quality Assurance & Testing' },
    { name: 'HR Executive', code: 'DES-HR', deptName: 'Human Resources & Talent' },
    { name: 'Payroll Specialist', code: 'DES-PAY', deptName: 'Finance & Payroll' },
    { name: 'UI/UX Designer', code: 'DES-UI', deptName: 'Product & Design' },
    { name: 'Software Intern', code: 'DES-INT', deptName: 'Software Development' }
  ];
  const desigMap = {};
  for (const des of defaultDesignations) {
    const dept = deptMap[des.deptName];
    const designation = await prisma.designationMaster.upsert({
      where: { code: des.code },
      update: { name: des.name, departmentId: dept?.id },
      create: { name: des.name, code: des.code, departmentId: dept?.id }
    });
    desigMap[des.name] = designation;
  }

  // 5. Seed Default Shifts & Employment Types
  const defaultShifts = [
    { name: 'Standard Morning Shift', startTime: '09:30', endTime: '18:30' },
    { name: 'Flexible Shift', startTime: '10:00', endTime: '19:00' }
  ];
  const shiftMap = {};
  for (const s of defaultShifts) {
    const shift = await prisma.shiftMaster.upsert({
      where: { name: s.name },
      update: { startTime: s.startTime, endTime: s.endTime },
      create: s
    });
    shiftMap[s.name] = shift;
  }

  const defaultEmpTypes = ['Full-time', 'Part-time', 'Contract', 'Internship'];
  for (const etName of defaultEmpTypes) {
    await prisma.employmentTypeMaster.upsert({
      where: { name: etName },
      update: {},
      create: { name: etName }
    });
  }

  // 6. Map Existing Users to Positions, Branches, and Departments safely
  const users = await prisma.user.findMany();
  console.log(`\n🔄 Mapping ${users.length} existing users to standard positions & branches...`);

  const hqBranch = branchMap['Headquarters (Bangalore)'];
  const devDept = deptMap['Software Development'];
  const stdShift = shiftMap['Standard Morning Shift'];

  let updatedCount = 0;
  for (const user of users) {
    let targetPos = positionMap['POS-JUN']; // Default Junior

    const userRole = String(user.role).toUpperCase();
    const desigLower = String(user.designation || '').toLowerCase();

    if (userRole === 'INTERN') {
      targetPos = positionMap['POS-INT'];
    } else if (userRole === 'EMPLOYEE') {
      if (desigLower.includes('senior') || desigLower.includes('sr.')) {
        targetPos = positionMap['POS-SNR'];
      } else if (desigLower.includes('associate')) {
        targetPos = positionMap['POS-ASC'];
      } else {
        targetPos = positionMap['POS-JUN'];
      }
    } else if (userRole === 'TEAM_LEADER') {
      targetPos = positionMap['POS-LED'];
    } else if (userRole === 'ADMIN') {
      targetPos = positionMap['POS-MGR'];
    } else if (userRole === 'SUPER_ADMIN') {
      targetPos = positionMap['POS-DIR'];
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        positionId: targetPos.id,
        branchId: user.branchId || hqBranch?.id,
        departmentId: user.departmentId || devDept?.id,
        shiftId: user.shiftId || stdShift?.id,
        employmentType: user.employmentType || (userRole === 'INTERN' ? 'Internship' : 'Full-time')
      }
    });

    updatedCount++;
    console.log(`  ✓ Updated ${user.name} (${user.role}) -> Position: ${targetPos.name}`);
  }

  console.log(`\n✅ Position Seeding & Migration Completed Successfully! Total updated users: ${updatedCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
