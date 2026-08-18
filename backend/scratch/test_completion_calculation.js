const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

const calculateProjectCompletion = (tasks, stages = []) => {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => isTaskDoneBackend(t, stages)).length;
  const completionPercentage = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  return {
    completionPercentage,
    doneTasks,
    totalTasks,
    text: `${completionPercentage}% (${doneTasks}/${totalTasks})`
  };
};

function runTestCases() {
  console.log('--- TESTING BOARD COMPLETION PERCENTAGE CALCULATION ---');

  const testCases = [
    {
      name: '1 To Do, 1 In Progress, 1 In Review, 1 Done',
      tasks: [
        { status: 'PENDING' },
        { status: 'IN_PROGRESS' },
        { status: 'WAITING_FOR_REVIEW' },
        { status: 'APPROVED' }
      ],
      expectedText: '25% (1/4)',
      expectedPct: 25
    },
    {
      name: '2 To Do, 1 In Progress, 0 In Review, 1 Done',
      tasks: [
        { status: 'PENDING' },
        { status: 'PENDING' },
        { status: 'IN_PROGRESS' },
        { status: 'COMPLETED' }
      ],
      expectedText: '25% (1/4)',
      expectedPct: 25
    },
    {
      name: '0 To Do, 1 In Progress, 1 In Review, 2 Done',
      tasks: [
        { status: 'IN_PROGRESS' },
        { status: 'WAITING_FOR_REVIEW' },
        { status: 'APPROVED' },
        { status: 'COMPLETED' }
      ],
      expectedText: '50% (2/4)',
      expectedPct: 50
    },
    {
      name: '0 To Do, 0 In Progress, 0 In Review, 3 Done',
      tasks: [
        { status: 'APPROVED' },
        { status: 'COMPLETED' },
        { status: 'APPROVED' }
      ],
      expectedText: '100% (3/3)',
      expectedPct: 100
    },
    {
      name: '0 To Do, 0 In Progress, 0 In Review, 0 Done',
      tasks: [],
      expectedText: '0% (0/0)',
      expectedPct: 0
    }
  ];

  let passed = true;

  testCases.forEach((tc, idx) => {
    const res = calculateProjectCompletion(tc.tasks);
    const isPass = res.completionPercentage === tc.expectedPct && res.text === tc.expectedText;
    console.log(`[Test ${idx + 1}] ${tc.name}: Calculated = "${res.text}", Expected = "${tc.expectedText}" -> ${isPass ? 'PASS ✅' : 'FAIL ❌'}`);
    if (!isPass) passed = false;
  });

  // Dynamic Movement Test Case:
  console.log('\n--- TESTING DYNAMIC RECALCULATION ON STAGE MOVE ---');
  let dynamicTasks = [
    { id: 1, status: 'PENDING' },
    { id: 2, status: 'IN_PROGRESS' },
    { id: 3, status: 'WAITING_FOR_REVIEW' }
  ];

  let step1 = calculateProjectCompletion(dynamicTasks);
  console.log(`Initial Stage (3 tasks, 0 done): ${step1.text}`); // 0% (0/3)

  // Move task 1 to DONE
  dynamicTasks[0].status = 'APPROVED';
  let step2 = calculateProjectCompletion(dynamicTasks);
  console.log(`Task 1 moved to DONE: ${step2.text}`); // 33% (1/3)

  // Move task 2 to DONE
  dynamicTasks[1].status = 'COMPLETED';
  let step3 = calculateProjectCompletion(dynamicTasks);
  console.log(`Task 2 moved to DONE: ${step3.text}`); // 67% (2/3)

  // Move task 3 to DONE
  dynamicTasks[2].status = 'APPROVED';
  let step4 = calculateProjectCompletion(dynamicTasks);
  console.log(`Task 3 moved to DONE: ${step4.text}`); // 100% (3/3)

  if (passed && step1.text === '0% (0/3)' && step2.text === '33% (1/3)' && step3.text === '67% (2/3)' && step4.text === '100% (3/3)') {
    console.log('\n======================================================');
    console.log('🎉 ALL COMPLETION CALCULATION TESTS PASSED 100%!');
    console.log('======================================================');
  } else {
    console.error('Test execution failed.');
  }
}

runTestCases();
