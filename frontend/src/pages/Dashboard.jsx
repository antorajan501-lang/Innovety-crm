import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api, { getSocket } from '../services/api';
import UserAvatar from '../components/common/UserAvatar';
import EmployeeDashboard from '../components/dashboard/EmployeeDashboard';
import TeamLeaderDashboard from '../components/dashboard/TeamLeaderDashboard';
import LeaveOverviewCard from '../components/dashboard/LeaveOverviewCard';
import TeamPerformanceRankings from '../components/dashboard/TeamPerformanceRankings';
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
  Award,
  MessageSquare,
  Search,
  Bell,
  Settings,
  Megaphone,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  Laptop,
  Plus
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' }
  }
};

// Helper for 7-day rolling week calendar calculation (Previous 3 days -> Today -> Next 3 days)
const getRollingWeekDays = () => {
  const today = new Date();
  const days = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    days.push({
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      dateNum: d.getDate(),
      isToday: i === 0,
      fullDate: d,
      dateString: dateString
    });
  }
  return days;
};

const Dashboard = () => {
  const { user } = useAuth();

  if (user?.role === 'EMPLOYEE' || user?.role === 'INTERN') {
    return <EmployeeDashboard />;
  }

  if (user?.role === 'TEAM_LEADER') {
    return <TeamLeaderDashboard />;
  }

  const { onlineUsers, notifications } = useSocket();

  const [timeFilter, setTimeFilter] = useState('1Y');
  const [activitySearch, setActivitySearch] = useState('');
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
  const [taskChartData, setTaskChartData] = useState([]);
  const [burndownChartData, setBurndownChartData] = useState([]);
  const [sprintStats, setSprintStats] = useState({ totalPoints: 0, completedPoints: 0, pendingPoints: 0 });
  const [allTasks, setAllTasks] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [recentChatRooms, setRecentChatRooms] = useState([]);
  const [leavesList, setLeavesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Intern Clock-in/out state
  const [time, setTime] = useState(new Date());
  const [clockedRecord, setClockedRecord] = useState(null);
  const [attendanceAlert, setAttendanceAlert] = useState('');
  const [clockLoading, setClockLoading] = useState(false);

  const [chartPrimaryColor, setChartPrimaryColor] = useState('rgb(var(--primary))');

  useEffect(() => {
    const updateThemeColor = () => {
      const computed = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
      if (computed) {
        setChartPrimaryColor(computed.includes(',') || computed.includes(' ') ? `rgb(${computed})` : computed);
      }
    };
    updateThemeColor();
    const observer = new MutationObserver(updateThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    return () => observer.disconnect();
  }, []);

  const todayDateStr = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState(todayDateStr);
  const rollingWeekDays = getRollingWeekDays();

  const isTodaySelected = selectedDate === todayDateStr;

  const dayTasks = useMemo(() => {
    const matched = allTasks.filter((task) => {
      const rawDate = task.deadline || task.dueDate;
      if (rawDate) {
        const d = new Date(rawDate);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}` === selectedDate;
      }
      return isTodaySelected;
    });

    if (isTodaySelected && matched.length === 0) {
      return allTasks;
    }
    return matched;
  }, [allTasks, selectedDate, isTodaySelected]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const promises = [
        api.get('/tasks'),
        api.get('/tickets'),
        api.get('/announcements'),
        api.get('/chat/rooms'),
        api.get('/leaves')
      ];

      if (user.role === 'ADMIN') {
        promises.push(api.get('/attendance/analytics'));
        promises.push(api.get('/teams'));
        promises.push(api.get('/users?limit=1000'));
        promises.push(api.get('/logs?limit=8'));
      }

      const results = await Promise.all(promises.map(p => p.catch(() => ({ error: true, data: null }))));

      const tasksData = results[0].data || [];
      setAllTasks(tasksData);
      const ticketsData = results[1].data || [];
      const announcementsData = results[2].data || [];
      setAnnouncements(announcementsData.slice(0, 4));
      const chatRoomsData = results[3].data || [];
      setRecentChatRooms(chatRoomsData);
      const leavesData = Array.isArray(results[4]?.data) ? results[4].data : [];
      setLeavesList(leavesData);

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
        const attendanceData = results[3].data || {};
        const teamsData = results[4].data || [];
        const usersData = results[5].data?.users || [];
        const logsData = results[6].data?.logs || [];

        newStats.totalMembers = usersData.filter(u => u.role === 'INTERN' || u.role === 'EMPLOYEE').length;
        newStats.totalInterns = newStats.totalMembers;
        newStats.totalLeaders = usersData.filter(u => u.role === 'TEAM_LEADER').length;
        newStats.totalTeams = teamsData.length;
        newStats.presentToday = attendanceData.presentToday || 0;
        newStats.absentToday = attendanceData.absentToday || 0;
        newStats.lateToday = attendanceData.lateToday || 0;
        newStats.halfDayToday = attendanceData.halfDayToday || 0;

        const totalActiveMembers = newStats.totalMembers;
        if (totalActiveMembers > 0) {
          const attending = newStats.presentToday + newStats.lateToday + newStats.halfDayToday;
          newStats.attendanceRate = Math.round((attending / totalActiveMembers) * 100);
        }

        setActivities(logsData);

        // Chart data for tasks distribution
        setTaskChartData([
          { name: 'Pending', value: tasksData.filter(t => t.status === 'PENDING').length },
          { name: 'In Progress', value: tasksData.filter(t => t.status === 'IN_PROGRESS').length },
          { name: 'Review', value: tasksData.filter(t => t.status === 'WAITING_FOR_REVIEW').length },
          { name: 'Approved', value: tasksData.filter(t => t.status === 'APPROVED').length },
          { name: 'Rejected', value: tasksData.filter(t => t.status === 'REJECTED').length }
        ]);

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

  const [clockInStatus, setClockInStatus] = useState(null);

  useEffect(() => {
    fetchDashboardData();

    const fetchStatus = async () => {
      try {
        const res = await api.get('/attendance/status');
        setClockInStatus(res.data);
        if (res.data.existingRecord) {
          setClockedRecord(res.data.existingRecord);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStatus();

    const socket = getSocket();
    if (socket) {
      const handleAttendanceEvent = () => {
        fetchDashboardData();
        fetchStatus();
      };
      socket.on('attendance_clock_in', handleAttendanceEvent);
      socket.on('attendance_clock_out', handleAttendanceEvent);
      socket.on('attendance_updated', handleAttendanceEvent);
      return () => {
        socket.off('attendance_clock_in', handleAttendanceEvent);
        socket.off('attendance_clock_out', handleAttendanceEvent);
        socket.off('attendance_updated', handleAttendanceEvent);
      };
    }
  }, [user]);

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

  if (loading) {
    return (
      <div className="space-y-6 p-2">
        <div className="skeleton h-16 w-full rounded-[24px]" />
        <div className="skeleton h-32 w-full rounded-[24px]" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="skeleton h-96 lg:col-span-2 rounded-[24px]" />
          <div className="skeleton h-96 rounded-[24px]" />
        </div>
      </div>
    );
  }

  // Calculate average for bar chart reference line
  const avgChartValue = taskChartData.length > 0
    ? Math.round(taskChartData.reduce((acc, curr) => acc + curr.value, 0) / taskChartData.length)
    : 0;

  const showClockFirst = user && (user.role === 'EMPLOYEE' || user.role === 'INTERN' || user.role === 'TEAM_LEADER');
  const showClockPortal = user && (user.role === 'INTERN' || user.role === 'EMPLOYEE' || user.role === 'TEAM_LEADER');

  const renderAttendanceClockPortal = () => {
    if (!showClockPortal) return null;
    const isClockedIn = clockedRecord && !clockedRecord.clockOut;
    const isCompleted = clockedRecord && clockedRecord.clockOut;
    const isCompact = showClockFirst && (isClockedIn || isCompleted);

    return (
      <motion.div variants={itemVariants} className={`clean-card text-left ${isCompact ? 'p-4 space-y-2.5' : 'space-y-4'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl bg-primary/10 text-primary border border-primary/20 ${isCompact ? 'p-2.5' : 'p-3'}`}>
              <Clock className={isCompact ? 'h-4 w-4' : 'h-5 w-5'} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-bold text-foreground ${isCompact ? 'text-sm' : 'text-base'}`}>Attendance Clock Portal</h3>
                {isCompact && (
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${isCompleted
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-primary text-white border-primary-hover shadow-2xs'
                    }`}>
                    {isCompleted ? 'Shift Completed' : 'Checked In / Active'}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isCompact ? 'Active shift logged with geolocation validation.' : 'Clock your shift hours. Ensures geolocation validations are processed.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 sm:self-center">
            <div className="text-right">
              <span className={`font-black font-mono tracking-tight text-primary block ${isCompact ? 'text-lg' : 'text-2xl'}`}>
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground block font-semibold">
                {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>

            {/* Compact Action Buttons */}
            {isCompact && (
              <div className="ml-2">
                {isClockedIn ? (
                  <button
                    onClick={handleClockOut}
                    disabled={clockLoading}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white px-4 py-2 rounded-full text-xs font-extrabold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    <span>Clock Out</span>
                  </button>
                ) : (
                  <div className="text-xs text-muted-foreground font-bold flex items-center gap-1 bg-primary/10 border border-primary/20 px-3.5 py-1.5 rounded-full">
                    <CheckCircle className="h-3.5 w-3.5 text-primary" />
                    <span>Logged</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {clockedRecord && clockedRecord.status === 'LATE' && (
          <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>Late Clock-In Notice: Marked as <strong>LATE</strong> (past 09:30 AM).</span>
          </div>
        )}

        {attendanceAlert && (
          <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${attendanceAlert.includes('failed') || attendanceAlert.includes('denied')
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-600'
            : 'bg-primary/10 border-primary/20 text-primary'
            }`}>
            <span>{attendanceAlert}</span>
          </div>
        )}

        {!isCompact && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-border/30">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold">Status:</span>
              {!clockedRecord ? (
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-full font-bold">Not Clocked In</span>
              ) : clockedRecord.clockOut ? (
                <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-extrabold border border-primary/20">Shift Completed</span>
              ) : (
                <span className="text-xs bg-primary text-white px-3 py-1 rounded-full font-extrabold shadow-sm">Checked In / Active</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleClockIn}
                disabled={clockLoading || !clockInStatus?.canClockIn}
                className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-full text-xs font-extrabold shadow-md shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Clock In</span>
              </button>
              <button
                onClick={handleClockOut}
                disabled={clockLoading || !clockInStatus?.canClockOut}
                className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white px-6 py-2.5 rounded-full text-xs font-extrabold shadow-md shadow-rose-600/25 transition-all active:scale-95 disabled:opacity-50"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Clock Out</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <motion.div
      className="space-y-6 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 1. Page Header — Clean SaaS Pattern */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
            Real-time analytics for workforce attendance, sprint tasks, and system activities.
          </p>
        </div>

        {['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER'].includes(user?.role) && (
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold px-5 py-2.5 rounded-full text-xs shadow-md shadow-primary/25 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>New Task</span>
            </Link>
          </div>
        )}
      </motion.div>

      {/* Position #1 for Employee, Intern & Team Leader: Attendance Clock Portal */}
      {showClockFirst && renderAttendanceClockPortal()}

      {/* 2. Stat Strip Card — Single Wide Card with Dividers (Clean SaaS Style) */}
      <motion.div variants={itemVariants} className="stat-card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/30">
          {/* Stat Group 1 */}
          <div className="py-3 sm:py-0 sm:px-6 first:pl-0 last:pr-0 text-left space-y-1">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider block">
              Total Workforce
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-black tracking-tight text-foreground">
                {stats.totalMembers || stats.totalInterns}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                +12% vs last mo
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/80 font-medium">Active intern & employee roster</p>
          </div>

          {/* Stat Group 2 */}
          <div className="py-3 sm:py-0 sm:px-6 last:pr-0 text-left space-y-1">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider block">
              Present Today
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-black tracking-tight text-foreground">
                {stats.presentToday}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {stats.attendanceRate}% turnout
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/80 font-medium">Logged shift check-ins today</p>
          </div>

          {/* Stat Group 3 */}
          <div className="py-3 sm:py-0 sm:px-6 last:pr-0 text-left space-y-1">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider block">
              Active Deliverables
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-black tracking-tight text-foreground">
                {stats.pendingTasks}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {stats.completedTasks} completed
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/80 font-medium">In-flight sprint issues</p>
          </div>

          {/* Stat Group 4 */}
          <div className="py-3 sm:py-0 sm:px-6 last:pr-0 text-left space-y-1">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider block">
              Open Support Tickets
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-black tracking-tight text-foreground">
                {stats.openTickets}
              </span>
              {stats.openTickets > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                  Needs attention
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  All clear
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/80 font-medium">Queries pending resolution</p>
          </div>
        </div>
      </motion.div>

      {/* Leave Overview Summary Ticker Card */}
      {['ADMIN', 'TEAM_LEADER', 'SUPER_ADMIN'].includes(user.role) && (
        <motion.div variants={itemVariants}>
          <LeaveOverviewCard leaves={leavesList} onRefresh={fetchDashboardData} />
        </motion.div>
      )}

      {/* 2.5. Activity Assigned Card — Clean SaaS Pattern */}
      <motion.div variants={itemVariants} className="clean-card text-left space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Activity Assigned</h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Your current workforce time and activity allocation.</p>
          </div>

          {/* Search Input Box top-right */}
          <div className="relative shrink-0 w-full sm:w-64">
            <input
              type="text"
              placeholder="Search..."
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
              className="w-full bg-muted/30 border border-border/40 rounded-full px-4 py-2 text-xs pr-10 focus:ring-2 focus:ring-primary/20"
            />
            <Search className="absolute right-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1">
          {/* Column 1: Featured Task Activity */}
          <div className="p-5 rounded-2xl bg-primary/5 border border-border/40 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Task</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                △ 14.13%
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <span className="text-4xl sm:text-5xl font-black text-foreground tracking-tight">
                {Math.round((stats.completedTasks / ((stats.pendingTasks + stats.completedTasks) || 1)) * 100)}%
              </span>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] text-muted-foreground font-mono font-semibold">23, Jan-Mar</span>
                <svg className="w-20 h-6 text-primary stroke-current fill-none stroke-[2]" viewBox="0 0 80 24">
                  <path d="M 0 20 Q 20 18, 40 10 T 80 4" />
                  <circle cx="80" cy="4" r="2.5" className="fill-primary" />
                </svg>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-border/30">
              You've been completing a lot of sprint deliverables lately, which is having a positive impact on your productivity!
            </p>
          </div>

          {/* Column 2: 2 Stacked Items (Meeting & Call equivalent) */}
          <div className="grid grid-rows-2 gap-4">
            {/* Top Item */}
            <div className="p-4 rounded-2xl bg-card border border-border/30 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Meeting & Standups</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  △ 2.32%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-foreground">{stats.attendanceRate}%</span>
                <svg className="w-16 h-5 text-primary stroke-current fill-none stroke-[2]" viewBox="0 0 80 24">
                  <path d="M 0 18 Q 30 15, 50 8 T 80 4" />
                  <circle cx="80" cy="4" r="2.5" className="fill-primary" />
                </svg>
              </div>
            </div>

            {/* Bottom Item */}
            <div className="p-4 rounded-2xl bg-card border border-border/30 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Support & Tickets</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  △ 9.23%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-foreground">
                  {Math.round((stats.openTickets / ((stats.openTickets + stats.closedTickets) || 1)) * 100)}%
                </span>
                <svg className="w-16 h-5 text-primary stroke-current fill-none stroke-[2]" viewBox="0 0 80 24">
                  <path d="M 0 16 Q 25 12, 55 6 T 80 3" />
                  <circle cx="80" cy="3" r="2.5" className="fill-primary" />
                </svg>
              </div>
            </div>
          </div>

          {/* Column 3: 2 Stacked Items (Email & Note equivalent) */}
          <div className="grid grid-rows-2 gap-4">
            {/* Top Item */}
            <div className="p-4 rounded-2xl bg-card border border-border/30 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Audit & System Logs</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                  ▽ 17.12%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-foreground">8%</span>
                <svg className="w-16 h-5 text-rose-500 stroke-current fill-none stroke-[2]" viewBox="0 0 80 24">
                  <path d="M 0 4 Q 30 8, 50 16 T 80 20" />
                  <circle cx="80" cy="20" r="2.5" className="fill-rose-500" />
                </svg>
              </div>
            </div>

            {/* Bottom Item */}
            <div className="p-4 rounded-2xl bg-card border border-border/30 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Task Completion</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  △ 7.41%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-foreground">
                  {Math.round((stats.completedTasks / ((stats.completedTasks + stats.pendingTasks) || 1)) * 100)}%
                </span>
                <svg className="w-16 h-5 text-primary stroke-current fill-none stroke-[2]" viewBox="0 0 80 24">
                  <path d="M 0 18 Q 20 14, 50 8 T 80 2" />
                  <circle cx="80" cy="2" r="2.5" className="fill-primary" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 3. Attendance Clock Portal */}
      {!showClockFirst && renderAttendanceClockPortal()}

      {/* 4. Two-Column Card Row (Chart Card Left + Schedule/List Card Right) */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">

        {/* Left Column: Smooth Area Chart matching reference screenshot with Real CRM Data */}
        <div className="clean-card lg:col-span-2 text-left space-y-6">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <span>Task Velocity & Deliverables</span>
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                    {allTasks.length || (stats.pendingTasks + stats.completedTasks)} <span className="text-sm font-semibold text-muted-foreground">Tasks</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {stats.completedTasks} completed ({Math.round((stats.completedTasks / ((stats.pendingTasks + stats.completedTasks) || 1)) * 100)}%)
                  </span>
                </div>
              </div>

              {/* Time Range Filter Selector (1D, 1W, 1M, 3M, 1Y, ALL) */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 text-xs font-semibold">
                {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeFilter(range)}
                    className={`px-3 py-1 rounded-lg transition-all ${timeFilter === range
                      ? 'bg-primary text-white font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts AreaChart with real CRM task data */}
            <div className="h-72 w-full mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={
                    taskChartData && taskChartData.length > 0
                      ? taskChartData.map(item => ({ label: item.name || item.label, value: item.value || 0 }))
                      : [
                        { label: 'Pending', value: stats.pendingTasks },
                        { label: 'Completed', value: stats.completedTasks }
                      ]
                  }
                  margin={{ top: 15, right: 10, left: -15, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="areaColorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartPrimaryColor} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={chartPrimaryColor} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 234, 230, 0.5)" />
                  <XAxis
                    dataKey="label"
                    stroke="currentColor"
                    className="text-xs font-medium text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="currentColor"
                    className="text-xs font-medium text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tickFormatter={(val) => Math.round(val)}
                  />
                  <Tooltip
                    cursor={{ stroke: chartPrimaryColor, strokeWidth: 1, strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const dataPoint = payload[0].payload;
                        return (
                          <div className="bg-[#0B1528] text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/60 min-w-[130px] text-left">
                            <p className="text-[11px] font-medium text-slate-400 font-sans">{dataPoint.label} Status</p>
                            <p className="text-lg font-black text-primary font-mono mt-0.5">{dataPoint.value} <span className="text-xs text-slate-300 font-normal">tasks</span></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={chartPrimaryColor}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#areaColorGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Active Sprint Burndown Curve for Admin */}
          {user.role === 'ADMIN' && burndownChartData.length > 0 && (
            <div className="border-t border-border/30 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Active Sprint Burndown</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">Ideal vs. remaining story point velocity.</p>
                </div>
                <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-mono font-bold border border-primary/20">
                  {sprintStats.totalPoints} SP Total
                </span>
              </div>
              <div className="h-44 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={burndownChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 234, 230, 0.6)" />
                    <XAxis dataKey="name" stroke="currentColor" className="text-xs font-semibold text-muted-foreground" tickLine={false} />
                    <YAxis stroke="currentColor" className="text-xs font-semibold text-muted-foreground" tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0B1528', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff' }}
                      labelStyle={{ color: chartPrimaryColor, fontWeight: 'bold' }}
                    />
                    <Line type="monotone" dataKey="Ideal" stroke="#94A3B8" strokeDasharray="5 5" strokeWidth={2} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Remaining" stroke={chartPrimaryColor} strokeWidth={3} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Common Chat Mini Widget + Schedule & Deliverables Card */}
        <div className="space-y-6">
          {/* 1. Common Chat Widget */}
          <div className="clean-card text-left space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <MessageSquare className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">Common Chat</h3>
                  <p className="text-[10px] text-muted-foreground font-semibold">Real-time team messaging</p>
                </div>
              </div>
              <Link
                to="/chat"
                className="text-xs font-bold text-primary flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 transition-all hover:bg-primary/20"
              >
                <span>Open Chat</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Quick Room Snippets */}
            <div className="space-y-2 pt-1">
              {recentChatRooms.length === 0 ? (
                <p className="text-xs text-muted-foreground font-semibold py-2">No active chat rooms.</p>
              ) : (
                recentChatRooms.slice(0, 3).map(r => (
                  <Link
                    key={r.id}
                    to={`/chat?room=${r.id}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/30 hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="h-7 w-7 rounded-lg bg-primary text-white font-bold flex items-center justify-center text-[10px]">
                        {r.name?.charAt(0) || 'C'}
                      </div>
                      <div className="truncate text-left">
                        <p className="text-xs font-bold text-foreground truncate">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate font-medium">{r.lastMessage ? r.lastMessage.text : 'Click to chat'}</p>
                      </div>
                    </div>
                    {r.unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black shrink-0">
                        {r.unreadCount}
                      </span>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* 2. Schedule & Deliverables Card (7-Day Rolling Window) */}
          <div className="clean-card text-left space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Schedule & Deliverables</h3>
              <div className="flex items-center gap-2">
                {!isTodaySelected && (
                  <button
                    onClick={() => setSelectedDate(todayDateStr)}
                    className="text-[10px] font-extrabold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-0.5 rounded-full border border-primary/20 transition-all cursor-pointer"
                  >
                    Reset to Today
                  </button>
                )}
                <span className="text-[11px] font-extrabold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                  Rolling 7 Days
                </span>
              </div>
            </div>

            {/* Mini 7-Day Rolling Strip Date Selector */}
            <div className="grid grid-cols-7 gap-1 text-center py-2 bg-card rounded-2xl p-1.5 border border-border/40">
              {rollingWeekDays.map((wd, i) => {
                const isSelected = wd.dateString === selectedDate;
                const isToday = wd.isToday;

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedDate(wd.dateString)}
                    className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isToday
                        ? isSelected
                          ? 'bg-primary text-white font-extrabold shadow-md shadow-primary/30 scale-105 ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900'
                          : 'bg-primary/90 text-white font-extrabold shadow-sm'
                        : isSelected
                        ? 'bg-primary/15 text-primary font-extrabold border-2 border-primary shadow-2xs'
                        : 'hover:bg-muted text-muted-foreground font-semibold border border-transparent'
                    }`}
                  >
                    <span className="text-[10px] block uppercase font-mono tracking-wider">
                      {wd.dayName}
                    </span>
                    <span className="text-sm font-bold block mt-0.5 font-sans">
                      {wd.dateNum}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tasks Section for Selected Date */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  {isTodaySelected ? "Today's Queue" : `${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })} Queue`}
                </span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  {dayTasks.length} {dayTasks.length === 1 ? 'Task' : 'Tasks'}
                </span>
              </div>

              <div className="dash-scroll max-h-[220px] space-y-2.5 snap-y snap-mandatory">
                {dayTasks.length > 0 ? (
                  [...dayTasks]
                    .sort((a, b) => {
                      const statusOrder = {
                        IN_PROGRESS: 1,
                        WAITING_FOR_REVIEW: 2,
                        PENDING: 3,
                        TODO: 4,
                        APPROVED: 5,
                        COMPLETED: 5
                      };
                      const orderA = statusOrder[a.status] || 99;
                      const orderB = statusOrder[b.status] || 99;
                      if (orderA !== orderB) return orderA - orderB;
                      return new Date(a.deadline || a.dueDate || 0) - new Date(b.deadline || b.dueDate || 0);
                    })
                    .map((task, idx) => {
                      // Tonal green left accents
                      const accentStyles = [
                        'border-l-4 border-primary bg-primary/5 text-foreground',
                        'border-l-4 border-primary/70 bg-primary/5 text-foreground',
                        'border-l-4 border-primary/40 bg-primary/5 text-foreground'
                      ];
                      const chipStyles = [
                        'bg-primary text-white',
                        'bg-primary/20 text-primary',
                        'bg-primary/10 text-primary'
                      ];

                      const accentClass = accentStyles[idx % accentStyles.length];
                      const chipClass = chipStyles[idx % chipStyles.length];

                      return (
                        <div
                          key={task.id}
                          className={`p-3.5 rounded-r-2xl rounded-l-md border border-border/30 flex items-center justify-between gap-3 snap-start shrink-0 transition-all hover:shadow-sm ${accentClass}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl shrink-0 ${chipClass}`}>
                              <Briefcase className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                              <h4 className="text-xs font-bold line-clamp-1">{task.title}</h4>
                              <span className="text-[10px] opacity-80 font-medium block mt-0.5">
                                Due: {task.dueDate || task.deadline ? new Date(task.dueDate || task.deadline).toLocaleDateString() : 'Scheduled'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/80 shadow-2xs border border-border/30 shrink-0">
                            {task.status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      );
                    })
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground rounded-2xl bg-muted/20 border border-dashed border-border">
                    No tasks scheduled for {isTodaySelected ? 'today' : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
                  </div>
                )}

                {/* Announcements Item as List Accent */}
                {announcements.length > 0 && isTodaySelected && (
                  <div className="p-3.5 rounded-r-2xl rounded-l-md border-l-4 border-primary bg-primary/5 border border-border/30 flex items-center justify-between gap-3 snap-start shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl shrink-0 bg-primary text-white">
                        <Megaphone className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-foreground line-clamp-1">{announcements[0].title}</h4>
                        <span className="text-[10px] text-muted-foreground font-medium block mt-0.5">
                          Team Announcement
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                      Info
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </motion.div>

      {/* 5. Recent Activity & Team Performance Split */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Activity Log */}
        <div className="clean-card text-left space-y-4">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <h3 className="text-sm font-bold text-foreground">Recent System Activities</h3>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="dash-scroll max-h-72 space-y-3">
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No recent activity logs.</p>
            ) : (
              activities.map((act) => (
                <div key={act._id} className="flex items-start justify-between gap-3 text-xs border-b border-border/30 pb-2.5 last:border-0">
                  <div>
                    <span className="font-bold text-foreground">{act.userName || 'System'}</span>
                    {act.userCode && <span className="text-[10px] text-muted-foreground font-mono ml-1 font-semibold">({act.userCode})</span>}
                    <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">{act.action}</p>
                    <span className="text-[10px] text-muted-foreground/60 font-mono block mt-1">
                      {act.createdAt || act.timestamp ? new Date(act.createdAt || act.timestamp).toLocaleString() : 'Just now'}
                    </span>
                  </div>
                  <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-extrabold shrink-0 uppercase border border-primary/20">
                    {act.type || 'LOG'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Team Performance Rankings */}
        <TeamPerformanceRankings />
      </motion.div>

    </motion.div>
  );
};

export default Dashboard;
