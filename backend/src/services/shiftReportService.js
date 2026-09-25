const prisma = require('../utils/db');
const shiftService = require('./shiftService');

const convertToCsv = (data) => {
  if (!data || !data.length) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(header => {
      let val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
};

/**
 * Generate standard shift management reports
 */
const generateShiftReport = async ({
  organizationId,
  reportType, // SHIFT_UTILIZATION, DEPARTMENT_COVERAGE, ATTENDANCE_EXCEPTIONS, OVERTIME_SUMMARY, SHIFT_CHANGE_HISTORY
  startDate = null,
  endDate = null,
  department = null
}) => {
  const now = new Date();
  const sDate = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const eDate = endDate ? new Date(endDate) : new Date(now);

  const userWhere = { organizationId, status: 'ACTIVE' };
  if (department) userWhere.department = department;

  if (reportType === 'SHIFT_UTILIZATION') {
    const shifts = await prisma.shift.findMany({
      where: { organizationId },
      include: {
        members: { include: { user: { select: { id: true, name: true, department: true } } } }
      }
    });

    const attendances = await prisma.attendance.findMany({
      where: {
        date: { gte: sDate, lte: eDate },
        user: userWhere
      }
    });

    const reportData = shifts.map(s => {
      const assignedCount = s.members.length;
      const shiftAtt = attendances.filter(a => a.shiftId === s.id || (s.name === 'Company Default' && !a.shiftId));
      const totalAttendedHours = shiftAtt.reduce((acc, a) => acc + (a.workingHours || 0), 0);
      const daysInRange = Math.max(1, Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)));
      const expectedHours = assignedCount * daysInRange * 8; // 8h standard
      const utilizationRate = expectedHours > 0 ? Math.min(100, Math.round((totalAttendedHours / expectedHours) * 100)) : 0;

      return {
        'Shift Name': s.name,
        'Start Time': s.startTime,
        'End Time': s.endTime,
        'Status': s.status,
        'Assigned Headcount': assignedCount,
        'Total Logged Hours': Math.round(totalAttendedHours * 10) / 10,
        'Utilization Rate': `${utilizationRate}%`
      };
    });

    return reportData;
  }

  if (reportType === 'DEPARTMENT_COVERAGE') {
    const users = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, department: true, shiftAssignment: { include: { shift: true } } }
    });

    const deptMap = new Map();
    users.forEach(u => {
      const dept = u.department || 'Unassigned';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { dept, total: 0, shifts: {} });
      }
      const item = deptMap.get(dept);
      item.total++;
      const shiftName = u.shiftAssignment?.shift?.name || 'Company Default';
      item.shifts[shiftName] = (item.shifts[shiftName] || 0) + 1;
    });

    const reportData = Array.from(deptMap.values()).map(d => {
      const coverageStatus = d.total < 2 ? 'Understaffed' : d.total > 10 ? 'Overstaffed' : 'Optimal';
      const shiftBreakdown = Object.entries(d.shifts).map(([name, count]) => `${name}: ${count}`).join('; ');

      return {
        'Department': d.dept,
        'Total Headcount': d.total,
        'Coverage Status': coverageStatus,
        'Shift Distribution': shiftBreakdown
      };
    });

    return reportData;
  }

  if (reportType === 'ATTENDANCE_EXCEPTIONS') {
    const exceptions = await prisma.shiftException.findMany({
      where: {
        organizationId,
        date: { gte: sDate, lte: eDate }
      },
      include: {
        user: { select: { employeeId: true, name: true, department: true } },
        resolvedBy: { select: { name: true } }
      },
      orderBy: { date: 'desc' }
    });

    return exceptions.map(exc => ({
      'Date': exc.date.toISOString().split('T')[0],
      'Employee ID': exc.user?.employeeId || 'N/A',
      'Name': exc.user?.name || 'N/A',
      'Department': exc.user?.department || 'N/A',
      'Exception Type': exc.type.replace(/_/g, ' '),
      'Status': exc.status,
      'Details': exc.resolutionNote || 'N/A',
      'Resolved By': exc.resolvedBy?.name || 'Unresolved'
    }));
  }

  if (reportType === 'OVERTIME_SUMMARY') {
    const attendances = await prisma.attendance.findMany({
      where: {
        date: { gte: sDate, lte: eDate },
        user: userWhere,
        workingHours: { gt: 8 }
      },
      include: {
        user: { select: { employeeId: true, name: true, department: true } }
      },
      orderBy: { date: 'desc' }
    });

    return attendances.map(a => {
      const otHours = Math.max(0, (a.workingHours || 0) - 8);
      return {
        'Date': a.date.toISOString().split('T')[0],
        'Employee ID': a.user?.employeeId || 'N/A',
        'Name': a.user?.name || 'N/A',
        'Department': a.user?.department || 'N/A',
        'Total Hours': a.workingHours ? a.workingHours.toFixed(1) : '0',
        'Overtime Hours': otHours.toFixed(1),
        'Shift Name': a.shiftName || 'Company Default'
      };
    });
  }

  if (reportType === 'SHIFT_CHANGE_HISTORY') {
    const history = await prisma.shiftHistory.findMany({
      where: {
        shift: { organizationId },
        createdAt: { gte: sDate, lte: eDate }
      },
      include: {
        shift: { select: { name: true } },
        user: { select: { name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return history.map(h => ({
      'Timestamp': h.createdAt.toISOString().replace('T', ' ').substring(0, 19),
      'Shift': h.shift?.name || 'N/A',
      'Action': h.action,
      'Performed By': h.user ? `${h.user.name} (${h.user.role})` : 'System',
      'Details': h.details || 'N/A'
    }));
  }

  return [];
};

module.exports = {
  generateShiftReport,
  convertToCsv
};
