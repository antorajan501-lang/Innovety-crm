const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const {
  getSystemTimeZone,
  getTodayZonedDate,
  getZonedParts,
  createZonedDate
} = require('../utils/attendanceUtils');
const path = require('path');

// Helper to recalculate and store Task.actualHours in DB
const recalculateTaskActualHours = async (taskId) => {
  if (!taskId) return;
  try {
    const aggregate = await prisma.workLog.aggregate({
      where: {
        taskId,
        status: 'APPROVED',
        isDraft: false
      },
      _sum: { hoursWorked: true }
    });

    const totalHours = aggregate._sum.hoursWorked || 0;

    await prisma.task.update({
      where: { id: taskId },
      data: { actualHours: totalHours }
    });
  } catch (err) {
    console.error(`Failed to recalculate actualHours for task ${taskId}:`, err);
  }
};

// 1. Create or Upsert WorkLog (Strictly 1 log per user per date)
const createWorkLog = async (req, res) => {
  try {
    if (['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        message: 'Administrators and Super Admins are read-only reviewers and cannot submit daily work logs.'
      });
    }

    const { projectId, taskId, description, hoursWorked, workDate, isDraft, attachments } = req.body;

    let hours = parseFloat(hoursWorked);
    if (isNaN(hours) || hours < 0) {
      hours = 0;
    }

    if (hours > 24) {
      return res.status(400).json({ message: 'Hours worked cannot exceed 24 hours in a single log.' });
    }

    if (!isDraft && (!description || description.trim().length === 0)) {
      return res.status(400).json({ message: 'Work description is required when submitting a work log.' });
    }

    const settings = await prisma.systemSettings.findUnique({ where: { id: 'GLOBAL' } });
    const timeZone = getSystemTimeZone(settings);

    let startOfDay, endOfDay, logDate;
    if (workDate) {
      const parsed = new Date(workDate);
      const { year, month, day } = getZonedParts(parsed, timeZone);
      startOfDay = createZonedDate(year, month, day, 0, 0, timeZone);
      endOfDay = createZonedDate(year, month, day, 23, 59, timeZone);
      logDate = createZonedDate(year, month, day, 12, 0, timeZone);
    } else {
      const now = new Date();
      const { year, month, day } = getZonedParts(now, timeZone);
      startOfDay = createZonedDate(year, month, day, 0, 0, timeZone);
      endOfDay = createZonedDate(year, month, day, 23, 59, timeZone);
      logDate = now;
    }

    const isDraftFlag = Boolean(isDraft);

    // Check if a work log already exists for this user on this date
    const existingLog = await prisma.workLog.findFirst({
      where: {
        userId: req.user.id,
        workDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: { attachments: true },
      orderBy: [
        { isDraft: 'asc' }, // Prioritize submitted over draft if multiple exist
        { createdAt: 'desc' }
      ]
    });

    let workLog = null;

    if (existingLog) {
      // UPDATE EXISTING RECORD IN-PLACE (converts draft into submitted record, no duplicate created)
      const submittedAtVal = isDraftFlag ? existingLog.submittedAt : new Date();

      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const newAtts = attachments.filter(a => !a.id);
        if (newAtts.length > 0) {
          await prisma.workLogAttachment.createMany({
            data: newAtts.map(att => ({
              workLogId: existingLog.id,
              fileName: att.fileName,
              fileType: att.fileType,
              fileSize: att.fileSize || 0,
              filePath: att.filePath
            }))
          });
        }
      }

      workLog = await prisma.workLog.update({
        where: { id: existingLog.id },
        data: {
          projectId: projectId !== undefined ? (projectId || null) : existingLog.projectId,
          taskId: taskId !== undefined ? (taskId || null) : existingLog.taskId,
          description: description !== undefined ? description : existingLog.description,
          hoursWorked: hours,
          isDraft: isDraftFlag,
          submittedAt: submittedAtVal,
          status: 'APPROVED'
        },
        include: {
          user: { select: { id: true, name: true, profilePic: true, employeeId: true } },
          task: { select: { id: true, title: true, estimatedHours: true, actualHours: true } },
          project: { select: { id: true, name: true, projectCode: true } },
          attachments: true
        }
      });
    } else {
      // CREATE NEW RECORD
      const submittedAtVal = isDraftFlag ? null : new Date();

      workLog = await prisma.workLog.create({
        data: {
          userId: req.user.id,
          projectId: projectId || null,
          taskId: taskId || null,
          description: description || '',
          hoursWorked: hours,
          workDate: logDate,
          isDraft: isDraftFlag,
          submittedAt: submittedAtVal,
          status: 'APPROVED',
          attachments: attachments && Array.isArray(attachments) && attachments.length > 0 ? {
            create: attachments.map(att => ({
              fileName: att.fileName,
              fileType: att.fileType,
              fileSize: att.fileSize || 0,
              filePath: att.filePath
            }))
          } : undefined
        },
        include: {
          user: { select: { id: true, name: true, profilePic: true, employeeId: true } },
          task: { select: { id: true, title: true, estimatedHours: true, actualHours: true } },
          project: { select: { id: true, name: true, projectCode: true } },
          attachments: true
        }
      });
    }

    // Clean up any other duplicate draft records for this user on logDate when a submitted log is saved
    if (!isDraftFlag) {
      await prisma.workLog.deleteMany({
        where: {
          userId: req.user.id,
          id: { not: workLog.id },
          workDate: { gte: startOfDay, lte: endOfDay },
          isDraft: true
        }
      }).catch(err => console.error('Failed to cleanup duplicate draft logs:', err));
    }

    if (workLog.taskId && !isDraftFlag) {
      await recalculateTaskActualHours(workLog.taskId);
    }

    await logActivity({
      userId: req.user.id,
      action: isDraftFlag ? 'WORKLOG_DRAFT_SAVE' : 'WORKLOG_SUBMIT',
      details: isDraftFlag ? `Saved work log draft` : `Submitted ${hours} hours daily work log`
    });

    return res.status(201).json(workLog);
  } catch (error) {
    console.error('[createWorkLog Error]:', error);
    return res.status(500).json({ message: 'Failed to create work log.', error: error.message });
  }
};

// 2. Edit WorkLog
const updateWorkLog = async (req, res) => {
  try {
    if (['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        message: 'Administrators and Super Admins are read-only reviewers and cannot edit work logs.'
      });
    }

    const { id } = req.params;
    const { projectId, taskId, description, hoursWorked, isDraft, attachments } = req.body;

    const existing = await prisma.workLog.findUnique({
      where: { id },
      include: { attachments: true }
    });
    if (!existing) {
      return res.status(404).json({ message: 'Work log not found.' });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only edit your own work logs.' });
    }

    let hours = existing.hoursWorked;
    if (hoursWorked !== undefined) {
      hours = parseFloat(hoursWorked);
      if (isNaN(hours) || hours < 0) {
        return res.status(400).json({ message: 'Hours worked must be a valid non-negative number.' });
      }
      if (hours > 24) {
        return res.status(400).json({ message: 'Hours worked cannot exceed 24 hours.' });
      }
    }

    const isDraftFlag = isDraft !== undefined ? Boolean(isDraft) : existing.isDraft;
    let submittedAtVal = existing.submittedAt;
    if (!isDraftFlag) {
      submittedAtVal = existing.submittedAt || new Date();
    }

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const newAtts = attachments.filter(a => !a.id);
      if (newAtts.length > 0) {
        await prisma.workLogAttachment.createMany({
          data: newAtts.map(att => ({
            workLogId: id,
            fileName: att.fileName,
            fileType: att.fileType,
            fileSize: att.fileSize || 0,
            filePath: att.filePath
          }))
        });
      }
    }

    const updated = await prisma.workLog.update({
      where: { id },
      data: {
        projectId: projectId !== undefined ? (projectId || null) : existing.projectId,
        taskId: taskId !== undefined ? (taskId || null) : existing.taskId,
        description: description !== undefined ? description : existing.description,
        hoursWorked: hours,
        isDraft: isDraftFlag,
        submittedAt: submittedAtVal
      },
      include: {
        user: { select: { id: true, name: true, profilePic: true, employeeId: true } },
        task: { select: { id: true, title: true, estimatedHours: true, actualHours: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        attachments: true
      }
    });

    // Clean up any remaining draft logs for this date when submitted
    if (!isDraftFlag) {
      const settings = await prisma.systemSettings.findUnique({ where: { id: 'GLOBAL' } });
      const timeZone = getSystemTimeZone(settings);
      const { year, month, day } = getZonedParts(new Date(updated.workDate), timeZone);
      const startOfDay = createZonedDate(year, month, day, 0, 0, timeZone);
      const endOfDay = createZonedDate(year, month, day, 23, 59, timeZone);

      await prisma.workLog.deleteMany({
        where: {
          userId: req.user.id,
          id: { not: updated.id },
          workDate: { gte: startOfDay, lte: endOfDay },
          isDraft: true
        }
      }).catch(err => console.error('Failed to cleanup duplicate draft logs on update:', err));
    }

    if (existing.taskId) {
      await recalculateTaskActualHours(existing.taskId);
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error('[updateWorkLog Error]:', error);
    return res.status(500).json({ message: 'Failed to update work log.', error: error.message });
  }
};

// 3. Delete WorkLog (Draft only)
const deleteWorkLog = async (req, res) => {
  try {
    if (['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        message: 'Administrators and Super Admins cannot delete employee work logs.'
      });
    }

    const { id } = req.params;
    const existing = await prisma.workLog.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Work log not found.' });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own work logs.' });
    }

    const taskId = existing.taskId;
    await prisma.workLog.delete({ where: { id } });

    if (taskId) {
      await recalculateTaskActualHours(taskId);
    }

    return res.status(200).json({ message: 'Work log deleted successfully.' });
  } catch (error) {
    console.error('[deleteWorkLog Error]:', error);
    return res.status(500).json({ message: 'Failed to delete work log.', error: error.message });
  }
};

// 4. Enhanced List My WorkLogs with Filtering, Sorting & Pagination (Deduplicated per date)
const getWorkLogs = async (req, res) => {
  try {
    const {
      dateRange = 'ALL',
      status = 'ALL',
      hoursRange = 'ALL',
      search = '',
      page = 1,
      limit = 10,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const where = {
      userId: req.user.id
    };

    const settings = await prisma.systemSettings.findUnique({ where: { id: 'GLOBAL' } });
    const timeZone = getSystemTimeZone(settings);
    const now = new Date();
    const { year, month, day } = getZonedParts(now, timeZone);

    if (dateRange === 'TODAY') {
      const startOfToday = createZonedDate(year, month, day, 0, 0, timeZone);
      const endOfToday = createZonedDate(year, month, day, 23, 59, timeZone);
      where.workDate = { gte: startOfToday, lte: endOfToday };
    } else if (dateRange === 'THIS_WEEK') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      where.workDate = { gte: startOfWeek };
    } else if (dateRange === 'THIS_MONTH') {
      const startOfMonth = createZonedDate(year, month, 1, 0, 0, timeZone);
      where.workDate = { gte: startOfMonth };
    }

    if (status === 'SUBMITTED') {
      where.isDraft = false;
    } else if (status === 'DRAFT') {
      where.isDraft = true;
    }

    if (hoursRange === 'UNDER_4') {
      where.hoursWorked = { lt: 4.0 };
    } else if (hoursRange === 'BETWEEN_4_8') {
      where.hoursWorked = { gte: 4.0, lte: 8.0 };
    } else if (hoursRange === 'OVER_8') {
      where.hoursWorked = { gt: 8.0 };
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { project: { name: { contains: q, mode: 'insensitive' } } },
        { project: { projectCode: { contains: q, mode: 'insensitive' } } },
        { task: { title: { contains: q, mode: 'insensitive' } } }
      ];
    }

    let orderBy = { workDate: 'desc' };
    const orderDir = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    if (sortBy === 'hours') {
      orderBy = { hoursWorked: orderDir };
    } else if (sortBy === 'status') {
      orderBy = { isDraft: orderDir };
    } else if (sortBy === 'submittedAt') {
      orderBy = { submittedAt: orderDir };
    } else {
      orderBy = { workDate: orderDir };
    }

    const rawLogs = await prisma.workLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, profilePic: true, role: true, employeeId: true } },
        task: { select: { id: true, title: true, estimatedHours: true, actualHours: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        attachments: true
      },
      orderBy: [
        orderBy,
        { isDraft: 'asc' }, // Prioritize Submitted over Draft
        { createdAt: 'desc' }
      ]
    });

    // DEDUPLICATE records per YYYY-MM-DD date (Submitted > Draft)
    const deduplicatedMap = new Map();
    rawLogs.forEach(log => {
      const { dateStr } = getZonedParts(new Date(log.workDate), timeZone);
      const existing = deduplicatedMap.get(dateStr);
      if (!existing) {
        deduplicatedMap.set(dateStr, log);
      } else {
        if (existing.isDraft && !log.isDraft) {
          deduplicatedMap.set(dateStr, log);
        }
      }
    });

    const deduplicatedLogs = Array.from(deduplicatedMap.values());
    const totalRecords = deduplicatedLogs.length;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;
    const paginatedLogs = deduplicatedLogs.slice(skip, skip + limitNum);

    // Compute Summary Widgets across all user's non-draft logs
    const allSubmittedUserLogs = await prisma.workLog.findMany({
      where: { userId: req.user.id, isDraft: false }
    });

    const startOfTodayZoned = createZonedDate(year, month, day, 0, 0, timeZone);
    const startOfWeekZoned = new Date(now);
    startOfWeekZoned.setDate(now.getDate() - now.getDay());
    startOfWeekZoned.setHours(0, 0, 0, 0);
    const startOfMonthZoned = createZonedDate(year, month, 1, 0, 0, timeZone);

    const hoursToday = allSubmittedUserLogs
      .filter(l => new Date(l.workDate) >= startOfTodayZoned)
      .reduce((sum, l) => sum + l.hoursWorked, 0);

    const hoursThisWeek = allSubmittedUserLogs
      .filter(l => new Date(l.workDate) >= startOfWeekZoned)
      .reduce((sum, l) => sum + l.hoursWorked, 0);

    const hoursThisMonth = allSubmittedUserLogs
      .filter(l => new Date(l.workDate) >= startOfMonthZoned)
      .reduce((sum, l) => sum + l.hoursWorked, 0);

    const tasksWorkedOnCount = new Set(allSubmittedUserLogs.map(l => l.taskId).filter(Boolean)).size;
    const avgHoursPerDay = allSubmittedUserLogs.length > 0 ? (hoursThisMonth / Math.max(1, day)).toFixed(1) : '0.0';

    return res.status(200).json({
      success: true,
      summary: {
        hoursToday,
        hoursThisWeek,
        hoursThisMonth,
        tasksWorkedOnCount,
        avgHoursPerDay
      },
      data: paginatedLogs,
      logs: paginatedLogs,
      pagination: {
        total: totalRecords,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('[getWorkLogs Error]:', error);
    return res.status(500).json({ message: 'Failed to retrieve work logs.', error: error.message });
  }
};

// 5. Admin Reviewer Dashboard Endpoint
const getAdminWorkLogs = async (req, res) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Reviewer dashboard is restricted to Admins.' });
    }

    const { employeeId, employee, departmentId, department, date, status, search } = req.query;

    const where = {};

    const targetEmployeeId = employeeId || employee;
    if (targetEmployeeId && targetEmployeeId !== 'ALL') {
      where.userId = targetEmployeeId;
    }

    const targetDeptId = departmentId || department;
    if (targetDeptId && targetDeptId !== 'ALL') {
      where.user = { departmentId: targetDeptId };
    }

    const settings = await prisma.systemSettings.findUnique({ where: { id: 'GLOBAL' } });
    const timeZone = getSystemTimeZone(settings);

    if (date) {
      const d = new Date(date);
      const { year, month, day } = getZonedParts(d, timeZone);
      const startOfDay = createZonedDate(year, month, day, 0, 0, timeZone);
      const endOfDay = createZonedDate(year, month, day, 23, 59, timeZone);
      where.workDate = {
        gte: startOfDay,
        lte: endOfDay
      };
    }

    if (status && status !== 'ALL') {
      if (status === 'SUBMITTED') {
        where.isDraft = false;
      } else if (status === 'DRAFT') {
        where.isDraft = true;
      }
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { employeeId: { contains: q, mode: 'insensitive' } } }
      ];
    }

    const rawLogs = await prisma.workLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            employeeId: true,
            profilePic: true,
            department: true,
            departmentId: true,
            departmentRef: { select: { id: true, name: true } }
          }
        },
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        attachments: true
      },
      orderBy: [
        { workDate: 'desc' },
        { isDraft: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    // Deduplicate logs per user per date (Submitted > Draft)
    const deduplicatedMap = new Map();
    rawLogs.forEach(log => {
      const { dateStr } = getZonedParts(new Date(log.workDate), timeZone);
      const dateKey = `${log.userId}_${dateStr}`;
      const existing = deduplicatedMap.get(dateKey);
      if (!existing) {
        deduplicatedMap.set(dateKey, log);
      } else {
        if (existing.isDraft && !log.isDraft) {
          deduplicatedMap.set(dateKey, log);
        }
      }
    });

    const logs = Array.from(deduplicatedMap.values());

    return res.status(200).json({ logs });
  } catch (error) {
    console.error('[getAdminWorkLogs Error]:', error);
    return res.status(500).json({ message: 'Failed to retrieve admin work logs.', error: error.message });
  }
};

// 6. Get Today Status & Auto Hours (Aligned with Attendance Timezone & Active Shift Detection)
const getTodayStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    const settings = await prisma.systemSettings.findUnique({ where: { id: 'GLOBAL' } });
    const timeZone = getSystemTimeZone(settings);
    const todayDate = getTodayZonedDate(now, timeZone);
    const { year, month, day, dateStr } = getZonedParts(now, timeZone);

    const startOfToday = createZonedDate(year, month, day, 0, 0, timeZone);
    const endOfToday = createZonedDate(year, month, day, 23, 59, timeZone);

    // 1. Check existing attendance for today by unique key
    let attendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayDate
        }
      }
    });

    // 2. Fallback: check if active shift exists (clockOut is null)
    if (!attendance) {
      attendance = await prisma.attendance.findFirst({
        where: {
          userId,
          clockOut: null
        },
        orderBy: { clockIn: 'desc' }
      });
    }

    // 3. Fallback: check attendance in today's zoned range
    if (!attendance) {
      attendance = await prisma.attendance.findFirst({
        where: {
          userId,
          OR: [
            { date: todayDate },
            { date: { gte: startOfToday, lte: endOfToday } },
            { clockIn: { gte: startOfToday, lte: endOfToday } }
          ]
        },
        orderBy: { clockIn: 'desc' }
      });
    }

    let hoursWorked = 0;
    let isClockedIn = false;
    let clockIn = null;
    let clockOut = null;

    if (attendance) {
      clockIn = attendance.clockIn;
      clockOut = attendance.clockOut;
      isClockedIn = Boolean(clockIn && !clockOut);

      if (clockOut && clockIn) {
        hoursWorked = attendance.workingHours || ((new Date(clockOut) - new Date(clockIn)) / (1000 * 60 * 60));
      } else if (clockIn) {
        hoursWorked = (now - new Date(clockIn)) / (1000 * 60 * 60);
      }
    }

    hoursWorked = Math.round(hoursWorked * 100) / 100;

    const todayLogs = await prisma.workLog.findMany({
      where: {
        userId,
        OR: [
          { workDate: { gte: startOfToday, lte: endOfToday } },
          { workDate: todayDate }
        ]
      },
      include: { attachments: true },
      orderBy: [
        { isDraft: 'asc' }, // Prioritize Submitted over Draft
        { createdAt: 'desc' }
      ]
    });

    const submittedLog = todayLogs.find(l => !l.isDraft);
    const draftLog = todayLogs.find(l => l.isDraft);
    const activeTodayLog = submittedLog || draftLog || null;

    const hasWorkLog = Boolean(activeTodayLog);
    const isSubmitted = Boolean(submittedLog);
    const isDraft = Boolean(!submittedLog && draftLog);

    return res.status(200).json({
      success: true,
      hasWorkLog,
      isSubmitted,
      isDraft,
      date: dateStr,
      clockIn: clockIn || null,
      clockOut: clockOut || null,
      hoursWorked,
      isClockedIn,
      workLogSubmitted: isSubmitted,
      workLogDraft: isDraft,
      workLog: activeTodayLog
    });
  } catch (error) {
    console.error('[getTodayStatus Error]:', error);
    return res.status(500).json({ message: 'Failed to fetch today work log status.', error: error.message });
  }
};

// 7. Upload Attachment Handler
const uploadAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file was uploaded.' });
    }

    const { workLogId } = req.params;
    const relativePath = `/uploads/worklogs/${req.file.filename}`;

    let attachmentRecord = null;
    if (workLogId) {
      const existingLog = await prisma.workLog.findUnique({ where: { id: workLogId } });
      if (existingLog) {
        attachmentRecord = await prisma.workLogAttachment.create({
          data: {
            workLogId,
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
            filePath: relativePath
          }
        });
      }
    }

    return res.status(200).json({
      id: attachmentRecord ? attachmentRecord.id : null,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: relativePath,
      uploadedAt: new Date()
    });
  } catch (error) {
    console.error('[uploadAttachment Error]:', error);
    return res.status(500).json({ message: 'Failed to upload attachment.', error: error.message });
  }
};

module.exports = {
  createWorkLog,
  updateWorkLog,
  deleteWorkLog,
  getWorkLogs,
  getAdminWorkLogs,
  getTodayStatus,
  uploadAttachment,
  recalculateTaskActualHours
};
