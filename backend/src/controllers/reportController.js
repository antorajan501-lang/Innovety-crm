const prisma = require('../utils/db');
const { getEffectiveOrgId } = require('../utils/organizationScope');

// Helper to resolve targetOrgId cleanly
const getTargetOrgId = (req) => {
  return getEffectiveOrgId(req);
};

// 1. Attendance Report
const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const targetOrgId = getTargetOrgId(req);

    const where = {};
    if (targetOrgId) {
      where.user = { organizationId: targetOrgId };
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const logs = await prisma.attendance.findMany({
      where,
      include: {
        user: { select: { name: true, employeeId: true, email: true, department: true, joiningDate: true } }
      },
      orderBy: { date: 'asc' }
    });

    const filteredLogs = logs.filter(log => {
      if (!log.user?.joiningDate) return true;
      const jStr = new Date(log.user.joiningDate).toISOString().split('T')[0];
      const dStr = new Date(log.date).toISOString().split('T')[0];
      return dStr >= jStr;
    });

    const reportData = filteredLogs.map((log) => ({
      'Employee ID': log.user?.employeeId || 'N/A',
      'Name': log.user?.name || 'N/A',
      'Email': log.user?.email || 'N/A',
      'Department': log.user?.department || 'N/A',
      'Date': log.date ? log.date.toISOString().split('T')[0] : 'N/A',
      'Clock In': log.clockIn ? new Date(log.clockIn).toLocaleTimeString() : 'N/A',
      'Clock Out': log.clockOut ? new Date(log.clockOut).toLocaleTimeString() : 'N/A',
      'Hours Worked': log.workingHours || 0,
      'Status': log.status
    }));

    if (req.query.format === 'csv') {
      const csv = convertToCsv(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.csv');
      return res.send(csv);
    }

    res.json(reportData);
  } catch (error) {
    console.error('Attendance report error:', error);
    res.status(500).json({ message: 'Failed to generate attendance report.', reason: error.message });
  }
};

// 2. Task Allocation Logs
const getTaskReport = async (req, res) => {
  try {
    const { status, priority, startDate, endDate } = req.query;
    const targetOrgId = getTargetOrgId(req);

    const where = {};
    if (targetOrgId) {
      where.OR = [
        { creator: { organizationId: targetOrgId } },
        { assignee: { organizationId: targetOrgId } }
      ];
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: { select: { name: true, employeeId: true } },
        creator: { select: { name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const reportData = tasks.map((task) => ({
      'Task ID': task.id,
      'Title': task.title,
      'Description': task.description,
      'Assignee': task.assignee ? task.assignee.name : 'N/A',
      'Assignee ID': task.assignee ? task.assignee.employeeId : 'N/A',
      'Creator': task.creator ? `${task.creator.name} (${task.creator.role})` : 'System',
      'Priority': task.priority,
      'Status': task.status,
      'Deadline': task.deadline ? task.deadline.toISOString().split('T')[0] : 'N/A',
      'Created At': task.createdAt ? task.createdAt.toISOString().split('T')[0] : 'N/A'
    }));

    if (req.query.format === 'csv') {
      const csv = convertToCsv(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=task_report.csv');
      return res.send(csv);
    }

    res.json(reportData);
  } catch (error) {
    console.error('Task report error:', error);
    res.status(500).json({ message: 'Failed to generate task report.', reason: error.message });
  }
};

// 3. Team Performance Audits
const getTeamReport = async (req, res) => {
  try {
    const targetOrgId = getTargetOrgId(req);
    const teamWhere = {};
    if (targetOrgId) {
      teamWhere.members = {
        some: {
          user: { organizationId: targetOrgId }
        }
      };
    }

    const teams = await prisma.team.findMany({
      where: teamWhere,
      include: {
        leader: { select: { name: true, employeeId: true } },
        members: { include: { user: true } },
        tasks: true
      }
    });

    const reportData = teams.map((team) => {
      const activeTasks = team.tasks.filter((t) => ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_REVIEW'].includes(t.status)).length;
      const completedTasks = team.tasks.filter((t) => t.status === 'APPROVED').length;
      const totalTasks = team.tasks.length;
      const performance = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        'Team Name': team.name,
        'Team Description': team.description || 'N/A',
        'Leader': team.leader ? team.leader.name : 'N/A',
        'Leader ID': team.leader ? team.leader.employeeId : 'N/A',
        'Members Count': team.members.length,
        'Active Tasks': activeTasks,
        'Completed Tasks': completedTasks,
        'Performance %': performance
      };
    });

    if (req.query.format === 'csv') {
      const csv = convertToCsv(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=team_report.csv');
      return res.send(csv);
    }

    res.json(reportData);
  } catch (error) {
    console.error('Team report error:', error);
    res.status(500).json({ message: 'Failed to generate team report.', reason: error.message });
  }
};

// 4. Ticket Support Summaries
const getTicketReport = async (req, res) => {
  try {
    const targetOrgId = getTargetOrgId(req);
    const ticketWhere = {};
    if (targetOrgId) {
      ticketWhere.OR = [
        { organizationId: targetOrgId },
        { creator: { organizationId: targetOrgId } }
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where: ticketWhere,
      include: {
        creator: { select: { name: true, employeeId: true } },
        assignee: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const reportData = tickets.map((t) => ({
      'Ticket ID': t.id,
      'Title': t.title,
      'Description': t.description,
      'Category': t.category,
      'Status': t.status,
      'Creator': t.creator ? t.creator.name : 'System',
      'Creator ID': t.creator ? t.creator.employeeId : 'N/A',
      'Assignee': t.assignee ? t.assignee.name : 'Unassigned',
      'Created At': t.createdAt ? t.createdAt.toISOString().split('T')[0] : 'N/A'
    }));

    if (req.query.format === 'csv') {
      const csv = convertToCsv(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=ticket_report.csv');
      return res.send(csv);
    }

    res.json(reportData);
  } catch (error) {
    console.error('Ticket report error:', error);
    res.status(500).json({ message: 'Failed to generate ticket report.', reason: error.message });
  }
};

// 5. Leave Applications Report
const getLeaveReport = async (req, res) => {
  try {
    const targetOrgId = getTargetOrgId(req);
    const { startDate, endDate, status } = req.query;

    const where = {};
    if (targetOrgId) {
      where.user = { organizationId: targetOrgId };
    }
    if (status) where.status = status;
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = new Date(startDate);
      if (endDate) where.startDate.lte = new Date(endDate);
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { name: true, employeeId: true, department: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const reportData = leaves.map(l => ({
      'Leave ID': l.id,
      'Employee ID': l.user?.employeeId || 'N/A',
      'Name': l.user?.name || 'N/A',
      'Department': l.user?.department || 'N/A',
      'Leave Type': l.leaveType || l.type || 'N/A',
      'Start Date': l.startDate ? l.startDate.toISOString().split('T')[0] : 'N/A',
      'End Date': l.endDate ? l.endDate.toISOString().split('T')[0] : 'N/A',
      'Total Days': l.totalDays || 0,
      'Status': l.status,
      'Reason': l.reason || 'N/A'
    }));

    if (req.query.format === 'csv') {
      const csv = convertToCsv(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=leave_report.csv');
      return res.send(csv);
    }

    res.json(reportData);
  } catch (error) {
    console.error('Leave report error:', error);
    res.status(500).json({ message: 'Failed to generate leave report.', reason: error.message });
  }
};

// 6. Payroll Expense Report
const getPayrollReport = async (req, res) => {
  try {
    const targetOrgId = getTargetOrgId(req);
    const { month, year } = req.query;

    const where = { status: 'PUBLISHED' };
    if (targetOrgId) {
      where.user = { organizationId: targetOrgId };
    }
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);

    const payslips = await prisma.payslip.findMany({
      where,
      include: {
        user: { select: { name: true, employeeId: true, department: true } }
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    const reportData = payslips.map(p => ({
      'Payslip ID': p.id,
      'Employee ID': p.user?.employeeId || 'N/A',
      'Name': p.user?.name || 'N/A',
      'Department': p.user?.department || 'N/A',
      'Month/Year': `${p.month}/${p.year}`,
      'Basic Salary': p.basicSalary || 0,
      'Gross Salary': p.grossSalary || 0,
      'Net Salary': p.netSalary || 0,
      'Status': p.status
    }));

    if (req.query.format === 'csv') {
      const csv = convertToCsv(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=payroll_report.csv');
      return res.send(csv);
    }

    res.json(reportData);
  } catch (error) {
    console.error('Payroll report error:', error);
    res.status(500).json({ message: 'Failed to generate payroll report.', reason: error.message });
  }
};

// 7. Asset Allocation Report
const getAssetReport = async (req, res) => {
  try {
    const targetOrgId = getTargetOrgId(req);
    const { status } = req.query;

    const where = {};
    if (targetOrgId) {
      where.OR = [
        { organizationId: targetOrgId },
        { assignedTo: { organizationId: targetOrgId } }
      ];
    }
    if (status) where.status = status;

    const assets = await prisma.asset.findMany({
      where,
      include: {
        assignedTo: { select: { name: true, employeeId: true, department: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const reportData = assets.map(a => ({
      'Asset ID': a.assetId || a.id,
      'Asset Name': a.name,
      'Category': a.category,
      'Serial Number': a.serialNumber || 'N/A',
      'Status': a.status,
      'Assigned To': a.assignedTo ? a.assignedTo.name : 'Unassigned',
      'Assigned Employee ID': a.assignedTo ? a.assignedTo.employeeId : 'N/A',
      'Assigned Date': a.assignedDate ? a.assignedDate.toISOString().split('T')[0] : 'N/A'
    }));

    if (req.query.format === 'csv') {
      const csv = convertToCsv(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=asset_report.csv');
      return res.send(csv);
    }

    res.json(reportData);
  } catch (error) {
    console.error('Asset report error:', error);
    res.status(500).json({ message: 'Failed to generate asset report.', reason: error.message });
  }
};

// 8. Daily Work Logs Report
const getWorkLogReport = async (req, res) => {
  try {
    const targetOrgId = getTargetOrgId(req);
    const { startDate, endDate, status } = req.query;

    const where = {};
    if (targetOrgId) {
      where.user = { organizationId: targetOrgId };
    }
    if (status) where.status = status;
    if (startDate || endDate) {
      where.workDate = {};
      if (startDate) where.workDate.gte = new Date(startDate);
      if (endDate) where.workDate.lte = new Date(endDate);
    }

    const workLogs = await prisma.workLog.findMany({
      where,
      include: {
        user: { select: { name: true, employeeId: true, department: true } },
        project: { select: { name: true, projectCode: true } }
      },
      orderBy: { workDate: 'desc' }
    });

    const reportData = workLogs.map(w => ({
      'WorkLog ID': w.id,
      'Employee ID': w.user?.employeeId || 'N/A',
      'Name': w.user?.name || 'N/A',
      'Department': w.user?.department || 'N/A',
      'Project': w.project ? `${w.project.name} (${w.project.projectCode})` : 'N/A',
      'Work Date': w.workDate ? w.workDate.toISOString().split('T')[0] : 'N/A',
      'Hours Worked': w.hoursWorked || 0,
      'Status': w.status,
      'Description': w.description || 'N/A'
    }));

    if (req.query.format === 'csv') {
      const csv = convertToCsv(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=worklog_report.csv');
      return res.send(csv);
    }

    res.json(reportData);
  } catch (error) {
    console.error('Work log report error:', error);
    res.status(500).json({ message: 'Failed to generate work log report.', reason: error.message });
  }
};

// Helper: convert JSON array of objects to CSV string
const convertToCsv = (objArray) => {
  if (objArray.length === 0) return '';
  const headers = Object.keys(objArray[0]);
  const rows = objArray.map((row) =>
    headers.map((fieldName) => JSON.stringify(row[fieldName] !== null && row[fieldName] !== undefined ? row[fieldName] : '')).join(',')
  );
  return [headers.join(','), ...rows].join('\r\n');
};

module.exports = {
  getAttendanceReport,
  getTaskReport,
  getTeamReport,
  getTicketReport,
  getLeaveReport,
  getPayrollReport,
  getAssetReport,
  getWorkLogReport
};
