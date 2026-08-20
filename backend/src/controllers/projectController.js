const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('../services/notification');
const { syncProjectLifecycleChatRoom } = require('../services/projectChatService');
const { getIo, broadcastTeamPerformanceUpdate } = require('../socket');

/**
 * Generate Next Project Code (PRJ-1001, PRJ-1002...)
 */
const generateProjectCode = async () => {
  const lastProject = await prisma.project.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { projectCode: true }
  });

  if (!lastProject || !lastProject.projectCode) {
    return 'PRJ-1001';
  }

  const match = lastProject.projectCode.match(/PRJ-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `PRJ-${String(nextNum).padStart(4, '0')}`;
  }

  return `PRJ-${Date.now().toString().slice(-4)}`;
};

/**
 * Helper to compute health indicator for a project
 */
const computeProjectHealth = (project, totalTasks, completedTasks) => {
  if (project.status === 'COMPLETED') return 'Completed';
  if (project.status === 'CANCELLED') return 'Cancelled';
  if (project.status === 'ON_HOLD') return 'On Hold';
  if (project.status === 'DRAFT') return 'Draft';
  if (project.status === 'SCHEDULED') return 'Scheduled';
  if (project.status === 'ARCHIVED') return 'Archived';

  const today = new Date();
  const endDate = new Date(project.estimatedEndDate);

  if (today > endDate) {
    return 'Delayed'; // 🔴 Delayed
  }

  // If nearing end date (within 3 days) or progress is < 50% with less than 25% time left
  const startDate = new Date(project.estimatedStartDate);
  const totalDuration = endDate.getTime() - startDate.getTime();
  const timeElapsed = today.getTime() - startDate.getTime();
  const progressRatio = totalTasks > 0 ? (completedTasks / totalTasks) : 0;

  if (totalDuration > 0 && (timeElapsed / totalDuration) > 0.75 && progressRatio < 0.5) {
    return 'At Risk'; // 🟡 At Risk
  }

  const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
  if (diffDays <= 3 && progressRatio < 0.8) {
    return 'At Risk';
  }

  return 'On Track'; // 🟢 On Track
};

const DEFAULT_WORKFLOW_STAGES = [
  { name: 'To Do', color: '#64748B', order: 0, requiresApproval: false, isCompletedStage: false },
  { name: 'In Progress', color: '#EAB308', order: 1, requiresApproval: false, isCompletedStage: false },
  { name: 'In Review', color: '#8B5CF6', order: 2, requiresApproval: true, approverRole: 'PROJECT_LEADER', isCompletedStage: false },
  { name: 'Done', color: '#10B981', order: 3, requiresApproval: true, isCompletedStage: true }
];

const validateWorkflowStages = (stages) => {
  if (!Array.isArray(stages)) {
    return { valid: false, message: 'Workflow stages must be an array.' };
  }
  if (stages.length < 2) {
    return { valid: false, message: 'Minimum 2 workflow stages are required per project.' };
  }
  if (stages.length > 10) {
    return { valid: false, message: 'Maximum 10 workflow stages are allowed per project.' };
  }

  const names = new Set();
  const orders = new Set();
  let completedCount = 0;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const name = (stage.name || '').trim();
    if (!name) {
      return { valid: false, message: `Stage at index ${i + 1} must have a non-empty name.` };
    }
    const lowerName = name.toLowerCase();
    if (names.has(lowerName)) {
      return { valid: false, message: `Duplicate stage name "${name}". Stage names must be unique within a project.` };
    }
    names.add(lowerName);

    const order = typeof stage.order === 'number' ? stage.order : i;
    if (orders.has(order)) {
      return { valid: false, message: `Duplicate stage order value (${order}). Order values must be unique.` };
    }
    orders.add(order);

    if (stage.isCompletedStage === true || String(stage.isCompletedStage) === 'true') {
      completedCount++;
    }
  }

  if (completedCount !== 1) {
    return { valid: false, message: 'Exactly 1 completed stage (isCompletedStage: true) must exist per project.' };
  }

  return { valid: true };
};

// 1. Create Project
const createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      priority,
      estimatedStartDate,
      estimatedEndDate,
      status,
      teamId,
      leaderId,
      memberIds,
      workflowStages
    } = req.body;

    if (!name || !estimatedStartDate || !estimatedEndDate) {
      return res.status(400).json({ message: 'Project Name, Estimated Start Date, and End Date are required.' });
    }

    if (new Date(estimatedEndDate) <= new Date(estimatedStartDate)) {
      return res.status(400).json({ message: 'Estimated End Date must be after Estimated Start Date.' });
    }

    // Process & deduplicate members; ensure mandatory Project Leader is included if set
    const rawMemberIds = Array.isArray(memberIds) ? memberIds : [];
    if (leaderId && !rawMemberIds.includes(leaderId)) {
      rawMemberIds.push(leaderId);
    }
    const finalMemberIds = Array.from(new Set(rawMemberIds.filter(Boolean)));

    // Prevent creation if team is selected but 0 members are checked
    if (teamId && finalMemberIds.length === 0) {
      return res.status(400).json({ message: 'Please select at least one project member.' });
    }

    const rawStages = (Array.isArray(workflowStages) && workflowStages.length > 0) ? workflowStages : DEFAULT_WORKFLOW_STAGES;
    const lastIndex = rawStages.length - 1;
    const enforcedStages = rawStages.map((stage, index) => ({
      ...stage,
      order: index,
      isCompletedStage: index === lastIndex,
      requiresApproval: index === lastIndex ? true : !!stage.requiresApproval,
    }));

    const stageValidation = validateWorkflowStages(enforcedStages);
    if (!stageValidation.valid) {
      return res.status(400).json({ message: stageValidation.message });
    }

    const projectCode = await generateProjectCode();
    const initialStatus = (status && String(status).trim() !== '') ? status : 'ACTIVE';
    const isNowActive = initialStatus === 'ACTIVE';

    const project = await prisma.project.create({
      data: {
        projectCode,
        name,
        description: description || null,
        type: type || 'CLIENT',
        priority: priority || 'MEDIUM',
        status: initialStatus,
        estimatedStartDate: new Date(estimatedStartDate),
        estimatedEndDate: new Date(estimatedEndDate),
        actualStartDate: isNowActive ? new Date() : null,
        teamId: teamId || null,
        leaderId: leaderId || null,
        creatorId: req.user.id,
        members: {
          create: finalMemberIds.map(userId => ({ userId }))
        },
        workflowStages: {
          create: rawStages.map((stg, idx) => ({
            name: stg.name.trim(),
            color: stg.color || '#6366F1',
            order: typeof stg.order === 'number' ? stg.order : idx,
            requiresApproval: !!stg.requiresApproval,
            approverRole: stg.approverRole || null,
            approverId: stg.approverId || null,
            isCompletedStage: !!stg.isCompletedStage
          }))
        }
      },
      include: {
        leader: { select: { id: true, name: true, email: true, role: true, profilePic: true } },
        team: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, profilePic: true } }
          }
        },
        workflowStages: { orderBy: { order: 'asc' } }
      }
    });

    // Create ProjectHistory audit entry
    await prisma.projectHistory.create({
      data: {
        projectId: project.id,
        changedById: req.user.id,
        action: 'CREATED',
        newStatus: initialStatus,
        detail: `Project "${project.name}" (${project.projectCode}) created with status ${initialStatus}`
      }
    });

    // Notify assigned leader and members
    const notifyUserIds = new Set();
    if (leaderId) notifyUserIds.add(leaderId);
    finalMemberIds.forEach(id => notifyUserIds.add(id));

    for (const userId of notifyUserIds) {
      if (userId !== req.user.id) {
        await createNotification({
          userId,
          title: 'Assigned to New Project',
          message: `You have been added to project "${project.name}" (${project.projectCode}).`,
          type: 'PROJECT_ASSIGNED'
        });
      }
    }

    await logActivity({
      userId: req.user.id,
      action: 'PROJECT_CREATE',
      details: `Created project "${project.name}" (${project.projectCode})`
    });

    // Sync Chat Room Lifecycle
    await syncProjectLifecycleChatRoom(project.id);

    // Broadcast project_created live Socket.IO event to all clients
    try {
      const io = getIo();
      if (io) {
        io.emit('project_created', project);
      }
    } catch (sockErr) {
      console.error('[project_created Socket Error]:', sockErr);
    }

    try { broadcastTeamPerformanceUpdate(); } catch (e) { /* non-critical */ }

    return res.status(201).json({
      success: true,
      message: `Project ${project.projectCode} created successfully.`,
      project
    });
  } catch (error) {
    console.error('[createProject Error]:', error);
    return res.status(500).json({ message: 'Failed to create project.', error: error.message });
  }
};

const isTaskDoneBackend = (task, stages = []) => {
  if (task.status === 'COMPLETED' || task.status === 'APPROVED') return true;
  const stage = stages.find(s => s.id === task.stageId);
  if (stage) {
    if (stage.isCompletedStage || (stage.name && (stage.name.toLowerCase() === 'done' || stage.name.toLowerCase() === 'completed'))) {
      if (stage.requiresApproval) {
        return task.reviewStatus === 'APPROVED' || task.status === 'COMPLETED' || task.status === 'APPROVED';
      }
      return true;
    }
  }
  return false;
};

const computeProjectStageProgressBackend = (project) => {
  const projTasks = project?.tasks || [];
  const totalTasks = projTasks.length;
  const completedTasks = projTasks.filter(t => isTaskDoneBackend(t, project?.workflowStages)).length;

  if (totalTasks === 0) {
    return { progress: 0, completedTasks: 0, totalTasks: 0 };
  }

  const defaultStages = [
    { id: 'todo', name: 'To Do', statuses: ['PENDING', 'REJECTED'] },
    { id: 'in_progress', name: 'In Progress', statuses: ['IN_PROGRESS'] },
    { id: 'in_review', name: 'In Review', statuses: ['WAITING_FOR_REVIEW'] },
    { id: 'done', name: 'Done', isCompletedStage: true, statuses: ['APPROVED', 'COMPLETED', 'DONE'] }
  ];

  const stages = (project?.workflowStages && project.workflowStages.length > 0)
    ? project.workflowStages
    : defaultStages;

  const totalStages = stages.length;
  if (totalStages <= 1) {
    return { progress: 0, completedTasks, totalTasks };
  }

  const totalProgress = projTasks.reduce((sum, task) => {
    let index = -1;
    const taskStatus = (task.status || '').toLowerCase();

    // 1. Direct stageId match
    if (task.stageId) {
      index = stages.findIndex(s => s.id === task.stageId);
    }

    // 2. Direct stage name / statuses / completion match
    if (index === -1) {
      index = stages.findIndex(s => {
        if (typeof s === 'string') return s.toLowerCase() === taskStatus;
        if (s.name && s.name.toLowerCase() === taskStatus) return true;
        if (s.statuses && s.statuses.map(st => st.toLowerCase()).includes(taskStatus)) return true;
        if (s.isCompletedStage && (taskStatus === 'completed' || taskStatus === 'approved' || taskStatus === 'done')) return true;
        return false;
      });
    }

    // 3. Fallback standard CRM status mapping
    if (index === -1) {
      if (['pending', 'rejected', 'todo', 'to do'].includes(taskStatus)) index = 0;
      else if (['in_progress', 'in progress', 'doing'].includes(taskStatus)) index = Math.min(1, totalStages - 1);
      else if (['waiting_for_review', 'in_review', 'in review', 'review'].includes(taskStatus)) index = Math.min(2, totalStages - 1);
      else if (['approved', 'completed', 'done'].includes(taskStatus)) index = totalStages - 1;
    }

    if (index === -1) return sum;
    const taskProgress = Math.round((index / (totalStages - 1)) * 100);
    return sum + taskProgress;
  }, 0);

  const progress = Math.round(totalProgress / totalTasks);
  return { progress, completedTasks, totalTasks };
};

// 2. Get All Projects (with summary metrics, computed progress %, health, isOverdue)
const getProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereClause = { isDeleted: false };

    // Role-based filtering: non-ADMIN/SUPER_ADMIN users see projects where they are creator, leader, team member, or project member
    if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      whereClause = {
        isDeleted: false,
        OR: [
          { creatorId: userId },
          { leaderId: userId },
          { members: { some: { userId } } },
          { team: { members: { some: { userId } } } },
          { team: { leaderId: userId } }
        ]
      };
    }

    const projectsList = await prisma.project.findMany({
      where: whereClause,
      include: {
        leader: { select: { id: true, name: true, email: true, role: true, profilePic: true } },
        creator: { select: { id: true, name: true, email: true, role: true } },
        team: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, profilePic: true } }
          }
        },
        chatRoom: { select: { id: true, status: true, isArchived: true } },
        tasks: { select: { id: true, status: true, stageId: true, reviewStatus: true } },
        workflowStages: { orderBy: { order: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const today = new Date();
    const formattedProjects = projectsList.map(project => {
      const { progress, completedTasks, totalTasks } = computeProjectStageProgressBackend(project);
      const isOverdue = today > new Date(project.estimatedEndDate) && project.status === 'ACTIVE';
      const health = computeProjectHealth(project, totalTasks, completedTasks);

      return {
        ...project,
        totalTasks,
        completedTasks,
        progress,
        isOverdue,
        health
      };
    });

    // Compute summary metrics for top dashboard cards
    const metrics = {
      total: formattedProjects.length,
      active: formattedProjects.filter(p => p.status === 'ACTIVE').length,
      overdue: formattedProjects.filter(p => p.isOverdue).length,
      completed: formattedProjects.filter(p => p.status === 'COMPLETED').length,
      onHold: formattedProjects.filter(p => p.status === 'ON_HOLD').length,
      cancelled: formattedProjects.filter(p => p.status === 'CANCELLED').length,
      draft: formattedProjects.filter(p => p.status === 'DRAFT').length,
      scheduled: formattedProjects.filter(p => p.status === 'SCHEDULED').length,
      archived: formattedProjects.filter(p => p.status === 'ARCHIVED').length
    };

    return res.status(200).json({
      metrics,
      projects: formattedProjects
    });
  } catch (error) {
    console.error('[getProjects Error]:', error);
    return res.status(500).json({ message: 'Failed to retrieve projects.', error: error.message });
  }
};

// 3. Get Project By ID
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        leader: { select: { id: true, name: true, email: true, role: true, profilePic: true, phone: true } },
        creator: { select: { id: true, name: true, email: true, role: true } },
        team: {
          include: {
            leader: { select: { id: true, name: true, role: true } },
            members: {
              include: { user: { select: { id: true, name: true, role: true, profilePic: true } } }
            }
          }
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, profilePic: true, phone: true } }
          }
        },
        documents: {
          include: {
            uploader: { select: { id: true, name: true, role: true } }
          },
          orderBy: { uploadedAt: 'desc' }
        },
        chatRoom: { select: { id: true, name: true, status: true, isArchived: true } },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, profilePic: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        milestones: {
          include: {
            tasks: { select: { id: true, title: true, status: true } }
          },
          orderBy: { dueDate: 'asc' }
        },
        history: {
          include: {
            changedBy: { select: { id: true, name: true, role: true, profilePic: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        workflowStages: {
          orderBy: { order: 'asc' },
          include: {
            approver: { select: { id: true, name: true, role: true } }
          }
        }
      }
    });

    if (!project || project.isDeleted) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    const { progress, completedTasks, totalTasks } = computeProjectStageProgressBackend(project);
    const isOverdue = new Date() > new Date(project.estimatedEndDate) && project.status === 'ACTIVE';
    const health = computeProjectHealth(project, totalTasks, completedTasks);

    return res.status(200).json({
      ...project,
      totalTasks,
      completedTasks,
      progress,
      isOverdue,
      health
    });
  } catch (error) {
    console.error('[getProjectById Error]:', error);
    return res.status(500).json({ message: 'Failed to fetch project details.', error: error.message });
  }
};

// 4. Update Project
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      type,
      priority,
      estimatedStartDate,
      estimatedEndDate,
      status,
      teamId,
      leaderId,
      memberIds
    } = req.body;

    const existingProject = await prisma.project.findUnique({
      where: { id },
      include: {
        members: { select: { userId: true } }
      }
    });

    if (!existingProject || existingProject.isDeleted) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    // Role check: Admin or assigned Project Leader can update
    const isLeader = existingProject.leaderId === req.user.id;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

    if (!isAdmin && !isLeader) {
      return res.status(403).json({ message: 'Only Admins or Project Leaders can update this project.' });
    }

    const oldStatus = existingProject.status;
    const newStatus = status || oldStatus;

    // Validate completion: Prevent setting status to COMPLETED if open tasks exist (unless forceComplete is set)
    if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED' && !req.body.forceComplete) {
      const openTasksCount = await prisma.task.count({
        where: {
          projectId: id,
          status: { notIn: ['COMPLETED', 'APPROVED'] }
        }
      });
      if (openTasksCount > 0) {
        return res.status(400).json({
          message: `This project contains ${openTasksCount} incomplete task(s). Complete or close all tasks before marking the project as completed.`
        });
      }
    }

    let actualStartDate = existingProject.actualStartDate;
    let actualEndDate = existingProject.actualEndDate;

    if (newStatus === 'ACTIVE' && !actualStartDate) {
      actualStartDate = new Date();
    }
    if (newStatus === 'COMPLETED' && !actualEndDate) {
      actualEndDate = new Date();
    }

    // Update Project
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existingProject.name,
        description: description !== undefined ? description : existingProject.description,
        type: type || existingProject.type,
        priority: priority || existingProject.priority,
        status: newStatus,
        estimatedStartDate: estimatedStartDate ? new Date(estimatedStartDate) : existingProject.estimatedStartDate,
        estimatedEndDate: estimatedEndDate ? new Date(estimatedEndDate) : existingProject.estimatedEndDate,
        actualStartDate,
        actualEndDate,
        teamId: teamId !== undefined ? (teamId || null) : existingProject.teamId,
        leaderId: leaderId !== undefined ? (leaderId || null) : existingProject.leaderId
      },
      include: {
        leader: { select: { id: true, name: true, email: true, role: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } }
        }
      }
    });

    // Handle Member Updates
    if (Array.isArray(memberIds)) {
      const existingUserIds = new Set(existingProject.members.map(m => m.userId));
      const targetLeaderId = leaderId !== undefined ? leaderId : existingProject.leaderId;
      
      const rawNewUserIds = [...memberIds];
      if (targetLeaderId && !rawNewUserIds.includes(targetLeaderId)) {
        rawNewUserIds.push(targetLeaderId);
      }
      const newUserIds = new Set(rawNewUserIds.filter(Boolean));

      const addedUserIds = Array.from(newUserIds).filter(uId => !existingUserIds.has(uId));
      const removedUserIds = Array.from(existingUserIds).filter(uId => !newUserIds.has(uId));

      // Orphan Task Protection: Check if any removed member has active tasks assigned in this project
      for (const uId of removedUserIds) {
        const activeTasksCount = await prisma.task.count({
          where: {
            projectId: id,
            assigneeId: uId,
            status: { notIn: ['COMPLETED', 'APPROVED'] }
          }
        });
        if (activeTasksCount > 0) {
          const userObj = await prisma.user.findUnique({ where: { id: uId }, select: { name: true } });
          const userName = userObj ? userObj.name : 'User';
          return res.status(400).json({
            message: `Cannot remove ${userName} because they have ${activeTasksCount} active task(s) assigned in this project. Please reassign or complete these tasks first.`
          });
        }
      }

      // Remove members
      if (removedUserIds.length > 0) {
        await prisma.projectMember.deleteMany({
          where: { projectId: id, userId: { in: removedUserIds } }
        });
        for (const uId of removedUserIds) {
          const uObj = await prisma.user.findUnique({ where: { id: uId }, select: { name: true } });
          await prisma.projectHistory.create({
            data: {
              projectId: id,
              changedById: req.user.id,
              action: 'MEMBER_REMOVED',
              detail: `${uObj?.name || 'User'} removed from project.`
            }
          });
        }
      }

      // Add new members
      if (addedUserIds.length > 0) {
        await prisma.projectMember.createMany({
          data: addedUserIds.map(userId => ({ projectId: id, userId })),
          skipDuplicates: true
        });

        // Determine team members for External Member audit details
        const projectTeamId = updatedProject.teamId;
        let teamUserIds = new Set();
        if (projectTeamId) {
          const teamMembersList = await prisma.teamMember.findMany({ where: { teamId: projectTeamId }, select: { userId: true } });
          teamUserIds = new Set(teamMembersList.map(tm => tm.userId));
        }

        for (const uId of addedUserIds) {
          const uObj = await prisma.user.findUnique({ where: { id: uId }, select: { name: true } });
          const isExternal = projectTeamId && !teamUserIds.has(uId);
          const detail = isExternal
            ? `${uObj?.name || 'User'} added as External Member to project.`
            : `${uObj?.name || 'User'} added to project.`;

          await prisma.projectHistory.create({
            data: {
              projectId: id,
              changedById: req.user.id,
              action: 'MEMBER_ADDED',
              detail
            }
          });

          if (uId !== req.user.id) {
            await createNotification({
              userId: uId,
              title: 'Added to Project',
              message: `You have been added to project "${updatedProject.name}" (${updatedProject.projectCode}).`,
              type: 'PROJECT_ASSIGNED'
            });
          }
        }
      }
    }

    // Audit Log for Status Transition
    if (oldStatus !== newStatus) {
      await prisma.projectHistory.create({
        data: {
          projectId: id,
          changedById: req.user.id,
          action: 'STATUS_CHANGE',
          oldStatus,
          newStatus,
          detail: `Project status changed from ${oldStatus} to ${newStatus}`
        }
      });

      // Send status change notification to project members
      const allMembers = await prisma.projectMember.findMany({
        where: { projectId: id },
        select: { userId: true }
      });
      for (const m of allMembers) {
        if (m.userId !== req.user.id) {
          await createNotification({
            userId: m.userId,
            title: 'Project Status Updated',
            message: `Project "${updatedProject.name}" (${updatedProject.projectCode}) status changed to ${newStatus}.`,
            type: 'PROJECT_STATUS_UPDATE'
          });
        }
      }
    }

    // Audit Log for End Date Extension
    if (estimatedEndDate && new Date(estimatedEndDate).getTime() !== new Date(existingProject.estimatedEndDate).getTime()) {
      await prisma.projectHistory.create({
        data: {
          projectId: id,
          changedById: req.user.id,
          action: 'EXTENDED',
          detail: `End date updated to ${new Date(estimatedEndDate).toLocaleDateString()}`
        }
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'PROJECT_UPDATE',
      details: `Updated project "${updatedProject.name}" (${updatedProject.projectCode})`
    });

    // Trigger Chat Room Sync
    await syncProjectLifecycleChatRoom(id);

    try { broadcastTeamPerformanceUpdate(); } catch (e) { /* non-critical */ }

    return res.status(200).json({
      message: `Project ${updatedProject.projectCode} updated successfully.`,
      project: updatedProject
    });
  } catch (error) {
    console.error('[updateProject Error]:', error);
    return res.status(500).json({ message: 'Failed to update project.', error: error.message });
  }
};

// 5. Delete (Soft-Delete) Project
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.isDeleted) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Admins can delete projects.' });
    }

    await prisma.project.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: req.user.id
      }
    });

    await prisma.projectHistory.create({
      data: {
        projectId: id,
        changedById: req.user.id,
        action: 'DELETED',
        detail: `Project "${project.name}" (${project.projectCode}) was soft deleted by Admin`
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'PROJECT_DELETE',
      details: `Soft deleted project "${project.name}" (${project.projectCode})`
    });

    // Archive Project Chat Room
    await syncProjectLifecycleChatRoom(id);

    try { broadcastTeamPerformanceUpdate(); } catch (e) { /* non-critical */ }

    return res.status(200).json({ message: `Project ${project.projectCode} deleted successfully.` });
  } catch (error) {
    console.error('[deleteProject Error]:', error);
    return res.status(500).json({ message: 'Failed to delete project.', error: error.message });
  }
};

// 6. Upload Project Document
const uploadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'No document file uploaded.' });
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.isDeleted) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    const fileUrl = `/uploads/attachments/${req.file.filename}`;
    const doc = await prisma.projectDocument.create({
      data: {
        projectId: id,
        uploaderId: req.user.id,
        name: req.file.originalname || req.file.filename,
        fileUrl,
        fileType: req.file.mimetype,
        fileSize: req.file.size
      },
      include: {
        uploader: { select: { id: true, name: true, role: true } }
      }
    });

    await prisma.projectHistory.create({
      data: {
        projectId: id,
        changedById: req.user.id,
        action: 'DOCUMENT_UPLOADED',
        detail: `Uploaded document "${doc.name}"`
      }
    });

    return res.status(201).json({ message: 'Document uploaded successfully.', document: doc });
  } catch (error) {
    console.error('[uploadDocument Error]:', error);
    return res.status(500).json({ message: 'Failed to upload document.', error: error.message });
  }
};

// 7. Delete Project Document
const deleteDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;

    const doc = await prisma.projectDocument.findFirst({
      where: { id: docId, projectId: id }
    });

    if (!doc) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    if (req.user.role !== 'ADMIN' && doc.uploaderId !== req.user.id) {
      return res.status(403).json({ message: 'Permission denied.' });
    }

    await prisma.projectDocument.delete({ where: { id: docId } });

    await prisma.projectHistory.create({
      data: {
        projectId: id,
        changedById: req.user.id,
        action: 'DOCUMENT_DELETED',
        detail: `Deleted document "${doc.name}"`
      }
    });

    return res.status(200).json({ message: 'Document deleted successfully.' });
  } catch (error) {
    console.error('[deleteDocument Error]:', error);
    return res.status(500).json({ message: 'Failed to delete document.', error: error.message });
  }
};

// Update Project Workflow Stages (Only ADMIN and SUPER_ADMIN)
const updateProjectWorkflowStages = async (req, res) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Administrators can modify project workflow stages.' });
    }

    const { id } = req.params;
    const { workflowStages } = req.body;

    const lastIndex = workflowStages.length - 1;
    const enforcedStages = workflowStages.map((stage, index) => ({
      ...stage,
      order: index,
      isCompletedStage: index === lastIndex,
      requiresApproval: index === lastIndex ? true : !!stage.requiresApproval,
    }));

    const stageValidation = validateWorkflowStages(enforcedStages);
    if (!stageValidation.valid) {
      return res.status(400).json({ message: stageValidation.message });
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.isDeleted) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    // Delete existing stages and replace with new validated set inside transaction
    await prisma.$transaction(async (tx) => {
      await tx.projectWorkflowStage.deleteMany({ where: { projectId: id } });
      await tx.projectWorkflowStage.createMany({
        data: enforcedStages.map((stage, idx) => ({
          projectId: id,
          name: stage.name.trim(),
          color: stage.color || '#6366F1',
          order: idx,
          requiresApproval: stage.requiresApproval,
          approverRole: stage.approverRole || null,
          approverId: stage.approverId || null,
          isCompletedStage: stage.isCompletedStage
        }))
      });
    });

    const updatedProject = await prisma.project.findUnique({
      where: { id },
      include: {
        workflowStages: { orderBy: { order: 'asc' } }
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Project workflow stages updated successfully.',
      workflowStages: updatedProject.workflowStages
    });
  } catch (error) {
    console.error('[updateProjectWorkflowStages Error]:', error);
    return res.status(500).json({ message: 'Failed to update workflow stages.', error: error.message });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  updateProjectWorkflowStages,
  deleteProject,
  uploadDocument,
  deleteDocument
};
