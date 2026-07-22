const prisma = require('../utils/db');
const { createNotification } = require('../services/notification');
const { logActivity } = require('../utils/activityLogger');
const { sendTaskAssignmentEmail, sendTaskStatusUpdateEmail, sendTeamTaskAssignmentEmail } = require('../services/email');

const createTask = async (req, res) => {
  try {
    const { title, description, priority, deadline, assigneeId, type, storyPoints, sprintName, assignType, teamId } = req.body;
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
            sprintName: sprintName || null
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
      }

      await sendTeamTaskAssignmentEmail(team, { title, priority, deadline }, req.user, team.leader, team.members);

      await logActivity({
        userId: req.user.id,
        action: 'TASK_CREATE_TEAM',
        details: `Assigned team task "${title}" to team "${team.name}" (${tasksCreated.length} interns)`
      });

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

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority,
        deadline: new Date(deadline),
        assigneeId,
        creatorId: req.user.id,
        teamId: assigneeTeam ? assigneeTeam.teamId : null,
        attachments: filePaths,
        status: 'PENDING',
        type: type || 'TASK',
        storyPoints: storyPoints ? parseInt(storyPoints, 10) : 0,
        sprintName: sprintName || null
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, role: true } }
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

    res.status(201).json(task);
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
        submissions: { orderBy: { submittedAt: 'desc' } },
        comments: { orderBy: { createdAt: 'asc' } }
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
        submissions: { orderBy: { submittedAt: 'desc' } },
        comments: { orderBy: { createdAt: 'asc' } },
        history: { orderBy: { createdAt: 'desc' } },
        subtasks: { orderBy: { createdAt: 'asc' } }
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
    const { status } = req.body;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    // Validate state transition by role
    if (req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') {
      if (task.assigneeId !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized status transition.' });
      }

      // Intern/Employee can transition: PENDING -> IN_PROGRESS, or re-run
      if (status !== 'IN_PROGRESS' && status !== 'WAITING_FOR_REVIEW') {
        return res.status(400).json({ message: 'Interns/Employees can only update task to In Progress or Submit for Review.' });
      }
    } else if (req.user.role === 'TEAM_LEADER') {
      // Team leader can approve, reject, or mark in progress
      // Verify leader leads assignee's team
      const assigneeTeam = await prisma.teamMember.findFirst({
        where: { userId: task.assigneeId },
        include: { team: true }
      });

      if (!assigneeTeam || assigneeTeam.team.leaderId !== req.user.id) {
        return res.status(403).json({ message: 'You can only review tasks for your own team members.' });
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { status },
      include: { assignee: true, creator: true }
    });

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

    res.status(201).json(submission);
  } catch (error) {
    console.error('Submit task error:', error);
    res.status(500).json({ message: 'Failed to submit work.' });
  }
};

const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Comment text is required.' });
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const comment = await prisma.comment.create({
      data: {
        taskId: id,
        userId: req.user.id,
        text
      }
    });

    // Log history
    await prisma.taskHistory.create({
      data: {
        taskId: id,
        userId: req.user.id,
        action: 'COMMENT',
        detail: `Added comment: "${text.substring(0, 30)}..."`
      }
    });

    // Notify other party
    const targetUserId = req.user.id === task.assigneeId ? task.creatorId : task.assigneeId;
    await createNotification({
      userId: targetUserId,
      title: 'New Comment on Task',
      message: `${req.user.name} commented on "${task.title}": "${text.substring(0, 40)}"`,
      type: 'TASK_UPDATED'
    });

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
  deleteSubtask
};
