/**
 * Utility functions for calculating stage-based project workflow progress
 * and task completion counts consistently across the CRM application.
 */

export const isTaskDone = (task, project) => {
  if (!task) return false;
  if (task.status === 'COMPLETED' || task.status === 'APPROVED' || task.status === 'DONE') return true;

  const stages = project?.workflowStages || [];
  const stage = task.stage || stages.find(s => s.id === task.stageId);
  if (stage) {
    if (stage.isCompletedStage || (stage.name && (stage.name.toLowerCase() === 'done' || stage.name.toLowerCase() === 'completed'))) {
      if (stage.requiresApproval) {
        return task.reviewStatus === 'APPROVED' || task.status === 'COMPLETED' || task.status === 'APPROVED' || task.status === 'DONE';
      }
      return true;
    }
  }
  return false;
};

/**
 * Calculates completion percentage (0 to 100) for a single task based on its stage index in orderedStages.
 */
export function getTaskStageProgress(taskOrStatus, orderedStages) {
  if (!taskOrStatus || !orderedStages || !Array.isArray(orderedStages)) return 0;
  const totalStages = orderedStages.length;
  if (totalStages <= 1) return 0;

  const taskObj = typeof taskOrStatus === 'object' ? taskOrStatus : null;
  const taskStatus = (typeof taskOrStatus === 'string' ? taskOrStatus : (taskObj?.status || '')).toLowerCase();
  const taskStageId = taskObj?.stageId;

  let index = -1;

  // 1. Direct stageId match if stages are objects
  if (taskStageId) {
    index = orderedStages.findIndex(s => typeof s === 'object' && s !== null && s.id === taskStageId);
  }

  // 2. Direct string / stage name / key / statuses match
  if (index === -1) {
    index = orderedStages.findIndex(s => {
      if (typeof s === 'string') {
        return s.toLowerCase() === taskStatus;
      }
      if (typeof s === 'object' && s !== null) {
        if (s.name && s.name.toLowerCase() === taskStatus) return true;
        if (s.key && s.key.toLowerCase() === taskStatus) return true;
        if (s.id && s.id.toLowerCase() === taskStatus) return true;
        if (Array.isArray(s.statuses) && s.statuses.some(st => st.toLowerCase() === taskStatus)) return true;
        if (s.isCompletedStage && (taskStatus === 'completed' || taskStatus === 'approved' || taskStatus === 'done')) return true;
      }
      return false;
    });
  }

  // 3. Fallback standard CRM status mapping
  if (index === -1) {
    let normalized = taskStatus;
    if (['pending', 'rejected', 'todo', 'to do'].includes(taskStatus)) normalized = 'to do';
    else if (['in_progress', 'in progress', 'doing'].includes(taskStatus)) normalized = 'in progress';
    else if (['waiting_for_review', 'in_review', 'in review', 'review'].includes(taskStatus)) normalized = 'in review';
    else if (['approved', 'completed', 'done'].includes(taskStatus)) normalized = 'done';

    index = orderedStages.findIndex(s => {
      const stageName = (typeof s === 'string' ? s : s?.name || '').toLowerCase();
      if (stageName === normalized) return true;
      if (normalized === 'done' && (typeof s === 'object' && s?.isCompletedStage)) return true;
      return false;
    });
  }

  if (index === -1 || totalStages <= 1) return 0;

  return Math.round((index / (totalStages - 1)) * 100);
}

/**
 * Calculates overall project progress percentage as the average stage progress of all tasks.
 */
export function getProjectProgress(tasks, orderedStages) {
  const validTasks = Array.isArray(tasks) ? tasks : [];
  if (!validTasks.length) return 0;

  const total = validTasks.reduce(
    (sum, task) => sum + getTaskStageProgress(task, orderedStages),
    0
  );

  return Math.round(total / validTasks.length);
}

/**
 * Helper combining overall project stage-based completion % and task counters (completed/total).
 */
export const getProjectStageProgress = (project, tasks) => {
  const projTasks = Array.isArray(tasks) ? tasks : (project?.tasks || []);
  const totalTasks = projTasks.length;
  const completedTasks = projTasks.filter(t => isTaskDone(t, project)).length;

  if (totalTasks === 0) {
    return {
      progressPct: 0,
      completedTasks: 0,
      totalTasks: 0,
      tasksText: '0/0'
    };
  }

  const defaultStages = [
    { id: 'todo', name: 'To Do', statuses: ['PENDING', 'REJECTED'] },
    { id: 'in_progress', name: 'In Progress', statuses: ['IN_PROGRESS'] },
    { id: 'in_review', name: 'In Review', statuses: ['WAITING_FOR_REVIEW'] },
    { id: 'done', name: 'Done', isCompletedStage: true, statuses: ['APPROVED', 'COMPLETED', 'DONE'] }
  ];

  const orderedStages = (project?.workflowStages && project.workflowStages.length > 0)
    ? project.workflowStages
    : defaultStages;

  const progressPct = getProjectProgress(projTasks, orderedStages);

  return {
    progressPct,
    completedTasks,
    totalTasks,
    tasksText: `${completedTasks}/${totalTasks}`
  };
};
