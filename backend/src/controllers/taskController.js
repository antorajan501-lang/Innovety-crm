const prisma = require('../utils/db');
const { createNotification } = require('../services/notification');
const { logActivity } = require('../utils/activityLogger');
const { sendTaskAssignmentEmail, sendTaskStatusUpdateEmail, sendTeamTaskAssignmentEmail } = require('../services/email');
const { syncProjectLifecycleChatRoom } = require('../services/projectChatService');
const { getIo, broadcastTeamPerformanceUpdate } = require('../socket');

const createTask = async (req, res) => {
  try {
    const { title, description, priority, deadline, assigneeId, type, storyPoints, sprintName, assignType, teamId, projectId, estimatedHours, stageId } = req.body;
    let filePaths = [];

    if (req.files) {
      filePaths = req.files.map((file) => `/uploads/attachments/${file.filename}`);
    }

    if (!title || !description || !deadline) {
      return res.status(400).json({ message: 'Title, description, and deadline are required.' });
    }

    if (assignType === 'TEAM') {
      if (!teamId) {
        return res.status(400).json({ message: 'Team ID is required for team assignments.' });
      }

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          leader: true,
          members: {
            include: { user: true }
          }
        }
      });

      if (!team) {
        return res.status(404).json({ message: 'Team not found.' });
      }

      if (req.user.role === 'TEAM_LEADER' && team.leaderId !== req.user.id) {
        return res.status(403).json({ message: 'You can only assign tasks to your own team.' });
      }

      let targetAssignees = team.members.filter(m => m.user && (m.user.role === 'INTERN' || m.user.role === 'EMPLOYEE'));

      if (targetAssignees.length === 0 && team.members.length > 0) {
        targetAssignees = team.members.filter(m => m.user);
      }

      if (targetAssignees.length === 0 && team.leaderId) {
        targetAssignees = [{ userId: team.leaderId, user: team.leader }];
      }

      if (targetAssignees.length === 0) {
        return res.status(400).json({ message: 'Cannot assign task: the selected team has no active members or interns. Please allocate members to this team in Team Hub.' });
      }

      const tasksCreated = [];

      for (let member of targetAssignees) {
        const t = await prisma.task.create({
          data: {
            title,
            description,
            priority,
            deadline: new Date(deadline),
            assigneeId: member.userId,
            creatorId: req.user.id,
            teamId: team.id,
            attachments: filePaths,
            status: 'PENDING',
            type: type || 'TASK',
            storyPoints: storyPoints ? parseInt(storyPoints, 10) : 0,
            sprintName: sprintName || null,
            projectId: projectId || null
          },
          include: {
            assignee: { select: { id: true, name: true, email: true } },
            creator: { select: { id: true, name: true, role: true } }
          }
        });

        await prisma.taskHistory.create({
          data: {
            taskId: t.id,
            userId: req.user.id,
            action: 'ASSIGNED',
            detail: `Task created and assigned to ${t.assignee.name} via team assignment`
          }
        });

        await createNotification({
          userId: member.userId,
          title: 'New Team Task Assigned',
          message: `A team task "${title}" has been assigned to you.`,
          type: 'TASK_ASSIGNED'
        });

        tasksCreated.push(t);
        if (projectId) {
          await syncProjectLifecycleChatRoom(projectId);
        }
      }

      await sendTeamTaskAssignmentEmail(team, { title, priority, deadline }, req.user, team.leader, team.members);

      await logActivity({
        userId: req.user.id,
        action: 'TASK_CREATE_TEAM',
        details: `Assigned team task "${title}" to team "${team.name}" (${tasksCreated.length} interns)`
      });

      try { broadcastTeamPerformanceUpdate(); } catch (e) { /* non-critical */ }

      return res.status(201).json({
        message: `Task assigned successfully to all ${tasksCreated.length} interns on team "${team.name}".`,
        tasks: tasksCreated
      });
    }

    if (!assigneeId) {
      return res.status(400).json({ message: 'Assignee ID is required.' });
    }

    // Check if target assignee is System Admin
    const targetAssignee = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (targetAssignee && targetAssignee.role === 'ADMIN') {
      return res.status(400).json({ message: 'Tasks cannot be assigned to System Administrators. Please assign tasks to Team Leaders or Interns.' });
    }

    // Verify team association
    const assigneeTeam = await prisma.teamMember.findFirst({
      where: { userId: assigneeId },
      include: { team: true }
    });

    if (req.user.role === 'TEAM_LEADER') {
      // Confirm lead status
      if (!assigneeTeam || assigneeTeam.team.leaderId !== req.user.id) {
        return res.status(403).json({ message: 'You can only assign tasks to your own team members.' });
      }
    }

    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { members: { select: { userId: true } } }
      });

      if (!project || project.isDeleted) {
        return res.status(404).json({ message: 'Project not found' });
      }

      const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
      if (!isPrivileged) {
        const isProjectMember = project.members.some(m => m.userId === assigneeId) ||
          project.leaderId === assigneeId ||
          project.creatorId === assigneeId;
        if (!isProjectMember) {
          return res.status(400).json({ message: 'Task assignee must be a member of the selected project.' });
        }
      }
    }

    let targetStageId = stageId || null;
    let initialTaskStatus = 'PENDING';

    if (projectId && !targetStageId) {
      const firstStage = await prisma.projectWorkflowStage.findFirst({
        where: { projectId },
        orderBy: { order: 'asc' }
      });
      if (firstStage) {
        targetStageId = firstStage.id;
        if (firstStage.isCompletedStage) {
          initialTaskStatus = 'APPROVED';
        }
      }
    } else if (targetStageId) {
      const assignedStage = await prisma.projectWorkflowStage.findUnique({
        where: { id: targetStageId }
      });
      if (assignedStage && assignedStage.isCompletedStage) {
        initialTaskStatus = 'APPROVED';
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority,
        deadline: new Date(deadline),
        assigneeId,
        creatorId: req.user.id,
        teamId: assigneeTeam ? assigneeTeam.teamId : null,
        projectId: projectId || null,
        stageId: targetStageId,
        attachments: filePaths,
        status: initialTaskStatus,
        type: type || 'TASK',
        storyPoints: storyPoints ? parseInt(storyPoints, 10) : 0,
        sprintName: sprintName || null,
        estimatedHours: parseFloat(estimatedHours) || 0
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, projectCode: true, name: true } },
        stage: true
      }
    });

    // Create history record
    await prisma.taskHistory.create({
      data: {
        taskId: task.id,
        userId: req.user.id,
        action: 'ASSIGNED',
        detail: `Task created and assigned to ${task.assignee.name}`
      }
    });

    // Notify Intern
    await createNotification({
      userId: assigneeId,
      title: 'New Task Assigned',
      message: `You have been assigned a new task: "${title}". Deadline: ${new Date(deadline).toLocaleDateString()}`,
      type: 'TASK_ASSIGNED'
    });

    // Email Dispatch
    sendTaskAssignmentEmail(task.assignee, task, task.creator).catch((err) => {
      console.error('Failed to send task assignment welcome email:', err);
    });

    await logActivity({
      userId: req.user.id,
      action: 'TASK_CREATE',
      details: `Created task "${title}" assigned to user ID: ${assigneeId}`
    });

    if (projectId) {
      await syncProjectLifecycleChatRoom(projectId);
    }

    try {
      const io = getIo();
      if (io) io.emit('task_created', task);
    } catch (e) {
      console.error('Socket emit task_created error:', e);
    }

    try { broadcastTeamPerformanceUpdate(); } catch (e) { /* non-critical */ }

    console.log('Creating task for project:', projectId);
    console.log('Created task id:', task.id);

    return res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Failed to create task.' });
  }
};

const getTasks = async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    const where = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    where.AND = [
      {
        OR: [
          { projectId: null },
          { project: { isDeleted: false } }
        ]
      }
    ];

    // Role filters
    if (req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') {
      where.assigneeId = req.user.id;
    } else if (req.user.role === 'TEAM_LEADER') {
      // Find all teams led by this leader
      const teams = await prisma.team.findMany({
        where: { leaderId: req.user.id }
      });
      const teamIds = teams.map((t) => t.id);

      where.OR = [
        { teamId: { in: teamIds } },
        { creatorId: req.user.id }
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, employeeId: true, profilePic: true } },
        creator: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true, role: true, profilePic: true } },
        submissions: { orderBy: { submittedAt: 'desc' } },
        comments: {
          include: { user: { select: { id: true, name: true, profilePic: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        },
        stage: true,
        reviewHistory: {
          include: { createdBy: { select: { id: true, name: true, profilePic: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        },
        stageApprovalAudits: {
          include: {
            requestedBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Failed to fetch tasks.' });
  }
};

const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, employeeId: true, profilePic: true } },
        creator: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true, role: true, profilePic: true } },
        submissions: { orderBy: { submittedAt: 'desc' } },
        comments: {
          include: { user: { select: { id: true, name: true, profilePic: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        },
        history: { orderBy: { createdAt: 'desc' } },
        reviewHistory: {
          include: { createdBy: { select: { id: true, name: true, profilePic: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        },
        subtasks: { orderBy: { createdAt: 'asc' } },
        stage: true,
        stageApprovalAudits: {
          include: {
            requestedBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    // Verify role permissions
    if ((req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') && task.assigneeId !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to view this task.' });
    }

    res.json(task);
  } catch (error) {
    console.error('Get task by ID error:', error);
    res.status(500).json({ message: 'Failed to fetch task details.' });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, stageId, comment } = req.body;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    // Verify task move permission (ADMIN, SUPER_ADMIN, TEAM_LEADER, Assignee, Creator, Project Leader, Project Member)
    const project = task.projectId ? await prisma.project.findUnique({
      where: { id: task.projectId },
      include: { members: true, team: true }
    }) : null;

    const canMoveTask =
      ['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER'].includes(req.user.role) ||
      task.assigneeId === req.user.id ||
      task.creatorId === req.user.id ||
      (project && project.leaderId === req.user.id) ||
      (project && project.team?.leaderId === req.user.id) ||
      (project && project.members?.some(m => m.userId === req.user.id));

    if (!canMoveTask) {
      return res.status(403).json({ message: 'You do not have permission to move this task.' });
    }

    let nextStatus = status || task.status;
    let nextStageId = stageId || task.stageId;
    let nextStageApprovalStatus = task.stageApprovalStatus;
    let targetStage = null;

    if (stageId && stageId !== task.stageId) {
      targetStage = await prisma.projectWorkflowStage.findUnique({
        where: { id: stageId },
        include: { project: true }
      });

      if (!targetStage) {
        return res.status(404).json({ message: 'Target workflow stage not found.' });
      }

      if (task.projectId && targetStage.projectId !== task.projectId) {
        return res.status(400).json({ message: 'Target workflow stage does not belong to this project.' });
      }

      // Enforce Step-by-Step Sequential Progression (+1 or -1 adjacent stage)
      if (task.stageId) {
        const allStages = await prisma.projectWorkflowStage.findMany({
          where: { projectId: task.projectId },
          orderBy: { order: 'asc' }
        });

        const currentIdx = allStages.findIndex(s => s.id === task.stageId);
        const targetIdx = allStages.findIndex(s => s.id === targetStage.id);

        const isAdjacent = currentIdx < 0 || targetIdx < 0 || Math.abs(targetIdx - currentIdx) === 1;
        const isPrivilegedBypass = ['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER'].includes(req.user.role);
        if (!isAdjacent && !isPrivilegedBypass) {
          return res.status(400).json({ message: 'Task must move step by step.' });
        }
      }

      nextStageId = targetStage.id;

      if (targetStage.isCompletedStage) {
        nextStatus = 'COMPLETED';
      } else if (targetStage.requiresApproval) {
        nextStatus = 'WAITING_FOR_REVIEW';
      } else {
        nextStatus = 'IN_PROGRESS';
      }

      if (targetStage.requiresApproval) {
        const isPrivilegedApprover =
          ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role) ||
          targetStage.approverId === req.user.id ||
          (targetStage.approverRole === 'PROJECT_LEADER' && targetStage.project?.leaderId === req.user.id);

        if (isPrivilegedApprover) {
          nextStageApprovalStatus = 'APPROVED';
          await prisma.taskStageApprovalAudit.create({
            data: {
              taskId: id,
              stageId: targetStage.id,
              requestedById: req.user.id,
              approvedById: req.user.id,
              status: 'APPROVED',
              approvedAt: new Date(),
              comment: comment || 'Stage transition auto-approved by authorized role.'
            }
          });
        } else {
          nextStageApprovalStatus = 'PENDING';
          await prisma.taskStageApprovalAudit.create({
            data: {
              taskId: id,
              stageId: targetStage.id,
              requestedById: req.user.id,
              status: 'PENDING',
              comment: comment || 'Stage transition requested requiring approval.'
            }
          });

          // Notify approver
          const notifyUserId = targetStage.approverId || targetStage.project?.leaderId;
          if (notifyUserId && notifyUserId !== req.user.id) {
            await createNotification({
              userId: notifyUserId,
              title: 'Stage Transition Approval Required',
              message: `Task "${task.title}" requires your approval to move to stage "${targetStage.name}".`,
              type: 'APPROVAL_REQUIRED'
            });
          }
        }
      } else {
        nextStageApprovalStatus = 'NOT_REQUIRED';
      }
    }

    // Dependency Validation: Block moving to IN_PROGRESS, APPROVED, or COMPLETED if prerequisites are incomplete
    if (['IN_PROGRESS', 'APPROVED', 'COMPLETED'].includes(nextStatus)) {
      const incompletePrerequisites = await prisma.taskDependency.findMany({
        where: { taskId: id },
        include: {
          dependsOnTask: { select: { id: true, title: true, status: true } }
        }
      });

      const unfinished = incompletePrerequisites.filter(
        p => p.dependsOnTask.status !== 'APPROVED' && p.dependsOnTask.status !== 'COMPLETED'
      );

      if (unfinished.length > 0) {
        const titles = unfinished.map(u => u.dependsOnTask.title).join(', ');
        return res.status(400).json({
          message: `This task depends on unfinished tasks: ${titles}`
        });
      }
    }

    const isChangingStage = Boolean(stageId && stageId !== task.stageId);
    const nextReviewStatus = isChangingStage
      ? (targetStage?.requiresApproval ? (nextStageApprovalStatus === 'APPROVED' ? 'APPROVED' : 'PENDING') : 'APPROVED')
      : task.reviewStatus;

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: nextStatus,
        stageId: nextStageId,
        stageApprovalStatus: nextStageApprovalStatus,
        reviewStatus: nextReviewStatus,
        reviewedById: (isChangingStage && !targetStage?.requiresApproval) ? null : task.reviewedById,
        reviewedAt: (isChangingStage && !targetStage?.requiresApproval) ? null : task.reviewedAt,
        approvalStatus: nextStatus === 'APPROVED' ? 'APPROVED' : nextStatus === 'REJECTED' ? 'REJECTED' : (task.approvalStatus || 'NOT_REQUIRED')
      },
      include: {
        assignee: true,
        creator: true,
        stage: true,
        stageApprovalAudits: {
          include: {
            requestedBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // If task was completed, check if any dependent tasks are now fully unlocked
    if (status === 'APPROVED' || status === 'COMPLETED') {
      const dependents = await prisma.taskDependency.findMany({
        where: { dependsOnTaskId: id },
        include: {
          task: {
            include: {
              prerequisites: {
                include: { dependsOnTask: { select: { status: true } } }
              }
            }
          }
        }
      });

      for (const dep of dependents) {
        const depTask = dep.task;
        const allCompleted = depTask.prerequisites.every(
          p => p.dependsOnTask.status === 'APPROVED' || p.dependsOnTask.status === 'COMPLETED'
        );
        if (allCompleted && depTask.assigneeId) {
          await createNotification({
            userId: depTask.assigneeId,
            title: 'Task Dependency Unlocked',
            message: `All prerequisites for task "${depTask.title}" are now completed! You can start work on it.`,
            type: 'DEPENDENCY_UNLOCKED'
          });
        }
      }
    }

    // Log history
    await prisma.taskHistory.create({
      data: {
        taskId: id,
        userId: req.user.id,
        action: 'STATUS_CHANGE',
        detail: `Status updated to ${status}`
      }
    });

    // Notify respective users
    if (req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') {
      // Notify creator / team leader
      await createNotification({
        userId: task.creatorId,
        title: 'Task Status Updated',
        message: `${req.user.name} set task "${task.title}" to ${status}.`,
        type: 'TASK_UPDATED'
      });

      // Email Dispatch to Creator (Team Leader)
      sendTaskStatusUpdateEmail(updatedTask.creator, updatedTask, updatedTask.assignee, status).catch((err) => {
        console.error('Failed to send task update email to creator:', err);
      });

      // Email Dispatch to Admins
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      for (let admin of admins) {
        if (admin.id !== updatedTask.creatorId) {
          sendTaskStatusUpdateEmail(admin, updatedTask, updatedTask.assignee, status).catch((err) => {
            console.error('Failed to send task update email to admin:', err);
          });
        }
      }
    } else {
      // Notify assignee (Intern)
      let title = 'Task Status Updated';
      let msg = `Your task "${task.title}" was set to ${status}.`;
      if (status === 'APPROVED') {
        title = 'Task Approved';
        msg = `Excellent! Your task "${task.title}" has been approved.`;
      } else if (status === 'REJECTED') {
        title = 'Task Rejected';
        msg = `Your submission for task "${task.title}" was rejected. Please review feedback.`;
      }

      await createNotification({
        userId: task.assigneeId,
        title,
        message: msg,
        type: `TASK_${status}`
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'TASK_STATUS_UPDATE',
      details: `Updated task "${task.title}" status to ${status}`
    });

    if (updatedTask.projectId) {
      await syncProjectLifecycleChatRoom(updatedTask.projectId);
    }

    try {
      const io = getIo();
      if (io) io.emit('task_updated', updatedTask);
    } catch (e) {
      console.error('Socket emit task_updated error:', e);
    }

    try { broadcastTeamPerformanceUpdate(); } catch (e) { /* non-critical */ }

    res.json(updatedTask);
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ message: 'Failed to update task status.' });
  }
};

const submitTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { submitNotes } = req.body;
    let filePaths = [];

    if (req.files) {
      filePaths = req.files.map((file) => `/uploads/submissions/${file.filename}`);
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    if (task.assigneeId !== req.user.id) {
      return res.status(403).json({ message: 'Only the assignee can submit work for this task.' });
    }

    // Create Submission record
    const submission = await prisma.taskSubmission.create({
      data: {
        taskId: id,
        userId: req.user.id,
        submitNotes,
        files: filePaths
      }
    });

    // Update Task Status to Review
    const updatedTask = await prisma.task.update({
      where: { id },
      data: { status: 'WAITING_FOR_REVIEW' },
      include: { assignee: true, creator: true }
    });

    // Log history
    await prisma.taskHistory.create({
      data: {
        taskId: id,
        userId: req.user.id,
        action: 'SUBMITTED',
        detail: 'Work submitted for review'
      }
    });

    // Notify task creator/leader
    await createNotification({
      userId: task.creatorId,
      title: 'Task Submission Received',
      message: `${req.user.name} submitted work for "${task.title}".`,
      type: 'TASK_COMPLETED'
    });

    // Email Dispatch to Creator (Team Leader)
    sendTaskStatusUpdateEmail(updatedTask.creator, updatedTask, updatedTask.assignee, 'WAITING_FOR_REVIEW').catch((err) => {
      console.error('Failed to send task submit email to creator:', err);
    });

    // Email Dispatch to Admins
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    for (let admin of admins) {
      if (admin.id !== updatedTask.creatorId) {
        sendTaskStatusUpdateEmail(admin, updatedTask, updatedTask.assignee, 'WAITING_FOR_REVIEW').catch((err) => {
          console.error('Failed to send task submit email to admin:', err);
        });
      }
    }

    await logActivity({
      userId: req.user.id,
      action: 'TASK_SUBMIT',
      details: `Submitted work for task "${task.title}"`
    });

    try { broadcastTeamPerformanceUpdate(); } catch (e) { /* non-critical */ }

    res.status(201).json(submission);
  } catch (error) {
    console.error('Submit task error:', error);
    res.status(500).json({ message: 'Failed to submit work.' });
  }
};

const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, audioUrl, type } = req.body;

    if (!text && !audioUrl) {
      return res.status(400).json({ message: 'Comment text or audio is required.' });
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const comment = await prisma.comment.create({
      data: {
        taskId: id,
        userId: req.user.id,
        text: text || (type === 'AUDIO' ? 'Voice Message' : ''),
        audioUrl: audioUrl || null,
        type: type || (audioUrl ? 'AUDIO' : 'TEXT')
      },
      include: {
        user: { select: { id: true, name: true, profilePic: true, role: true } }
      }
    });

    // Log history
    await prisma.taskHistory.create({
      data: {
        taskId: id,
        userId: req.user.id,
        action: 'COMMENT',
        detail: `Added ${type === 'AUDIO' ? 'voice audio' : 'text'} comment.`
      }
    });

    // Notify other party
    const targetUserId = req.user.id === task.assigneeId ? task.creatorId : task.assigneeId;
    if (targetUserId) {
      await createNotification({
        userId: targetUserId,
        title: 'New Comment on Task',
        message: `${req.user.name} commented on "${task.title}".`,
        type: 'TASK_UPDATED'
      });
    }

    // Broadcast Socket.IO event
    try {
      const io = getIo();
      if (io) {
        io.emit('task_comment_created', comment);
        io.to(`task:${id}`).emit('taskMessage:new', comment);
      }
    } catch (e) {
      console.error('Socket comment emit error:', e);
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Failed to add comment.' });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, deadline, assigneeId, status, type, storyPoints, sprintName } = req.body;

    const task = await prisma.task.findUnique({
      where: { id }
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    // Auth check
    if (req.user.role === 'TEAM_LEADER') {
      const assigneeTeam = await prisma.teamMember.findFirst({
        where: { userId: task.assigneeId },
        include: { team: true }
      });
      if (!assigneeTeam || assigneeTeam.team.leaderId !== req.user.id) {
        return res.status(403).json({ message: 'You can only edit tasks for your own team members.' });
      }
    }

    const targetProjectId = req.body.projectId || task.projectId;
    const targetAssigneeId = assigneeId || task.assigneeId;

    if (targetProjectId && targetAssigneeId) {
      const project = await prisma.project.findUnique({
        where: { id: targetProjectId },
        include: { members: { select: { userId: true } } }
      });
      if (project) {
        const isProjectMember = project.members.some(m => m.userId === targetAssigneeId) ||
          project.leaderId === targetAssigneeId ||
          project.creatorId === targetAssigneeId;
        if (!isProjectMember) {
          return res.status(400).json({ message: 'Task assignee must be a member of the selected project.' });
        }
      }
    }

    let filePaths = [...(task.attachments || [])];
    if (req.files && req.files.length > 0) {
      const newPaths = req.files.map((file) => `/uploads/attachments/${file.filename}`);
      filePaths = [...filePaths, ...newPaths];
    }

    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (priority !== undefined) data.priority = priority;
    if (deadline !== undefined) data.deadline = new Date(deadline);
    if (assigneeId !== undefined) data.assigneeId = assigneeId;
    if (status !== undefined) data.status = status;
    if (type !== undefined) data.type = type;
    if (storyPoints !== undefined) data.storyPoints = storyPoints ? parseInt(storyPoints, 10) : 0;
    if (sprintName !== undefined) data.sprintName = sprintName || null;
    if (req.files && req.files.length > 0) data.attachments = filePaths;

    const updated = await prisma.task.update({
      where: { id },
      data,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, role: true } }
      }
    });

    // Log history
    await prisma.taskHistory.create({
      data: {
        taskId: id,
        userId: req.user.id,
        action: 'EDITED',
        detail: `Task details edited by ${req.user.name}`
      }
    });

    // Notify assignee if assignee changed
    if (assigneeId && assigneeId !== task.assigneeId) {
      await createNotification({
        userId: assigneeId,
        title: 'New Task Reassigned',
        message: `A task "${updated.title}" has been reassigned to you.`,
        type: 'TASK_ASSIGNED'
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'TASK_EDIT',
      details: `Edited task "${updated.title}" (ID: ${id})`
    });

    if (updated.projectId) {
      await syncProjectLifecycleChatRoom(updated.projectId);
    }

    try { broadcastTeamPerformanceUpdate(); } catch (e) { /* non-critical */ }

    res.json(updated);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Failed to update task details.' });
  }
};

const createSubtask = async (req, res) => {
  try {
    const { id: taskId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Subtask title is required.' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    if ((req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') && task.assigneeId !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to add subtasks.' });
    }

    const subtask = await prisma.subtask.create({
      data: {
        taskId,
        title,
        isDone: false
      }
    });

    await prisma.taskHistory.create({
      data: {
        taskId,
        userId: req.user.id,
        action: 'EDITED',
        detail: `Added subtask: "${title}"`
      }
    });

    res.status(201).json(subtask);
  } catch (error) {
    console.error('Create subtask error:', error);
    res.status(500).json({ message: 'Failed to create subtask.' });
  }
};

const toggleSubtask = async (req, res) => {
  try {
    const { subtaskId } = req.params;
    const { isDone, title } = req.body;

    const subtask = await prisma.subtask.findUnique({
      where: { id: subtaskId },
      include: { task: true }
    });

    if (!subtask) {
      return res.status(404).json({ message: 'Subtask not found.' });
    }

    if ((req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') && subtask.task.assigneeId !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to modify this subtask.' });
    }

    const data = {};
    if (isDone !== undefined) data.isDone = isDone;
    if (title !== undefined) data.title = title;

    const updated = await prisma.subtask.update({
      where: { id: subtaskId },
      data
    });

    await prisma.taskHistory.create({
      data: {
        taskId: subtask.taskId,
        userId: req.user.id,
        action: 'EDITED',
        detail: `Updated subtask "${subtask.title}": ${isDone !== undefined ? (isDone ? 'Marked completed' : 'Marked pending') : 'Renamed'}`
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Toggle subtask error:', error);
    res.status(500).json({ message: 'Failed to modify subtask.' });
  }
};

const deleteSubtask = async (req, res) => {
  try {
    const { subtaskId } = req.params;

    const subtask = await prisma.subtask.findUnique({
      where: { id: subtaskId },
      include: { task: true }
    });

    if (!subtask) {
      return res.status(404).json({ message: 'Subtask not found.' });
    }

    if ((req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') && subtask.task.assigneeId !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to delete this subtask.' });
    }

    await prisma.subtask.delete({
      where: { id: subtaskId }
    });

    await prisma.taskHistory.create({
      data: {
        taskId: subtask.taskId,
        userId: req.user.id,
        action: 'EDITED',
        detail: `Deleted subtask: "${subtask.title}"`
      }
    });

    res.json({ message: 'Subtask deleted successfully.' });
  } catch (error) {
    console.error('Delete subtask error:', error);
    res.status(500).json({ message: 'Failed to delete subtask.' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    if (req.user.role === 'TEAM_LEADER' && task.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete tasks you created.' });
    }

    if (task.projectId) {
      await syncProjectLifecycleChatRoom(task.projectId);
    }

    await prisma.task.delete({ where: { id } });

    // Broadcast real-time Socket.io chat rooms update signal
    const { getIo } = require('../socket');
    const io = getIo();
    if (io) {
      io.emit('chat_rooms_updated');
    }

    await logActivity({
      userId: req.user.id,
      action: 'TASK_DELETE',
      details: `Deleted task "${task.title}" (ID: ${id})`
    });

    try { broadcastTeamPerformanceUpdate(); } catch (e) { /* non-critical */ }

    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Failed to delete task.' });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTaskStatus,
  submitTask,
  addComment,
  updateTask,
  createSubtask,
  toggleSubtask,
  deleteSubtask,
  deleteTask
};
