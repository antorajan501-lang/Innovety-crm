import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import {
  Users,
  Briefcase,
  Clock,
  AlertCircle,
  CheckCircle,
  Activity,
  ArrowUpRight,
  TrendingUp,
  MapPin,
  Play,
  Square,
  PlusCircle,
  Calendar,
  FileText,
  User as UserIcon,
  UserCheck,
  Award
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

const Dashboard = () => {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();

  const [stats, setStats] = useState({
    totalMembers: 0,
    totalInterns: 0,
    totalLeaders: 0,
    totalTeams: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    halfDayToday: 0,
    pendingTasks: 0,
    completedTasks: 0,
    openTickets: 0,
    closedTickets: 0,
    attendanceRate: 85
  });

  const [activities, setActivities] = useState([]);
  const [teamPerformances, setTeamPerformances] = useState([]);
  const [taskChartData, setTaskChartData] = useState([]);
  const [burndownChartData, setBurndownChartData] = useState([]);
  const [sprintStats, setSprintStats] = useState({ totalPoints: 0, completedPoints: 0, pendingPoints: 0 });
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Intern Clock-in/out Dashboard Widget state
  const [time, setTime] = useState(new Date());
  const [clockedRecord, setClockedRecord] = useState(null);
  const [attendanceAlert, setAttendanceAlert] = useState('');
  const [clockLoading, setClockLoading] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch dashboard components in parallel
        const promises = [
          api.get('/tasks'),
          api.get('/tickets')
        ];

        if (user.role === 'ADMIN') {
          promises.push(api.get('/attendance/analytics'));
          promises.push(api.get('/teams'));
          promises.push(api.get('/users?limit=1000'));
          promises.push(api.get('/logs?limit=8'));
        }

        const results = await Promise.all(promises.map(p => p.catch(e => ({ error: true, data: null }))));

        const tasksData = results[0].data || [];
        setAllTasks(tasksData);
        const ticketsData = results[1].data || [];

        let newStats = { ...stats };
        
        // Tasks Stats
        const pending = tasksData.filter(t => ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_REVIEW'].includes(t.status)).length;
        const completed = tasksData.filter(t => t.status === 'APPROVED').length;
        newStats.pendingTasks = pending;
        newStats.completedTasks = completed;

        // Tickets Stats
        const openT = ticketsData.filter(t => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length;
        const closedT = ticketsData.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
        newStats.openTickets = openT;
        newStats.closedTickets = closedT;

        if (user.role === 'ADMIN') {
          const attendanceData = results[2].data || {};
          const teamsData = results[3].data || [];
          const usersData = results[4].data?.users || [];
          const logsData = results[5].data?.logs || [];

          newStats.totalMembers = usersData.filter(u => u.role === 'INTERN' || u.role === 'EMPLOYEE').length;
          newStats.totalInterns = newStats.totalMembers;
          newStats.totalLeaders = usersData.filter(u => u.role === 'TEAM_LEADER').length;
          newStats.totalTeams = teamsData.length;
          newStats.presentToday = attendanceData.presentToday || 0;
          newStats.absentToday = attendanceData.absentToday || 0;
          newStats.lateToday = attendanceData.lateToday || 0;
          newStats.halfDayToday = attendanceData.halfDayToday || 0;

          // Attendance rate calculation
          const totalActiveMembers = newStats.totalMembers;
          if (totalActiveMembers > 0) {
            const attending = newStats.presentToday + newStats.lateToday + newStats.halfDayToday;
            newStats.attendanceRate = Math.round((attending / totalActiveMembers) * 100);
          }

          setActivities(logsData);
          setTeamPerformances(teamsData.map(t => ({
            name: t.name,
            performance: t.performance || 0,
            active: t.activeTasks || 0,
            completed: t.completedTasks || 0
          })));

          // Chart data for tasks distribution
          setTaskChartData([
            { name: 'Pending', value: tasksData.filter(t => t.status === 'PENDING').length },
            { name: 'In Progress', value: tasksData.filter(t => t.status === 'IN_PROGRESS').length },
            { name: 'Review', value: tasksData.filter(t => t.status === 'WAITING_FOR_REVIEW').length },
            { name: 'Approved', value: tasksData.filter(t => t.status === 'APPROVED').length },
            { name: 'Rejected', value: tasksData.filter(t => t.status === 'REJECTED').length }
          ]);

          // Sprint Burndown Curve Calculation
          const totalPoints = tasksData.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
          const completedPoints = tasksData.filter(t => t.status === 'APPROVED').reduce((acc, t) => acc + (t.storyPoints || 0), 0);
          setSprintStats({
            totalPoints,
            completedPoints,
            pendingPoints: totalPoints - completedPoints
          });

          const burndown = [];
          const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8', 'Day 9', 'Day 10'];
          days.forEach((day, idx) => {
            const ideal = Math.max(0, Math.round(totalPoints - (totalPoints / (days.length - 1)) * idx));
            let actual = totalPoints;
            if (idx > 0) {
              const step = completedPoints / (days.length - 1);
              actual = Math.max(totalPoints - completedPoints, Math.round(totalPoints - step * idx));
            }
            if (idx === days.length - 1) {
              actual = totalPoints - completedPoints;
            }
            burndown.push({
              name: day,
              Ideal: ideal,
              Remaining: actual
            });
          });
          setBurndownChartData(burndown);
        } else {
          // Fallback simple task distribution for leaders/interns
          setTaskChartData([
            { name: 'Open Tasks', value: pending },
            { name: 'Completed', value: completed }
          ]);
        }

        setStats(newStats);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  // Handle ticking timer and clock status fetches for Interns, Employees and Team Leaders
  useEffect(() => {
    if (user && (user.role === 'INTERN' || user.role === 'EMPLOYEE' || user.role === 'TEAM_LEADER')) {
      const timer = setInterval(() => setTime(new Date()), 1000);
      
      const fetchTodayAttendance = async () => {
        try {
          const res = await api.get('/attendance/logs');
          const localDateStr = new Date().toLocaleDateString('en-CA');
          const todayRecord = res.data.find(log => {
            const logDateStr = new Date(log.date).toLocaleDateString('en-CA');
            return logDateStr === localDateStr;
          });
          setClockedRecord(todayRecord || null);
        } catch (err) {
          console.error('Failed to fetch today attendance on dashboard:', err);
        }
      };
      
      fetchTodayAttendance();
      return () => clearInterval(timer);
    }
  }, [user]);

  const getCoordinates = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve('Geolocation not supported');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lon = position.coords.longitude.toFixed(6);
          resolve(`Lat: ${lat}, Lon: ${lon}`);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          resolve('Location denied/unavailable');
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  const handleClockIn = async () => {
    try {
      setClockLoading(true);
      setAttendanceAlert('');
      const location = await getCoordinates();
      const res = await api.post('/attendance/clock-in', { location });
      setClockedRecord(res.data);
      setAttendanceAlert(`Successfully clocked in. Location: ${location}`);
      setClockLoading(false);
    } catch (err) {
      setAttendanceAlert(err.response?.data?.message || 'Clock in failed.');
      setClockLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setClockLoading(true);
      setAttendanceAlert('');
      const location = await getCoordinates();
      const res = await api.post('/attendance/clock-out', { location });
      setClockedRecord(res.data);
      setAttendanceAlert(`Successfully clocked out. Location: ${location}`);
      setClockLoading(false);
    } catch (err) {
      setAttendanceAlert(err.response?.data?.message || 'Clock out failed.');
      setClockLoading(false);
    }
  };

  const COLORS = ['#0F5A46', '#17A673', '#10B981', '#F59E0B', '#EF4444'];

  const adminStatsWidgets = [
    { label: 'Total Members', value: stats.totalMembers || stats.totalInterns, icon: Users, color: 'text-[#0F5A46] bg-[#0F5A46]/10' },
    { label: 'Team Leaders', value: stats.totalLeaders, icon: Briefcase, color: 'text-[#17A673] bg-[#17A673]/10' },
    { label: 'Active Teams', value: stats.totalTeams, icon: Briefcase, color: 'text-[#1F3A36] bg-[#1F3A36]/10' },
    { label: 'Present Today', value: stats.presentToday, icon: UserCheck, color: 'text-emerald-600 bg-emerald-600/10' },
    { label: 'Late Clock-Ins', value: stats.lateToday, icon: Clock, color: 'text-amber-600 bg-amber-600/10' },
    { label: 'Open Tickets', value: stats.openTickets, icon: AlertCircle, color: 'text-rose-600 bg-rose-600/10' }
  ];

  const internStatsWidgets = [
    { label: 'My Open Tasks', value: stats.pendingTasks, icon: Briefcase, color: 'text-[#0F5A46] bg-[#0F5A46]/10' },
    { label: 'Completed Tasks', value: stats.completedTasks, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-600/10' },
    { label: 'My Open Tickets', value: stats.openTickets, icon: AlertCircle, color: 'text-rose-600 bg-rose-600/10' },
    { label: 'Attendance Rate', value: `${stats.attendanceRate}%`, icon: Clock, color: 'text-amber-600 bg-amber-600/10' }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-28 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="skeleton h-80 lg:col-span-2" />
          <div className="skeleton h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Welcome Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#0F5A46]/10 to-[#17A673]/10 border border-primary/10 p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-left">
        <div>
          <h2 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight">Welcome back, {user?.name}!</h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {user.role === 'ADMIN' && 'Access real-time system presence, geofenced records, and task metrics.'}
            {user.role === 'TEAM_LEADER' && 'Review active workspaces sprint velocities, pending requests, and project branches.'}
            {(user.role === 'INTERN' || user.role === 'EMPLOYEE') && 'Check assigned cards, branch allocations, and submit clock-in logs.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-600 px-3 py-1.5 rounded-full font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Active Session</span>
          </span>
        </div>
      </div>

      {/* Attendance Clock-in/out Quick Portal */}
      {user && (user.role === 'INTERN' || user.role === 'EMPLOYEE' || user.role === 'TEAM_LEADER') && (
        <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-premium text-left space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Attendance Clock Portal</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Clock your daily shift hours. Ensures geolocation validations are processed.</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xl font-bold font-mono">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-xs text-muted-foreground block font-semibold mt-0.5">
                {time.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>

          {clockedRecord && clockedRecord.status === 'LATE' && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 animate-bounce" />
              <span>Late Clock-In Notice: You clocked in past shift start time (09:30 AM). Your attendance today is marked as <strong>LATE</strong>.</span>
            </div>
          )}

          {attendanceAlert && (
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              attendanceAlert.includes('failed') || attendanceAlert.includes('Outside') || attendanceAlert.includes('coordinates') || attendanceAlert.includes('denied')
                ? 'border-red-500/20 bg-red-500/5 text-red-500' 
                : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
            }`}>
              <span>{attendanceAlert}</span>
              <button onClick={() => setAttendanceAlert('')} className="font-bold ml-2">✕</button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/30 pt-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Today's Status</span>
              <div className="flex items-center gap-2">
                {!clockedRecord ? (
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full font-extrabold text-muted-foreground">Not Checked In</span>
                ) : clockedRecord.clockOut ? (
                  <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-extrabold">Shift Completed</span>
                ) : (
                  <span className="text-xs bg-blue-500/10 text-blue-600 px-2.5 py-0.5 rounded-full font-extrabold">Checked In / Active</span>
                )}
              </div>
            </div>

            {clockedRecord && (
              <div className="flex gap-6">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Clock In</span>
                  <span className="text-xs font-semibold font-mono">
                    {new Date(clockedRecord.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {clockedRecord.clockOut && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Clock Out</span>
                    <span className="text-xs font-semibold font-mono">
                      {new Date(clockedRecord.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              {!clockedRecord ? (
                <button
                  onClick={handleClockIn}
                  disabled={clockLoading}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Clock In</span>
                </button>
              ) : !clockedRecord.clockOut ? (
                <button
                  onClick={handleClockOut}
                  disabled={clockLoading}
                  className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span>Clock Out</span>
                </button>
              ) : (
                <div className="text-xs text-muted-foreground font-bold flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border p-2.5 rounded-xl">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span>Attendance Logged</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Numeric Statistics widgets grids */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {(user.role === 'ADMIN' ? adminStatsWidgets : internStatsWidgets).map((widget, i) => {
          const Icon = widget.icon;
          return (
            <div key={i} className="rounded-2xl border border-border/40 bg-card p-5 shadow-premium hover-premium text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{widget.label}</span>
                <div className={`rounded-xl p-2.5 ${widget.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-[26px] font-extrabold tracking-tight leading-none">{widget.value}</p>
            </div>
          );
        })}
      </div>

      {/* Dynamic Graph Analytics panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recharts allocations chart area */}
        <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-premium lg:col-span-2 space-y-6 text-left">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Task Allocations Analysis</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Overall distribution of sprint issues across project columns.</p>
            <div className="h-64 w-full mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border), 0.3)" />
                  <XAxis dataKey="name" stroke="rgb(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis stroke="rgb(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgb(var(--card))', border: '1px solid rgba(var(--border), 0.5)' }} 
                    labelStyle={{ color: 'rgb(var(--foreground))', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="value" fill="#2563EB" radius={[8, 8, 0, 0]}>
                    {taskChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Admin sprint details and burndown curve chart */}
          {user.role === 'ADMIN' && burndownChartData.length > 0 && (
            <div className="border-t border-border/20 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Active Sprint Burndown</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Ideal vs. remaining velocity progression metrics.</p>
                </div>
                <span className="text-[10px] bg-blue-500/10 text-blue-600 px-3 py-1 rounded font-mono font-bold">
                  {sprintStats.totalPoints} SP Total
                </span>
              </div>
              <div className="h-56 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={burndownChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border), 0.3)" />
                    <XAxis dataKey="name" stroke="rgb(var(--muted-foreground))" fontSize={10} tickLine={false} />
                    <YAxis stroke="rgb(var(--muted-foreground))" fontSize={10} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgb(var(--card))', border: '1px solid rgba(var(--border), 0.5)' }} 
                      labelStyle={{ color: 'rgb(var(--foreground))', fontWeight: 'bold' }}
                    />
                    <Line type="monotone" dataKey="Ideal" stroke="#a78bfa" strokeDasharray="5 5" strokeWidth={2} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Remaining" stroke="#2563EB" strokeWidth={3} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar details (1/3 width right column) */}
        <div className="space-y-6 text-left">
          
          {/* Quick Actions Panel */}
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-premium space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick CRM Actions</h3>
            <div className="grid grid-cols-1 gap-2.5">
              {(user.role === 'INTERN' || user.role === 'EMPLOYEE') && (
                <>
                  <Link to="/attendance" className="flex items-center gap-3 bg-muted/50 hover:bg-muted border border-border/40 p-3 rounded-xl transition-all">
                    <Clock className="h-4.5 w-4.5 text-[#0F5A46]" />
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Apply Leave / WFH</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Submit leave dates for approval.</p>
                    </div>
                  </Link>
                  <Link to="/tickets" className="flex items-center gap-3 bg-muted/50 hover:bg-muted border border-border/40 p-3 rounded-xl transition-all">
                    <AlertCircle className="h-4.5 w-4.5 text-rose-600" />
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Create Support Ticket</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Request hardware or query access.</p>
                    </div>
                  </Link>
                </>
              )}
              {user.role === 'ADMIN' && (
                <>
                  <Link to="/interns" className="flex items-center gap-3 bg-muted/50 hover:bg-muted border border-border/40 p-3 rounded-xl transition-all">
                    <Users className="h-4.5 w-4.5 text-[#0F5A46]" />
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Register New Intern</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Add details & credentials.</p>
                    </div>
                  </Link>
                  <Link to="/teams" className="flex items-center gap-3 bg-muted/50 hover:bg-muted border border-border/40 p-3 rounded-xl transition-all">
                    <Briefcase className="h-4.5 w-4.5 text-emerald-600" />
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Create Project Team</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Map developers & leaders.</p>
                    </div>
                  </Link>
                </>
              )}
              <Link to="/profile" className="flex items-center gap-3 bg-muted/50 hover:bg-muted border border-border/40 p-3 rounded-xl transition-all">
                <UserIcon className="h-4.5 w-4.5 text-[#17A673]" />
                <div>
                  <h4 className="text-xs font-bold text-foreground">Change Password</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Update authentication parameters.</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Leave Balance widget */}
          {(user.role === 'INTERN' || user.role === 'EMPLOYEE') && (
            <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-premium text-left space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My Leave Balances</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/40 p-3.5 rounded-xl border">
                  <span className="text-[10px] font-bold text-muted-foreground block">CASUAL LEAVES</span>
                  <span className="text-[20px] font-extrabold text-foreground mt-1 block">12 Days</span>
                </div>
                <div className="bg-muted/40 p-3.5 rounded-xl border">
                  <span className="text-[10px] font-bold text-muted-foreground block">WFH ALLOCATION</span>
                  <span className="text-[20px] font-extrabold text-foreground mt-1 block">8 Days</span>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Meetings timeline card */}
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-premium text-left space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-bold">Upcoming Work Events</h3>
            <div className="space-y-3">
              {[
                { time: 'Today, 03:00 PM', desc: 'Sprint retro retrospective', type: 'Sprint Retro' },
                { time: 'Mon, 10:00 AM', desc: 'Daily Scrum standup meeting', type: 'Scrum Standup' }
              ].map((ev, idx) => (
                <div key={idx} className="flex flex-col gap-1 border-b border-border/20 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-[#0F5A46]/10 text-[#0F5A46] px-2 py-0.5 rounded font-extrabold uppercase shrink-0">{ev.type}</span>
                    <span className="text-[10px] text-muted-foreground font-mono font-semibold">{ev.time}</span>
                  </div>
                  <p className="text-xs text-foreground font-semibold mt-1">{ev.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Presence check */}
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-premium text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Workspace Presence</h3>
            <div className="space-y-3 overflow-y-auto max-h-56 pr-2">
              {onlineUsers.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-8">No online users</p>
              ) : (
                onlineUsers.slice(0, 5).map((onlineUser) => (
                  <div key={onlineUser.id || onlineUser} className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-8 w-8 rounded-lg bg-[#17A673]/10 text-[#17A673] flex items-center justify-center font-bold text-xs uppercase">
                        {(onlineUser.name || 'U').substring(0, 2)}
                      </div>
                      <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-success ring-2 ring-card" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{onlineUser.name || `User #${(onlineUser.id || onlineUser).substring(0, 5)}`}</p>
                      <span className="text-[9px] text-muted-foreground capitalize">
                        {(onlineUser.role || 'Member').toLowerCase().replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Admin specific activity timeline & team ranking distribution */}
      {user.role === 'ADMIN' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Audit Logs / System Activity */}
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-premium text-left">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Recent System Activities</h3>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {activities.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10">No activities recorded yet.</p>
              ) : (
                activities.map((log) => (
                  <div key={log.id} className="flex gap-3 items-start border-l-2 border-primary/20 pl-3 ml-1">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-foreground">
                        {log.user?.name} <span className="font-mono text-[10px] text-muted-foreground font-normal">({log.user?.employeeId})</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{log.details}</p>
                      <span className="text-[9px] text-muted-foreground/60">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <span className="text-[9px] font-bold bg-primary/10 text-primary-hover px-2 py-0.5 rounded-full uppercase shrink-0">
                      {log.action}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Team performance rankings card */}
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-premium text-left">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Team Performance Rankings</h3>
              <Award className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-4">
              {teamPerformances.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10">No team rankings available.</p>
              ) : (
                teamPerformances.map((team, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{team.name}</span>
                      <span className="text-muted-foreground">{team.performance}% Completed</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5">
                      <div 
                        className="bg-gradient-to-r from-primary to-secondary h-2.5 rounded-full transition-all"
                        style={{ width: `${team.performance}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
