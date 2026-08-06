const prisma = require('../utils/db');

/**
 * Enterprise Global Search Controller
 * Searches across Users, Projects, Tasks, Tickets, Leaves, Announcements, Assets, and Module Shortcuts
 * Enforces role-based permissions on result destinations.
 */
const globalSearch = async (req, res) => {
  try {
    const rawQuery = req.query.q || req.query.search || req.query.query;
    if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
      return res.json({ results: [], total: 0 });
    }

    const q = rawQuery.trim();
    const qLower = q.toLowerCase();
    const userRole = req.user?.role || 'EMPLOYEE';

    const results = [];

    // Helper for role route permission check
    const canAccess = (allowedRoles) => {
      return allowedRoles.includes(userRole);
    };

    // 1. MODULE KEYWORD INTENT MATCHING
    if ('payroll'.includes(qLower) || 'salary'.includes(qLower) || 'payslip'.includes(qLower)) {
      const path = canAccess(['ADMIN', 'SUPER_ADMIN']) ? '/payroll/dashboard' : '/my-payroll';
      results.push({
        id: 'module-payroll',
        title: 'Payroll & Compensation Hub',
        subtitle: 'Manage salary structures, processing, and payslips',
        type: 'PAYROLL',
        category: 'System Module',
        path
      });
    }

    if ('attendance'.includes(qLower) || 'clock'.includes(qLower) || 'timesheet'.includes(qLower)) {
      const path = canAccess(['ADMIN']) ? '/attendance-audit' : '/attendance';
      results.push({
        id: 'module-attendance',
        title: 'Attendance Portal',
        subtitle: 'Clock in/out, view timesheets & attendance records',
        type: 'ATTENDANCE',
        category: 'System Module',
        path
      });
    }

    if ('active board'.includes(qLower) || 'kanban'.includes(qLower) || 'active project'.includes(qLower)) {
      results.push({
        id: 'module-active-board',
        title: 'Active Board (Sprint Tasks)',
        subtitle: 'View agile task workflow & kanban columns',
        type: 'ACTIVE_PROJECT',
        category: 'Workspace',
        path: '/tasks?tab=Board'
      });
    }

    if ('leave'.includes(qLower) || 'time off'.includes(qLower) || 'vacation'.includes(qLower)) {
      results.push({
        id: 'module-leaves',
        title: 'Leave Management',
        subtitle: 'Submit leave requests & check quotas',
        type: 'LEAVE',
        category: 'Operations',
        path: '/leave-management'
      });
    }

    if ('chat'.includes(qLower) || 'messages'.includes(qLower) || 'discussion'.includes(qLower)) {
      results.push({
        id: 'module-chat',
        title: 'Team Chat & Messaging',
        subtitle: 'Direct messaging & team channels',
        type: 'CHAT',
        category: 'Communication',
        path: '/chat'
      });
    }

    if ('announcement'.includes(qLower) || 'broadcast'.includes(qLower)) {
      results.push({
        id: 'module-announcements',
        title: 'Company Announcements',
        subtitle: 'View global updates & team broadcasts',
        type: 'ANNOUNCEMENT',
        category: 'Communication',
        path: '/announcements'
      });
    }

    // 2. USERS (EMPLOYEE, INTERN, TEAM_LEADER, ADMIN)
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { employeeId: { contains: q, mode: 'insensitive' } },
          { department: { contains: q, mode: 'insensitive' } },
          { college: { contains: q, mode: 'insensitive' } }
        ]
      },
      take: 8,
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        department: true
      }
    });

    users.forEach((u) => {
      let type = u.role;
      let targetPath = '/profile';
      let category = 'User Profile';

      if (u.role === 'INTERN') {
        type = 'INTERN';
        category = 'Intern Registry';
        targetPath = canAccess(['SUPER_ADMIN']) ? `/super-admin/users?search=${encodeURIComponent(u.name)}` : canAccess(['ADMIN']) ? `/interns?search=${encodeURIComponent(u.name)}` : `/chat?user=${u.id}`;
      } else if (u.role === 'TEAM_LEADER') {
        type = 'TEAM_LEADER';
        category = 'Team Leader Registry';
        targetPath = canAccess(['SUPER_ADMIN']) ? `/super-admin/users?search=${encodeURIComponent(u.name)}` : canAccess(['ADMIN']) ? `/team-leaders?search=${encodeURIComponent(u.name)}` : `/chat?user=${u.id}`;
      } else if (u.role === 'EMPLOYEE') {
        type = 'EMPLOYEE';
        category = 'Employee Directory';
        targetPath = canAccess(['SUPER_ADMIN']) ? `/super-admin/users?search=${encodeURIComponent(u.name)}` : canAccess(['ADMIN']) ? `/employees?search=${encodeURIComponent(u.name)}` : `/chat?user=${u.id}`;
      } else if (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN') {
        type = 'ADMIN';
        category = 'Admin User';
        targetPath = canAccess(['SUPER_ADMIN']) ? `/super-admin/admins?search=${encodeURIComponent(u.name)}` : `/profile`;
      }

      results.push({
        id: `user-${u.id}`,
        title: u.name,
        subtitle: `${u.employeeId ? `[${u.employeeId}] ` : ''}${u.email} • ${u.department || u.role}`,
        type,
        category,
        path: targetPath
      });
    });

    // 3. PROJECTS
    if (canAccess(['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN'])) {
      const projects = await prisma.project.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 5,
        select: {
          id: true,
          code: true,
          title: true,
          status: true
        }
      });

      projects.forEach((p) => {
        results.push({
          id: `project-${p.id}`,
          title: `[${p.code}] ${p.title}`,
          subtitle: `Status: ${p.status}`,
          type: 'PROJECT',
          category: 'Project',
          path: `/projects?search=${encodeURIComponent(p.title)}`
        });
      });
    }

    // 4. TASKS
    if (canAccess(['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN'])) {
      const tasks = await prisma.task.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true
        }
      });

      tasks.forEach((t) => {
        results.push({
          id: `task-${t.id}`,
          title: t.title,
          subtitle: `Priority: ${t.priority} • Status: ${t.status}`,
          type: 'TASK',
          category: 'Task Item',
          path: `/tasks?search=${encodeURIComponent(t.title)}`
        });
      });
    }

    // 5. TICKETS
    if (canAccess(['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN'])) {
      const tickets = await prisma.ticket.findMany({
        where: {
          OR: [
            { ticketId: { contains: q, mode: 'insensitive' } },
            { subject: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 5,
        select: {
          id: true,
          ticketId: true,
          subject: true,
          status: true
        }
      });

      tickets.forEach((tk) => {
        results.push({
          id: `ticket-${tk.id}`,
          title: `[${tk.ticketId}] ${tk.subject}`,
          subtitle: `Ticket Status: ${tk.status}`,
          type: 'TICKET',
          category: 'Support Ticket',
          path: `/tickets?search=${encodeURIComponent(tk.ticketId || tk.subject)}`
        });
      });
    }

    // 6. ANNOUNCEMENTS
    if (canAccess(['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN'])) {
      const announcements = await prisma.announcement.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 3,
        select: {
          id: true,
          title: true
        }
      });

      announcements.forEach((a) => {
        results.push({
          id: `announcement-${a.id}`,
          title: a.title,
          subtitle: 'Company Broadcast',
          type: 'ANNOUNCEMENT',
          category: 'Announcement',
          path: `/announcements?search=${encodeURIComponent(a.title)}`
        });
      });
    }

    // 7. ASSETS
    if (canAccess(['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN'])) {
      const assets = await prisma.asset.findMany({
        where: {
          OR: [
            { assetId: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { brand: { contains: q, mode: 'insensitive' } },
            { model: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 3,
        select: {
          id: true,
          assetId: true,
          name: true,
          brand: true
        }
      });

      assets.forEach((ast) => {
        results.push({
          id: `asset-${ast.id}`,
          title: `[${ast.assetId}] ${ast.name}`,
          subtitle: `Brand: ${ast.brand || 'N/A'}`,
          type: 'ASSET',
          category: 'Asset Item',
          path: `/assets?search=${encodeURIComponent(ast.name || ast.assetId)}`
        });
      });
    }

    return res.json({
      results,
      total: results.length
    });
  } catch (error) {
    console.error('Global search error:', error);
    return res.status(500).json({ message: 'Failed to perform global search.' });
  }
};

module.exports = {
  globalSearch
};
