const prisma = require('../utils/db');

/**
 * Service to manage internal lightweight task assignment:
 * Title, description, due date, priority, status, assignee, and comments.
 */

const createInternalTask = async ({
  organizationId,
  title,
  description,
  priority = 'MEDIUM',
  deadline,
  assigneeId,
  creatorId
}) => {
  if (!title || !deadline || !creatorId) {
    throw new Error('Title, deadline, and creator are required.');
  }

  const task = await prisma.task.create({
    data: {
      organizationId,
      title: title.trim(),
      description: description ? description.trim() : '',
      priority: priority || 'MEDIUM',
      status: 'PENDING',
      deadline: new Date(deadline),
      assigneeId: assigneeId || null,
      creatorId,
      type: 'TASK'
    },
    include: {
      assignee: {
        select: { id: true, name: true, employeeId: true, department: true, email: true, profilePic: true }
      },
      creator: {
        select: { id: true, name: true, employeeId: true }
      },
      comments: true
    }
  });

  return task;
};

const getInternalTasks = async ({
  organizationId,
  assigneeId,
  status,
  priority,
  search
}) => {
  const where = {};
  if (organizationId) where.organizationId = organizationId;
  if (assigneeId) where.assigneeId = assigneeId;
  if (status && status !== 'ALL') where.status = status;
  if (priority && priority !== 'ALL') where.priority = priority;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { assignee: { name: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { deadline: 'asc' },
    include: {
      assignee: {
        select: { id: true, name: true, employeeId: true, department: true, profilePic: true }
      },
      creator: {
        select: { id: true, name: true }
      },
      _count: {
        select: { comments: true }
      }
    }
  });

  return tasks.map((t) => ({
    ...t,
    commentCount: t._count?.comments || 0
  }));
};

const getInternalTaskById = async (taskId, organizationId) => {
  const where = { id: taskId };
  if (organizationId) where.organizationId = organizationId;

  const task = await prisma.task.findFirst({
    where,
    include: {
      assignee: {
        select: { id: true, name: true, employeeId: true, department: true, email: true, profilePic: true }
      },
      creator: {
        select: { id: true, name: true, employeeId: true }
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: { id: true, name: true, employeeId: true, profilePic: true }
          }
        }
      }
    }
  });

  if (!task) {
    throw new Error('Task not found.');
  }

  return task;
};

const updateInternalTaskStatus = async ({ taskId, organizationId, status, actorId }) => {
  const where = { id: taskId };
  if (organizationId) where.organizationId = organizationId;

  const task = await prisma.task.findFirst({ where });
  if (!task) {
    throw new Error('Task not found.');
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status
    },
    include: {
      assignee: { select: { id: true, name: true } }
    }
  });

  return updated;
};

const addInternalTaskComment = async ({ taskId, organizationId, userId, text }) => {
  if (!text || !text.trim()) {
    throw new Error('Comment text is required.');
  }

  const where = { id: taskId };
  if (organizationId) where.organizationId = organizationId;

  const task = await prisma.task.findFirst({ where });
  if (!task) {
    throw new Error('Task not found.');
  }

  const comment = await prisma.comment.create({
    data: {
      taskId,
      userId,
      text: text.trim()
    },
    include: {
      user: {
        select: { id: true, name: true, employeeId: true, profilePic: true }
      }
    }
  });

  return comment;
};

const deleteInternalTask = async (taskId, organizationId) => {
  const where = { id: taskId };
  if (organizationId) where.organizationId = organizationId;

  const task = await prisma.task.findFirst({ where });
  if (!task) {
    throw new Error('Task not found.');
  }

  await prisma.task.delete({ where: { id: taskId } });
  return { success: true, message: 'Task deleted successfully.' };
};

module.exports = {
  createInternalTask,
  getInternalTasks,
  getInternalTaskById,
  updateInternalTaskStatus,
  addInternalTaskComment,
  deleteInternalTask
};
