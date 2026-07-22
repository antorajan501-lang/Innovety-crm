const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Innovety CRM database...');

  // 1. Admin User
  const adminEmail = 'admin@enterprise-crm.com';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    admin = await prisma.user.create({
      data: {
        employeeId: 'AD-0001',
        name: 'System Admin',
        email: adminEmail,
        password: hashedPassword,
        dob: new Date('1990-01-01'),
        role: 'ADMIN',
        status: 'ACTIVE',
        department: 'Management',
        phone: '9876543210',
        joiningDate: new Date('2023-01-01')
      }
    });
    console.log('Seeded Admin User: AD-0001');
  }

  // 2. Team Leaders
  const tlPass = await bcrypt.hash('01012000', 10);
  const leader1 = await prisma.user.upsert({
    where: { email: 'paulrenine9487@gmail.com' },
    update: {},
    create: {
      employeeId: 'TL-1001',
      name: 'Paul Renine',
      email: 'paulrenine9487@gmail.com',
      password: tlPass,
      dob: new Date('2000-01-01'),
      role: 'TEAM_LEADER',
      status: 'ACTIVE',
      department: 'Engineering',
      college: 'IIT Madras',
      phone: '9840123456',
      joiningDate: new Date('2023-06-01')
    }
  });

  // 3. Employees
  const emp1Pass = await bcrypt.hash('01012004', 10);
  const emp1 = await prisma.user.upsert({
    where: { email: 'employee@gmail.com' },
    update: {},
    create: {
      employeeId: 'EM-1001',
      name: 'Divya R',
      email: 'employee@gmail.com',
      password: emp1Pass,
      dob: new Date('2004-01-01'),
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      department: 'Engineering',
      college: 'Anna University',
      phone: '9790123456',
      joiningDate: new Date('2024-01-10')
    }
  });

  const emp2Pass = await bcrypt.hash('15051999', 10);
  const emp2 = await prisma.user.upsert({
    where: { email: 'e2etest.employee@crm.com' },
    update: {},
    create: {
      employeeId: 'EM-1002',
      name: 'E2E Test Employee',
      email: 'e2etest.employee@crm.com',
      password: emp2Pass,
      dob: new Date('1999-05-15'),
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      department: 'Engineering',
      college: 'PSG Tech',
      phone: '9876543210',
      joiningDate: new Date('2024-01-15')
    }
  });

  // 4. Interns
  const internPass = await bcrypt.hash('15042004', 10);
  const intern1 = await prisma.user.upsert({
    where: { email: 'yeshwanthy1504@gmail.com' },
    update: {},
    create: {
      employeeId: 'IN-1001',
      name: 'Yeshwanth Y',
      email: 'yeshwanthy1504@gmail.com',
      password: internPass,
      dob: new Date('2004-04-15'),
      role: 'INTERN',
      status: 'ACTIVE',
      department: 'Software Engineering',
      college: 'R.M.K Engineering College',
      phone: '9440123456',
      joiningDate: new Date('2024-02-01')
    }
  });

  const intern2 = await prisma.user.upsert({
    where: { email: 'antorajan501@gmail.com' },
    update: {},
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
      joiningDate: new Date('2024-02-01')
    }
  });

  const intern3 = await prisma.user.upsert({
    where: { email: 'prasathragul75@gmail.com' },
    update: {},
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
      joiningDate: new Date('2024-02-01')
    }
  });

  const leader2 = await prisma.user.upsert({
    where: { email: 'somusuraj72@gmail.com' },
    update: {},
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
      joiningDate: new Date('2023-08-01')
    }
  });

  const intern4 = await prisma.user.upsert({
    where: { email: 'praveen.natarajan.in@gmail.com' },
    update: {},
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
      joiningDate: new Date('2024-02-01')
    }
  });

  const intern5 = await prisma.user.upsert({
    where: { email: 'nancythomasselva@gmail.com' },
    update: {},
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
      joiningDate: new Date('2024-02-01')
    }
  });

  const intern6 = await prisma.user.upsert({
    where: { email: 'zubairyasalamkhan213@gmail.com' },
    update: {},
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
      joiningDate: new Date('2024-02-01')
    }
  });

  // 5. Teams — always recreate with all current members
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();

  const team = await prisma.team.create({
    data: {
      name: 'Core CRM Development Team',
      description: 'Primary team managing full-stack sprint deliverables, CRM modules & API integrations.',
      leaderId: leader1.id,
      members: {
        create: [
          { userId: emp1.id },
          { userId: emp2.id },
          { userId: intern1.id },
          { userId: intern2.id },
          { userId: intern3.id },
          { userId: intern4.id }
        ]
      }
    }
  });
  console.log('Seeded Team: Core CRM Development Team');

  const team2 = await prisma.team.create({
    data: {
      name: 'QA & Platform Engineering Team',
      description: 'Quality assurance, CI/CD pipeline management, and cross-platform testing.',
      leaderId: leader2.id,
      members: {
        create: [
          { userId: intern5.id },
          { userId: intern6.id }
        ]
      }
    }
  });
  console.log('Seeded Team: QA & Platform Engineering Team');

  // 6. Tasks
  await prisma.task.deleteMany();
  await prisma.task.create({
    data: {
      title: 'Set up Redis Cache for Active Session Management',
      description: 'Implement distributed session caching for quick authorization checks.',
      priority: 'MEDIUM',
      status: 'PENDING',
      storyPoints: 3,
      type: 'TASK',
      assigneeId: emp1.id,
      creatorId: admin.id,
      teamId: team.id,
      deadline: new Date(Date.now() + 86400000 * 7)
    }
  });

  await prisma.task.create({
    data: {
      title: 'Implement Automated Database Backup Cron Job',
      description: 'Configure nightly PostgreSQL database dumps to secure cloud storage.',
      priority: 'HIGH',
      status: 'PENDING',
      storyPoints: 5,
      type: 'FEATURE',
      assigneeId: intern4.id,
      creatorId: leader1.id,
      teamId: team.id,
      deadline: new Date(Date.now() + 86400000 * 4)
    }
  });

  await prisma.task.create({
    data: {
      title: 'Optimize Geofenced Clock-In Attendance Logs',
      description: 'Verify latitude/longitude signatures and telemetry logs for remote WFH and office check-ins.',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      storyPoints: 3,
      type: 'TASK',
      assigneeId: intern1.id,
      creatorId: leader1.id,
      teamId: team.id,
      deadline: new Date(Date.now() + 86400000 * 5)
    }
  });

  await prisma.task.create({
    data: {
      title: 'Refactor Task Kanban Drag-and-Drop Order State',
      description: 'Smooth state transitions and immediate server syncing upon card drop.',
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      storyPoints: 5,
      type: 'BUG',
      assigneeId: intern2.id,
      creatorId: leader1.id,
      teamId: team.id,
      deadline: new Date(Date.now() + 86400000 * 2)
    }
  });

  await prisma.task.create({
    data: {
      title: 'Audit Log Export & CSV Character Encoding Fix',
      description: 'Ensure UTF-8 BOM encoding for seamless opening in Microsoft Excel without character corruption.',
      priority: 'URGENT',
      status: 'WAITING_FOR_REVIEW',
      storyPoints: 8,
      type: 'BUG',
      assigneeId: emp2.id,
      creatorId: admin.id,
      teamId: team.id,
      deadline: new Date(Date.now() + 86400000 * 2)
    }
  });

  await prisma.task.create({
    data: {
      title: 'Subtask Progress Tracker & Attachment Upload API',
      description: 'Add subtask progress bar calculation and multi-file attachment uploading.',
      priority: 'MEDIUM',
      status: 'WAITING_FOR_REVIEW',
      storyPoints: 5,
      type: 'FEATURE',
      assigneeId: intern3.id,
      creatorId: leader1.id,
      teamId: team.id,
      deadline: new Date(Date.now() + 86400000 * 3)
    }
  });

  await prisma.task.create({
    data: {
      title: 'Implement Role-Based Access Control & Registry Scoping',
      description: 'Scoping endpoints for Intern Registry, Team Leader Registry, and Employee Registry.',
      priority: 'HIGH',
      status: 'APPROVED',
      storyPoints: 5,
      type: 'FEATURE',
      assigneeId: emp1.id,
      creatorId: admin.id,
      teamId: team.id,
      deadline: new Date(Date.now() - 86400000 * 1)
    }
  });

  await prisma.task.create({
    data: {
      title: 'Attendance Clock-In Geolocation Map Marker Integration',
      description: 'Display interactive OpenStreetMap marker for verified geolocation coordinates.',
      priority: 'LOW',
      status: 'APPROVED',
      storyPoints: 3,
      type: 'FEATURE',
      assigneeId: intern5.id,
      creatorId: leader2.id,
      teamId: team2.id,
      deadline: new Date(Date.now() - 86400000 * 2)
    }
  });
  console.log('Seeded Tasks across all statuses');

  // 7. Tickets
  await prisma.ticket.deleteMany();
  await prisma.ticket.create({
    data: {
      title: 'VPN Access Request for Remote Server Deployment',
      description: 'Need WireGuard VPN credentials to access staging environment.',
      category: 'TECHNICAL',
      status: 'OPEN',
      creatorId: intern1.id
    }
  });

  await prisma.ticket.create({
    data: {
      title: 'Dual Monitor Setup Request for Workstation',
      description: 'Requesting second monitor for frontend UI testing and responsive layout inspection.',
      category: 'HARDWARE',
      status: 'IN_PROGRESS',
      creatorId: emp1.id,
      assigneeId: leader1.id
    }
  });

  await prisma.ticket.create({
    data: {
      title: 'Docker Environment Configuration Assistance',
      description: 'Experiencing port 5432 conflict during container initialization.',
      category: 'TECHNICAL',
      status: 'RESOLVED',
      creatorId: intern3.id,
      assigneeId: leader2.id
    }
  });
  console.log('Seeded Tickets');

  // 8. Announcements
  await prisma.announcement.deleteMany();
  await prisma.announcement.create({
    data: {
      title: 'Welcome to Innovety CRM Portal 2.0',
      content: 'The new unified portal is now live with enhanced role-based registries, ID authentication, and active sprint boards.',
      creatorId: admin.id
    }
  });

  await prisma.announcement.create({
    data: {
      title: 'Quarterly Sprint Roadmap Review Meeting',
      content: 'All Team Leaders and Engineers are invited to the Q3 Sprint Roadmap alignment call on Friday at 3:00 PM.',
      creatorId: leader1.id
    }
  });
  console.log('Seeded Announcements');

  // 9. Leave & WFH Applications
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveRequest.create({
    data: {
      userId: intern2.id,
      type: 'WFH',
      subject: 'Remote Work Request for Research & Academic Project Submission',
      reason: 'Working on university final project documentation while completing CRM task deliverables.',
      startDate: new Date(),
      endDate: new Date(),
      status: 'PENDING'
    }
  });

  await prisma.leaveRequest.create({
    data: {
      userId: emp1.id,
      type: 'LEAVE',
      subject: 'Casual Leave Application',
      reason: 'Attending family medical appointment.',
      startDate: new Date(Date.now() + 86400000 * 2),
      endDate: new Date(Date.now() + 86400000 * 3),
      status: 'APPROVED'
    }
  });
  console.log('Seeded Leave Applications');

  // 9. Default Repositories
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
            { name: 'develop', url: 'https://github.com/mrf-enterprise/mrf-crm-frontend/tree/develop' }
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
    console.log('Seeded Repositories');
  }

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
