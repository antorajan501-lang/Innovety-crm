const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('../services/notification');

const getLeaves = async (req, res) => {
  try {
    let leaves;
    if (req.user.role === 'ADMIN') {
      leaves = await prisma.leaveRequest.findMany({
        include: {
          user: {
            select: { id: true, name: true, email: true, employeeId: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      leaves = await prisma.leaveRequest.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' }
      });
    }
    res.json(leaves);
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ message: 'Failed to retrieve leaves.' });
  }
};

const applyLeave = async (req, res) => {
  try {
    const { startDate, endDate, reason, type, subject, letterContent, contactPhone } = req.body;

    if (!startDate || !endDate || (!reason && !letterContent)) {
      return res.status(400).json({ message: 'Start date, end date, and reason/letter content are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ message: 'Start date must be before or equal to end date.' });
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId: req.user.id,
        startDate: start,
        endDate: end,
        reason: reason || subject || 'Leave Request',
        subject: subject || `Leave Letter Request (${type || 'LEAVE'})`,
        letterContent: letterContent || reason,
        contactPhone: contactPhone || null,
        type: type || 'LEAVE',
        status: 'PENDING'
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'LEAVE_APPLY',
      details: `Applied for ${type || 'LEAVE'} from ${startDate} to ${endDate}`
    });

    // Notify all Admins
    try {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          title: 'New Leave Letter Submitted',
          message: `${req.user.name} (${req.user.role}) has submitted a leave application letter: "${leave.subject}".`,
          type: 'LEAVE_SUBMITTED'
        });
      }
    } catch (notifErr) {
      console.error('Error notifying admins of leave:', notifErr);
    }

    res.status(201).json(leave);
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ message: 'Failed to apply for leave.' });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // APPROVED or REJECTED

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only administrators can sanction leave requests.' });
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid leave status.' });
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    // Update leave request status and force type to WFH if approved
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        type: status === 'APPROVED' ? 'WFH' : leave.type
      }
    });

    const formattedStart = new Date(leave.startDate).toLocaleDateString();
    const formattedEnd = new Date(leave.endDate).toLocaleDateString();

    if (status === 'APPROVED') {
      // Send approval notification
      await createNotification({
        userId: leave.userId,
        title: 'Leave Letter Accepted - WFH Assigned',
        message: `Your leave application letter for ${formattedStart} to ${formattedEnd} has been ACCEPTED by Admin. Work From Home (WFH) has been assigned. You can mark attendance directly from home during this period.`,
        type: 'LEAVE_APPROVED'
      });
    } else if (status === 'REJECTED') {
      // Automatically mark dates as ABSENT in Attendance records
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      let curr = new Date(start);
      while (curr <= end) {
        const localDateStr = curr.toLocaleDateString('en-CA');
        const targetDate = new Date(localDateStr + 'T00:00:00.000Z');

        const existing = await prisma.attendance.findUnique({
          where: {
            userId_date: {
              userId: leave.userId,
              date: targetDate
            }
          }
        });

        if (existing) {
          await prisma.attendance.update({
            where: { id: existing.id },
            data: {
              status: 'ABSENT',
              workingHours: 0,
              editedBy: req.user.id
            }
          });
        } else {
          await prisma.attendance.create({
            data: {
              userId: leave.userId,
              date: targetDate,
              clockIn: targetDate,
              clockOut: targetDate,
              status: 'ABSENT',
              workingHours: 0,
              clockInLocation: 'Leave Application Declined by Admin'
            }
          });
        }

        // Increment current date by 1 day
        curr.setDate(curr.getDate() + 1);
      }

      // Send rejection notification
      await createNotification({
        userId: leave.userId,
        title: 'Leave Letter Declined - Marked Absent',
        message: `Your leave application letter for ${formattedStart} to ${formattedEnd} was DECLINED by Admin. Your status for this period has been marked as ABSENT.`,
        type: 'LEAVE_REJECTED'
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'LEAVE_SANCTION',
      details: `Leave request for user ${leave.user?.name || leave.userId} was ${status}`
    });

    res.json(updated);
  } catch (error) {
    console.error('Update leave status error:', error);
    res.status(500).json({ message: 'Failed to update leave request status.' });
  }
};

module.exports = {
  getLeaves,
  applyLeave,
  updateLeaveStatus
};
