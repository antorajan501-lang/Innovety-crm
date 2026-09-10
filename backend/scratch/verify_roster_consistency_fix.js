const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testRosterConsistencyFix() {
  console.log('================================================================');
  console.log('  VERIFYING VIEWER-AGNOSTIC TEAM ROSTER PRESENT/ABSENT STATUS   ');
  console.log('================================================================\n');

  const jeffersonEmail = 'jeffersonsamuel003@gmail.com'; // Employee in team "Best"
  const tlEmail = 'somusuraj72@gmail.com';                 // Team Leader of team "Best"
  const antoEmail = 'antorajan501@gmail.com';             // Intern in team "Best"

  const loginJefferson = await axios.post(`${BASE_URL}/auth/login`, { userId: jeffersonEmail, password: 'password123' });
  const jeffersonToken = loginJefferson.data.token;
  const jeffersonId = loginJefferson.data.user.id;

  const loginTL = await axios.post(`${BASE_URL}/auth/login`, { userId: tlEmail, password: 'password123' });
  const tlToken = loginTL.data.token;

  const loginAnto = await axios.post(`${BASE_URL}/auth/login`, { userId: antoEmail, password: 'password123' });
  const antoToken = loginAnto.data.token;

  // 1. Clock in Jefferson
  try {
    await axios.post(`${BASE_URL}/attendance/clock-in`, {
      workLocation: 'OFFICE',
      latitude: 12.971598,
      longitude: 77.594562
    }, { headers: { Authorization: `Bearer ${jeffersonToken}` } });
    console.log('✓ Jefferson clocked in successfully.');
  } catch (err) {
    console.log('Clock in info:', err.response?.data?.message || err.message);
  }

  // Pure Calculation Function matching frontend implementation
  function computeMemberRosterStatus(members, logs, leaves) {
    const todayStr = new Date().toLocaleDateString('en-CA');

    const todayAttendanceMap = new Map();
    (logs || []).forEach((log) => {
      if (!log || !log.userId) return;
      const logDateStr = new Date(log.date).toLocaleDateString('en-CA');
      if (logDateStr === todayStr) {
        todayAttendanceMap.set(log.userId, log);
      }
    });

    const todayLeaveMap = new Map();
    (leaves || []).forEach((leave) => {
      if (!leave || !leave.userId || leave.status !== 'APPROVED') return;
      const startStr = new Date(leave.startDate).toLocaleDateString('en-CA');
      const endStr = new Date(leave.endDate || leave.startDate).toLocaleDateString('en-CA');
      if (todayStr >= startStr && todayStr <= endStr) {
        todayLeaveMap.set(leave.userId, leave);
      }
    });

    return members.map((member) => {
      const todayLog = todayAttendanceMap.get(member.id);
      const todayLeave = todayLeaveMap.get(member.id);

      let attStatus = 'ABSENT';
      if (todayLeave) {
        const lType = (todayLeave.type || todayLeave.leaveType || '').toUpperCase();
        attStatus = lType === 'WFH' ? 'WFH' : 'ON LEAVE';
      } else if (todayLog) {
        const hasClockIn = Boolean(todayLog.clockIn);
        const isPresentStatus = ['PRESENT', 'LATE', 'WORK_FROM_HOME', 'HALF_DAY'].includes((todayLog.status || '').toUpperCase());
        attStatus = (hasClockIn || isPresentStatus) ? 'PRESENT' : 'ABSENT';
      } else {
        attStatus = 'ABSENT';
      }

      return { name: member.name || member.user?.name, attStatus };
    });
  }

  const viewers = [
    { name: 'Jefferson (Employee)', token: jeffersonToken },
    { name: 'Suraj S (Team Leader)', token: tlToken },
    { name: 'Anto (Intern)', token: antoToken }
  ];

  const results = {};

  for (const v of viewers) {
    const headers = { Authorization: `Bearer ${v.token}` };
    const teamsRes = await axios.get(`${BASE_URL}/teams`, { headers });
    const logsRes = await axios.get(`${BASE_URL}/attendance/logs`, { headers });
    const leavesRes = await axios.get(`${BASE_URL}/leaves`, { headers });

    const team = teamsRes.data[0];
    const members = (team?.members || []).map(m => m.user || m);
    if (team?.leader && !members.some(m => m.id === team.leader.id)) {
      members.unshift(team.leader);
    }

    const computed = computeMemberRosterStatus(members, logsRes.data, leavesRes.data);
    results[v.name] = computed;
  }

  console.log('--- COMPUTED ROSTER STATUSES ACROSS VIEWERS ---');
  console.log(JSON.stringify(results, null, 2));

  const empView = JSON.stringify(results['Jefferson (Employee)']);
  const tlView = JSON.stringify(results['Suraj S (Team Leader)']);
  const internView = JSON.stringify(results['Anto (Intern)']);

  if (empView === tlView && tlView === internView) {
    console.log('\n✅ PASS: Team Roster statuses are 100% CONSISTENT across all viewers!');
  } else {
    console.log('\n❌ FAIL: Status discrepancy detected across viewers!');
  }
}

testRosterConsistencyFix();
