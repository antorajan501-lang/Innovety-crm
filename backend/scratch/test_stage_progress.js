const isTaskDone = (task, project) => {
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

const getProjectStageProgress = (project, tasks) => {
  const projTasks = Array.isArray(tasks) ? tasks : (project?.tasks || []);
  const totalTasks = projTasks.length;
  
  const completedTasks = projTasks.filter(t => isTaskDone(t, project)).length;

  if (totalTasks === 0) {
    return {
      progressPct: 0,
      completedTasks: 0,
      totalTasks: 0,
      tasksText: '0/0',
      highestStageIndex: 0
    };
  }

  const stages = (project?.workflowStages && project.workflowStages.length > 0)
    ? project.workflowStages
    : [
        { id: 'todo', name: 'To Do', key: 'TO_DO', statuses: ['PENDING', 'REJECTED', 'TO_DO'] },
        { id: 'in_progress', name: 'In Progress', key: 'IN_PROGRESS', statuses: ['IN_PROGRESS'] },
        { id: 'in_review', name: 'In Review', key: 'IN_REVIEW', statuses: ['WAITING_FOR_REVIEW', 'IN_REVIEW', 'REVIEW'] },
        { id: 'done', name: 'Done', key: 'DONE', isCompletedStage: true, statuses: ['APPROVED', 'COMPLETED', 'DONE'] }
      ];

  const totalStages = stages.length;
  if (totalStages <= 1) {
    return {
      progressPct: 0,
      completedTasks,
      totalTasks,
      tasksText: `${completedTasks}/${totalTasks}`,
      highestStageIndex: 0
    };
  }

  let highestStageIndex = 0;
  let hasTaskInAnyStage = false;

  stages.forEach((stage, index) => {
    const hasTaskInStage = projTasks.some(task => {
      if (task.stageId && stage.id && stage.id !== 'todo' && stage.id !== 'in_progress' && stage.id !== 'in_review' && stage.id !== 'done') {
        return task.stageId === stage.id;
      }
      if (stage.statuses && stage.statuses.includes(task.status)) {
        return true;
      }
      if (stage.isCompletedStage || (stage.name && (stage.name.toLowerCase() === 'done' || stage.name.toLowerCase() === 'completed'))) {
        return task.status === 'COMPLETED' || task.status === 'APPROVED' || task.status === 'DONE';
      }
      if (stage.key && (task.status === stage.key || task.status === stage.name)) {
        return true;
      }
      return false;
    });

    if (hasTaskInStage) {
      hasTaskInAnyStage = true;
      highestStageIndex = Math.max(highestStageIndex, index);
    }
  });

  if (!hasTaskInAnyStage) {
    return {
      progressPct: 0,
      completedTasks,
      totalTasks,
      tasksText: `${completedTasks}/${totalTasks}`,
      highestStageIndex: 0
    };
  }

  const progressPct = Math.round((highestStageIndex / (totalStages - 1)) * 100);

  return {
    progressPct,
    completedTasks,
    totalTasks,
    tasksText: `${completedTasks}/${totalTasks}`,
    highestStageIndex
  };
};

function runValidationChecklist() {
  console.log('========================================================');
  console.log('🚀 RUNNING VALIDATION CHECKLIST FOR PROJECT PROGRESS & TASK COMPLETION');
  console.log('========================================================\n');

  let allPassed = true;

  // TEST 1
  const test1Proj = { workflowStages: null };
  const test1Tasks = [{ status: 'WAITING_FOR_REVIEW' }];
  const res1 = getProjectStageProgress(test1Proj, test1Tasks);
  const pass1 = res1.progressPct === 67 && res1.tasksText === '0/1';
  console.log(`[Test 1] Workflow 4-stages, tasks in REVIEW: Progress=${res1.progressPct}%, Tasks=${res1.tasksText} -> ${pass1 ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!pass1) allPassed = false;

  // TEST 2
  const test2Proj = { workflowStages: null };
  const test2Tasks = [{ status: 'DONE' }];
  const res2 = getProjectStageProgress(test2Proj, test2Tasks);
  const pass2 = res2.progressPct === 100 && res2.tasksText === '1/1';
  console.log(`[Test 2] Tasks in DONE only: Progress=${res2.progressPct}%, Tasks=${res2.tasksText} -> ${pass2 ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!pass2) allPassed = false;

  // TEST 3
  const test3Proj = { workflowStages: null };
  const test3Tasks = [{ status: 'PENDING' }, { status: 'IN_PROGRESS' }];
  const res3 = getProjectStageProgress(test3Proj, test3Tasks);
  const pass3 = res3.progressPct === 33 && res3.tasksText === '0/2';
  console.log(`[Test 3] Tasks in TO DO and IN PROGRESS: Progress=${res3.progressPct}%, Tasks=${res3.tasksText} -> ${pass3 ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!pass3) allPassed = false;

  // TEST 4
  const test4Proj = {
    workflowStages: [
      { id: 's0', name: 'TO DO', key: 'TO_DO' },
      { id: 's1', name: 'IN PROGRESS', key: 'IN_PROGRESS' },
      { id: 's2', name: 'STAGE 1', key: 'STAGE_1' },
      { id: 's3', name: 'REVIEW', key: 'REVIEW' },
      { id: 's4', name: 'DONE', key: 'DONE', isCompletedStage: true }
    ]
  };
  const test4Tasks = [{ stageId: 's2', status: 'STAGE_1' }];
  const res4 = getProjectStageProgress(test4Proj, test4Tasks);
  const pass4 = res4.progressPct === 50;
  console.log(`[Test 4] 5-stage workflow with tasks in STAGE 1 (index 2): Progress=${res4.progressPct}% -> ${pass4 ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!pass4) allPassed = false;

  // TEST 5
  const test5Proj = { workflowStages: null };
  const test5Tasks = [];
  const res5 = getProjectStageProgress(test5Proj, test5Tasks);
  const pass5 = res5.progressPct === 0 && res5.tasksText === '0/0';
  console.log(`[Test 5] No tasks: Progress=${res5.progressPct}%, Tasks=${res5.tasksText} -> ${pass5 ? 'PASS ✅' : 'FAIL ❌'}`);
  if (!pass5) allPassed = false;

  console.log('\n========================================================');
  if (allPassed) {
    console.log('🎉 ALL ACCEPTANCE CRITERIA & VALIDATION TESTS PASSED 100%!');
  } else {
    console.error('❌ SOME TESTS FAILED');
  }
  console.log('========================================================');
}

runValidationChecklist();
