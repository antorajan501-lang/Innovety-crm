const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Generate Advanced Operational Reports
 */
const generateAdvancedReport = async ({
  organizationId,
  reportType = 'ATTENDANCE_SUMMARY',
  startDate: startStr = null,
  endDate: endStr = null,
  department = null
}) => {
  if (!organizationId) throw new Error('organizationId is required');

  const now = new Date();
  let endDate = endStr ? new Date(endStr) : now;
  endDate.setHours(23, 59, 59, 999);

  let startDate = startStr ? new Date(startStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  startDate.setHours(0, 0, 0, 0);

  // 1. ATTENDANCE SUMMARY REPORT
  if (reportType === 'ATTENDANCE_SUMMARY') {
    const attendances = await prisma.attendance.findMany({
      where: {
        user: {
          organizationId,
          ...(department ? { department } : {})
        },
        date: { gte: startDate, lte: endDate }
      },
      include: {
        user: { select: { name: true, employeeId: true, department: true } }
      },
      orderBy: { date: 'desc' }
    });

    const rows = attendances.map(a => ({
      employeeName: a.user.name,
      employeeId: a.user.employeeId || 'N/A',
      department: a.user.department || 'General',
      date: a.date.toISOString().split('T')[0],
      shiftName: a.shiftName || 'Company Default',
      clockIn: a.clockIn ? new Date(a.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
      clockOut: a.clockOut ? new Date(a.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
      workingHours: a.workingHours || 0,
      lateMinutes: a.lateMinutes || 0,
      status: a.status,
      workLocation: a.workLocation || 'OFFICE'
    }));

    return {
      reportType,
      title: 'Attendance Summary Report',
      period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      recordCount: rows.length,
      columns: ['Employee Name', 'Employee ID', 'Department', 'Date', 'Shift', 'Clock In', 'Clock Out', 'Hours', 'Late (min)', 'Status', 'Location'],
      rows
    };
  }

  // 2. SHIFT UTILIZATION REPORT
  if (reportType === 'SHIFT_UTILIZATION') {
    const shifts = await prisma.shift.findMany({
      where: { organizationId },
      include: {
        members: true
      }
    });

    const attendances = await prisma.attendance.findMany({
      where: {
        user: { organizationId },
        date: { gte: startDate, lte: endDate },
        clockIn: { not: null }
      },
      select: { shiftName: true, shiftId: true }
    });

    const attCountByShift = {};
    attendances.forEach(a => {
      const k = a.shiftName || 'Company Default';
      attCountByShift[k] = (attCountByShift[k] || 0) + 1;
    });

    const rows = shifts.map(s => {
      const actualPresents = attCountByShift[s.name] || 0;
      const assignedCount = s.members.length;
      const expectedTotal = assignedCount * 22;
      const utilizationRate = expectedTotal > 0 ? Math.min(100, Math.round((actualPresents / expectedTotal) * 100)) : 0;

      return {
        shiftName: s.name,
        timings: `${s.startTime} – ${s.endTime}`,
        assignedMembers: assignedCount,
        actualSessions: actualPresents,
        utilizationRate: `${utilizationRate}%`,
        status: s.status
      };
    });

    return {
      reportType,
      title: 'Shift Utilization & Coverage Report',
      period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      recordCount: rows.length,
      columns: ['Shift Name', 'Timings', 'Assigned Members', 'Actual Sessions', 'Utilization Rate', 'Status'],
      rows
    };
  }

  // 3. DEPARTMENT PERFORMANCE REPORT
  if (reportType === 'DEPARTMENT_PERFORMANCE') {
    const analyticsService = require('./analyticsService');
    const deptStats = await analyticsService.getDepartmentAnalytics(organizationId);

    const rows = deptStats.map(d => ({
      department: d.department,
      memberCount: d.memberCount,
      attendanceRate: `${d.attendanceRate}%`,
      totalOvertimeHours: `${d.totalOvertimeHours}h`,
      avgOvertimeHours: `${d.avgOvertimeHours}h`,
      leaveCount: d.leaveCount,
      lateArrivalRate: `${d.lateArrivalRate}%`,
      wfhDistribution: `${d.wfhDistribution}%`
    }));

    return {
      reportType,
      title: 'Department Performance Analytics Report',
      period: 'Past 30 Days Cycle',
      recordCount: rows.length,
      columns: ['Department', 'Members', 'Attendance Rate', 'Total Overtime', 'Avg Overtime', 'Leaves Taken', 'Late Rate', 'WFH Rate'],
      rows
    };
  }

  // 4. OVERTIME SUMMARY REPORT
  if (reportType === 'OVERTIME_SUMMARY') {
    const attendances = await prisma.attendance.findMany({
      where: {
        user: {
          organizationId,
          ...(department ? { department } : {})
        },
        date: { gte: startDate, lte: endDate },
        workingHours: { gt: 8 }
      },
      include: {
        user: { select: { name: true, employeeId: true, department: true } }
      },
      orderBy: { date: 'desc' }
    });

    const rows = attendances.map(a => {
      const otHours = Number(((a.workingHours || 8) - 8).toFixed(1));
      return {
        employeeName: a.user.name,
        employeeId: a.user.employeeId || 'N/A',
        department: a.user.department || 'General',
        date: a.date.toISOString().split('T')[0],
        shiftName: a.shiftName || 'Company Default',
        clockOutTime: a.clockOut ? new Date(a.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
        totalHours: a.workingHours || 0,
        overtimeHours: `${otHours}h`
      };
    });

    return {
      reportType,
      title: 'Overtime Summary & Compliance Report',
      period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      recordCount: rows.length,
      columns: ['Employee Name', 'Employee ID', 'Department', 'Date', 'Shift', 'Clock Out', 'Total Hours', 'Overtime'],
      rows
    };
  }

  // 5. LEAVE ANALYTICS REPORT
  if (reportType === 'LEAVE_ANALYTICS') {
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        user: {
          organizationId,
          ...(department ? { department } : {})
        },
        startDate: { gte: startDate, lte: endDate }
      },
      include: {
        user: { select: { name: true, employeeId: true, department: true } }
      },
      orderBy: { startDate: 'desc' }
    });

    const rows = leaves.map(l => {
      const days = Math.max(1, Math.round((new Date(l.endDate) - new Date(l.startDate)) / (1000 * 60 * 60 * 24)) + 1);
      return {
        employeeName: l.user.name,
        employeeId: l.user.employeeId || 'N/A',
        department: l.user.department || 'General',
        startDate: l.startDate.toISOString().split('T')[0],
        endDate: l.endDate.toISOString().split('T')[0],
        daysCount: days,
        reason: l.reason || 'Personal Leave',
        status: l.status
      };
    });

    return {
      reportType,
      title: 'Leave Analytics & Utilization Report',
      period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      recordCount: rows.length,
      columns: ['Employee Name', 'Employee ID', 'Department', 'Start Date', 'End Date', 'Days', 'Reason', 'Status'],
      rows
    };
  }

  // 6. WORKFORCE TRENDS REPORT
  const analyticsService = require('./analyticsService');
  const daysDiff = Math.max(7, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
  const trends = await analyticsService.getExecutiveTrends(organizationId, daysDiff);

  const rows = trends.map(t => ({
    date: t.date,
    present: t.present,
    late: t.late,
    absent: t.absent,
    wfh: t.wfh,
    overtimeHours: `${t.overtimeHours}h`,
    leaveCount: t.leaveCount
  }));

  return {
    reportType: 'WORKFORCE_TRENDS',
    title: 'Workforce Trends & Velocity Report',
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    recordCount: rows.length,
    columns: ['Date', 'Present', 'Late', 'Absent', 'WFH', 'Overtime Hours', 'Leaves Taken'],
    rows
  };
};

/**
 * Convert report data to CSV RFC 4180
 */
const exportReportToCsv = (report) => {
  if (!report || !report.rows) return '';

  const headers = report.columns;
  const keys = Object.keys(report.rows[0] || {});

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvLines = [];
  csvLines.push(`# Report: ${report.title}`);
  csvLines.push(`# Period: ${report.period}`);
  csvLines.push(headers.map(escapeCsv).join(','));

  report.rows.forEach(row => {
    const line = keys.map(k => escapeCsv(row[k])).join(',');
    csvLines.push(line);
  });

  return csvLines.join('\n');
};

/**
 * Excel-compatible HTML spreadsheet export
 */
const exportReportToExcel = (report) => {
  if (!report || !report.rows) return '';
  const headers = report.columns;
  const keys = Object.keys(report.rows[0] || {});

  let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
  tableHtml += `<head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${report.title}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>`;
  tableHtml += `<h3>${report.title}</h3><p>Period: ${report.period}</p>`;
  tableHtml += `<table border="1"><thead><tr>`;
  headers.forEach(h => {
    tableHtml += `<th style="background-color:#10b981;color:#ffffff;font-weight:bold;">${h}</th>`;
  });
  tableHtml += `</tr></thead><tbody>`;
  report.rows.forEach(row => {
    tableHtml += `<tr>`;
    keys.forEach(k => {
      tableHtml += `<td>${row[k] !== null && row[k] !== undefined ? row[k] : ''}</td>`;
    });
    tableHtml += `</tr>`;
  });
  tableHtml += `</tbody></table></body></html>`;

  return tableHtml;
};

module.exports = {
  generateAdvancedReport,
  exportReportToCsv,
  exportReportToExcel
};
