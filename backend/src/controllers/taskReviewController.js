const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to create notifications safely
const createNotification = async (userId, title, message, type = 'TASK') => {
  try {
    if (!userId) return;
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        isRead: false
      }
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

// 1. Submit task for review
const submitForReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, audioUrl } = req.body;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: true }
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    // Permission check: Assignee, Creator, Leader
    const isAssignee = task.assigneeId === req.user.id;
    const isCreator = task.creatorId === req.user.id;
    const isLeader = task.project?.leaderId === req.user.id || task.project?.teamLeaderId === req.user.id;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

    if (!isAssignee && !isCreator && !isLeader && !isAdmin) {
      return res.status(403).json({ message: 'Only task assignee or project leaders can submit for review.' });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        reviewStatus: 'PENDING',
        status: 'WAITING_FOR_REVIEW',
        updatedAt: new Date()
      },
      include: {
        assignee: true,
        creator: true,
        reviewedBy: true,
        stage: true,
        project: true,
        reviewHistory: {
          include: { createdBy: { select: { id: true, name: true, profilePic: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // Create review history entry
    await prisma.taskReviewHistory.create({
      data: {
        taskId: id,
        action: 'SUBMITTED',
        message: message || 'Task submitted for review.',
        audioUrl: audioUrl || null,
        createdById: req.user.id
      }
    });

    // Notify project leaders & admins
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true }
    });

    const notifyIds = new Set(admins.map(a => a.id));
    if (task.project?.leaderId) notifyIds.add(task.project.leaderId);

    for (const targetId of notifyIds) {
      if (targetId !== req.user.id) {
        await createNotification(
          targetId,
          'Task Submitted for Review',
          `${req.user.name} submitted task "${task.title}" for review.`
        );
      }
    }

    return res.json(updatedTask);
  } catch (error) {
    console.error('Submit review error:', error);
    return res.status(500).json({ message: 'Internal server error submitting review.' });
  }
};

// 2. Approve Task (Admin / Super Admin / Project Leader)
const approveTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: true, stage: true }
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    // Permission check: Admin, Super Admin, Team Leader or Project Leader
    const isLeader = task.project?.leaderId === req.user.id || task.project?.teamLeaderId === req.user.id || task.project?.team?.leaderId === req.user.id;
    const canReview = ['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER'].includes(req.user.role) || isLeader;

    if (!canReview) {
      return res.status(403).json({ message: 'Only Admin or Team Leader can approve or reject tasks.' });
    }

    const isFinalStage = task.stage?.isCompletedStage === true;

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        reviewStatus: 'APPROVED',
        status: isFinalStage ? 'COMPLETED' : 'IN_PROGRESS',
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        correctionText: null,
        correctionAudioUrl: null
      },
      include: {
        assignee: true,
        creator: true,
        reviewedBy: true,
        stage: true,
        project: true,
        reviewHistory: {
          include: { createdBy: { select: { id: true, name: true, profilePic: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    await prisma.taskReviewHistory.create({
      data: {
        taskId: id,
        action: 'APPROVED',
        message: message || 'Task approved by reviewer.',
        createdById: req.user.id
      }
    });

    // Notify assignee
    await createNotification(
      task.assigneeId,
      'Task Approved ✓',
      `Your task "${task.title}" has been approved by ${req.user.name}.`
    );

    return res.json(updatedTask);
  } catch (error) {
    console.error('Approve task error:', error);
    return res.status(500).json({ message: 'Internal server error approving task.' });
  }
};

// 3. Reject Task (Admin / Super Admin / Project Leader)
const rejectTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { correctionText, correctionAudioUrl } = req.body;

    if (!correctionText && !correctionAudioUrl) {
      return res.status(400).json({ message: 'Correction text or audio explanation is required when rejecting.' });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: true }
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const isLeader = task.project?.leaderId === req.user.id || task.project?.teamLeaderId === req.user.id || task.project?.team?.leaderId === req.user.id;
    const canReview = ['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER'].includes(req.user.role) || isLeader;

    if (!canReview) {
      return res.status(403).json({ message: 'Only Admin or Team Leader can approve or reject tasks.' });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        reviewStatus: 'REJECTED',
        status: 'PENDING',
        correctionText: correctionText || null,
        correctionAudioUrl: correctionAudioUrl || null,
        reviewedById: req.user.id,
        reviewedAt: new Date()
      },
      include: {
        assignee: true,
        creator: true,
        reviewedBy: true,
        stage: true,
        project: true,
        reviewHistory: {
          include: { createdBy: { select: { id: true, name: true, profilePic: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    await prisma.taskReviewHistory.create({
      data: {
        taskId: id,
        action: 'REJECTED',
        message: correctionText || 'Task rejected. Corrections required.',
        audioUrl: correctionAudioUrl || null,
        createdById: req.user.id
      }
    });

    // Notify assignee
    await createNotification(
      task.assigneeId,
      'Task Corrections Requested ✕',
      `Your task "${task.title}" was reviewed by ${req.user.name} and requires corrections.`
    );

    return res.json(updatedTask);
  } catch (error) {
    console.error('Reject task error:', error);
    return res.status(500).json({ message: 'Internal server error rejecting task.' });
  }
};

// 4. Retry / Resubmit Task
const retryTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { resubmissionNotes, audioUrl } = req.body;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: true }
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const isAssignee = task.assigneeId === req.user.id;
    const isCreator = task.creatorId === req.user.id;
    const isLeader = task.project?.leaderId === req.user.id;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

    if (!isAssignee && !isCreator && !isLeader && !isAdmin) {
      return res.status(403).json({ message: 'Only task assignee or leaders can retry tasks.' });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        reviewStatus: 'RESUBMITTED',
        status: 'WAITING_FOR_REVIEW',
        resubmittedAt: new Date()
      },
      include: {
        assignee: true,
        creator: true,
        reviewedBy: true,
        stage: true,
        project: true,
        reviewHistory: {
          include: { createdBy: { select: { id: true, name: true, profilePic: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    await prisma.taskReviewHistory.create({
      data: {
        taskId: id,
        action: 'RESUBMITTED',
        message: resubmissionNotes || 'Corrections completed and task resubmitted.',
        audioUrl: audioUrl || null,
        createdById: req.user.id
      }
    });

    // Notify reviewer or admins
    const targetReviewerId = task.reviewedById || task.project?.leaderId;
    if (targetReviewerId && targetReviewerId !== req.user.id) {
      await createNotification(
        targetReviewerId,
        'Task Resubmitted for Review',
        `${req.user.name} completed corrections on task "${task.title}".`
      );
    }

    return res.json(updatedTask);
  } catch (error) {
    console.error('Retry task error:', error);
    return res.status(500).json({ message: 'Internal server error retrying task.' });
  }
};

// 5. Get Task Review History Audit Trail
const getTaskReviewHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const history = await prisma.taskReviewHistory.findMany({
      where: { taskId: id },
      include: {
        createdBy: {
          select: { id: true, name: true, profilePic: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(history);
  } catch (error) {
    console.error('Get task review history error:', error);
    return res.status(500).json({ message: 'Internal server error fetching review history.' });
  }
};

module.exports = {
  submitForReview,
  approveTask,
  rejectTask,
  retryTask,
  getTaskReviewHistory
};
