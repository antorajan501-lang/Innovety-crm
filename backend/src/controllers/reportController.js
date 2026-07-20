const prisma = require('../utils/db');
const XLSX = require('xlsx');

const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const logs = await prisma.attendance.findMany({
      where,
      include: {
        user: { select: { name: true, employeeId: true, email: true, department: true } }
      },
      orderBy: { date: 'asc' }
    });

    const reportData = logs.map((log) => ({
      'Employee ID': log.user.employeeId,
      'Name': log.user.name,
      'Email': log.user.email,
      'Department': log.user.department || 'N/A',
      'Date': log.date.toISOString().split('T')[0],
      'Clock In': new Date(log.clockIn).toLocaleTimeString(),
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
    res.status(500).json({ message: 'Failed to generate attendance report.' });
  }
};

const getTaskReport = async (req, res) => {
  try {
    const { status, priority } = req.query;
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;

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
      'Assignee': task.assignee.name,
      'Assignee ID': task.assignee.employeeId,
      'Creator': `${task.creator.name} (${task.creator.role})`,
      'Priority': task.priority,
      'Status': task.status,
      'Deadline': task.deadline.toISOString().split('T')[0],
      'Created At': task.createdAt.toISOString().split('T')[0]
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
    res.status(500).json({ message: 'Failed to generate task report.' });
  }
};

const getTeamReport = async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
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
    res.status(500).json({ message: 'Failed to generate team report.' });
  }
};

const getTicketReport = async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
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
      'Creator': t.creator.name,
      'Creator ID': t.creator.employeeId,
      'Assignee': t.assignee ? t.assignee.name : 'Unassigned',
      'Created At': t.createdAt.toISOString().split('T')[0]
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
    res.status(500).json({ message: 'Failed to generate ticket report.' });
  }
};

// Helper: convert JSON array of objects to CSV string
const convertToCsv = (objArray) => {
  if (objArray.length === 0) return '';
  const headers = Object.keys(objArray[0]);
  const rows = objArray.map((row) =>
    headers.map((fieldName) => JSON.stringify(row[fieldName] || '')).join(',')
  );
  return [headers.join(','), ...rows].join('\r\n');
};

module.exports = {
  getAttendanceReport,
  getTaskReport,
  getTeamReport,
  getTicketReport
};
