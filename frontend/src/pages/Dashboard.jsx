import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api, { getSocket } from '../services/api';
import UserAvatar from '../components/common/UserAvatar';
import ClockInModal from '../components/attendance/ClockInModal';
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
  Plus,
  FolderOpen,
  CalendarDays
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
  const [clockInStatus, setClockInStatus] = useState(null);
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
        api.get('/leaves'),
        api.get('/dashboard/overview')
      ];

      const isManagementRole = ['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER'].includes(user?.role);
      if (isManagementRole) {
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

      const overviewStats = results[5].data?.stats || {};

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

      // Real Dashboard Overview metrics from GET /api/dashboard/overview
      newStats.totalWorkforce = overviewStats.totalWorkforce ?? 0;
      newStats.workforceChangeText = overviewStats.workforceChangeText || '+0% vs last mo';
      newStats.presentToday = overviewStats.presentToday ?? 0;
      newStats.lateToday = overviewStats.lateToday ?? 0;
      newStats.lateBadgeText = overviewStats.lateBadgeText || `${overviewStats.lateToday || 0} late`;
      newStats.activeDeliverables = overviewStats.activeDeliverables ?? pending;
      newStats.completedBadgeText = overviewStats.completedBadgeText || `${completed} completed`;
      newStats.openSupportTickets = overviewStats.openSupportTickets ?? openT;
      newStats.supportBadgeText = overviewStats.supportBadgeText || (openT > 0 ? 'Needs attention' : 'All clear');
      newStats.taskVelocity = overviewStats.taskVelocity;

      if (isManagementRole) {
        const attendanceData = results[6].data || {};
        const teamsData = results[7].data || [];
        const usersData = results[8].data?.users || [];
        const logsData = results[9].data?.logs || [];

        newStats.totalMembers = usersData.filter(u => u.role === 'INTERN' || u.role === 'EMPLOYEE').length;
        newStats.totalInterns = newStats.totalMembers;
        newStats.totalLeaders = usersData.filter(u => u.role === 'TEAM_LEADER').length;
        newStats.totalTeams = teamsData.length;
        newStats.absentToday = attendanceData.absentToday || 0;
        newStats.lateToday = attendanceData.lateToday || 0;
        newStats.halfDayToday = attendanceData.halfDayToday || 0;

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
      return () => clearInterval(timer);
    }
  }, [user]);

  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);

  const handleClockIn = () => {
    setIsClockInModalOpen(true);
  };

  const handleClockOut = async () => {
    try {
      setClockLoading(true);
      setAttendanceAlert('');
      let locationStr = null;

      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          locationStr = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
        } catch (geoErr) {
          console.warn('Geolocation unavailable:', geoErr);
        }
      }

      await api.post('/attendance/clock-out', { location: locationStr });
      setClockedRecord(null);
      fetchDashboardData();

      const fetchStatus = async () => {
        try {
          const sRes = await api.get('/attendance/status');
          setClockInStatus(sRes.data);
        } catch (e) { console.error(e); }
      };
      fetchStatus();
    } catch (err) {
      setAttendanceAlert(err.response?.data?.message || 'Clock-out failed.');
    } finally {
      setClockLoading(false);
    }
  };

  // Personal clock-in portal is reserved for Employee, Intern & Team Leader role views (excluded for Admin and Super Admin)
  const canUserClockIn = ['EMPLOYEE', 'INTERN', 'TEAM_LEADER'].includes(user?.role) && !['ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const showClockFirst = canUserClockIn;

  const renderAttendanceClockPortal = () => {
    if (!user || ['ADMIN', 'SUPER_ADMIN'].includes(String(user.role).toUpperCase())) {
      return null;
    }
    const isClockedIn = Boolean(clockedRecord && !clockedRecord.clockOut);
    const windowState = clockInStatus?.windowState || 'CLOSED';

    let windowStatusBadgeText = 'Window Closed';
    let windowStatusBadgeClass = 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';

    if (windowState === 'OPEN_EARLY') {
      windowStatusBadgeText = 'Early Window Open';
      windowStatusBadgeClass = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
    } else if (windowState === 'OPEN_ON_TIME') {
      windowStatusBadgeText = 'Shift Check-in Open';
      windowStatusBadgeClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
    } else if (windowState === 'OPEN_LATE') {
      windowStatusBadgeText = 'Grace Period / Late Window';
      windowStatusBadgeClass = 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20';
    }

    return (
      <motion.div variants={itemVariants} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Workforce Attendance Check-In Portal
            </span>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-5 h-5 text-primary animate-pulse" />
              <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </h2>
              <span className="text-xs font-semibold text-muted-foreground ml-1">
                ({time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${windowStatusBadgeClass}`}>
              {windowStatusBadgeText}
            </span>
          </div>
        </div>

        {attendanceAlert && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{attendanceAlert}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs space-y-0.5">
            <p className="font-semibold text-foreground">
              Status: <span className={isClockedIn ? 'text-emerald-500 font-bold' : 'text-muted-foreground'}>{isClockedIn ? 'CLOCKED IN' : 'NOT CLOCKED IN'}</span>
            </p>
            {clockedRecord?.clockIn && (
              <p className="text-muted-foreground">
                Clocked in at {new Date(clockedRecord.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          {!isClockedIn ? (
            <button
              onClick={handleClockIn}
              disabled={clockLoading || clockInStatus?.canClockIn === false}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Clock In Now</span>
            </button>
          ) : (
            <button
              onClick={handleClockOut}
              disabled={clockLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Clock Out</span>
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* 1. Welcome & Time Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              <span>New Project</span>
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
                {loading ? '—' : (stats.totalWorkforce ?? stats.totalMembers ?? 0)}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {loading ? '—' : (stats.workforceChangeText || '+0% vs last mo')}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/80 font-medium">Active intern, employee & team leader roster</p>
          </div>

          {/* Stat Group 2 */}
          <div className="py-3 sm:py-0 sm:px-6 last:pr-0 text-left space-y-1">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider block">
              Present Today
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-black tracking-tight text-foreground">
                {loading ? '—' : (stats.presentToday ?? 0)}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {loading ? '—' : (stats.lateBadgeText || `${stats.lateToday ?? 0}\u00A0late`)}
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
                {loading ? '—' : (stats.activeDeliverables ?? stats.pendingTasks ?? 0)}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {loading ? '—' : (stats.completedBadgeText || `${stats.completedTasks || 0} completed`)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/80 font-medium">Active projects</p>
          </div>

          {/* Stat Group 4 */}
          <div className="py-3 sm:py-0 sm:px-6 last:pr-0 text-left space-y-1">
            <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider block">
              Open Support Tickets
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-black tracking-tight text-foreground">
                {loading ? '—' : (stats.openSupportTickets ?? stats.openTickets ?? 0)}
              </span>
              {loading ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  —
                </span>
              ) : ((stats.supportBadgeText === 'Needs attention' || stats.openTickets > 0) ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                  {stats.supportBadgeText || 'Needs attention'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {stats.supportBadgeText || 'All clear'}
                </span>
              ))}
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




      {/* 4. Main Section Row (Left 2 Columns + Right 1 Column) */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">

        {/* Left Column (lg:col-span-2): Quick Access + Task Velocity & Deliverables */}
        <div className="lg:col-span-2 space-y-6">

          {/* Quick Access / Admin Shortcuts Section */}
          {['ADMIN', 'SUPER_ADMIN'].includes(user.role) && (
            <div className="clean-card text-left space-y-5">
              <div>
                <h3 className="text-lg font-bold text-foreground">Quick Access</h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">Frequently used admin actions</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* 1. Attendance Audit */}
                <Link
                  to="/attendance-audit"
                  className="p-4 rounded-2xl bg-card border border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all group flex items-start gap-3.5"
                >
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">Attendance Audit</h4>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5 line-clamp-1">Review and correct attendance</p>
                  </div>
                </Link>

                {/* 2. Employee Registry */}
                <Link
                  to="/employees"
                  className="p-4 rounded-2xl bg-card border border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all group flex items-start gap-3.5"
                >
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">Employee Registry</h4>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5 line-clamp-1">Manage employees/interns</p>
                  </div>
                </Link>

                {/* 3. Announcements */}
                <Link
                  to="/announcements"
                  className="p-4 rounded-2xl bg-card border border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all group flex items-start gap-3.5"
                >
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">Announcements</h4>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5 line-clamp-1">Create or manage announcements</p>
                  </div>
                </Link>

                {/* 4. Work Calendar */}
                <Link
                  to="/operations/work-calendar"
                  className="p-4 rounded-2xl bg-card border border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all group flex items-start gap-3.5"
                >
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">Work Calendar</h4>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5 line-clamp-1">Manage WFH/holidays</p>
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* Vertical Bar Chart for Task Velocity & Deliverables */}
          <div className="clean-card text-left space-y-6">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <span>Task Velocity & Deliverables</span>
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                    {loading ? '—' : (stats.taskVelocity?.total ?? 7)} <span className="text-sm font-semibold text-muted-foreground">Tasks</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {loading ? '—' : (stats.taskVelocity?.completedBadgeText || `${stats.taskVelocity?.completed ?? 3} completed (${stats.taskVelocity?.completionPercentage ?? 43}%)`)}
                  </span>
                </div>
              </div>
            </div>

            {/* Recharts BarChart for Task Status Distribution */}
            <div className="h-72 w-full mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { status: 'Pending', count: stats.taskVelocity?.statusCounts?.pending ?? 1 },
                    { status: 'In Progress', count: stats.taskVelocity?.statusCounts?.inProgress ?? 3 },
                    { status: 'Review', count: stats.taskVelocity?.statusCounts?.review ?? 0 },
                    { status: 'Approved', count: stats.taskVelocity?.statusCounts?.approved ?? 3 },
                    { status: 'Rejected', count: stats.taskVelocity?.statusCounts?.rejected ?? 0 }
                  ]}
                  margin={{ top: 15, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 234, 230, 0.5)" />
                  <XAxis
                    dataKey="status"
                    stroke="currentColor"
                    className="text-xs font-semibold text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="currentColor"
                    className="text-xs font-semibold text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tickFormatter={(val) => Math.round(val)}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const dataPoint = payload[0].payload;
                        return (
                          <div className="bg-[#0B1528] text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/60 min-w-[130px] text-left">
                            <p className="text-[11px] font-medium text-slate-400 font-sans">{dataPoint.status} Status</p>
                            <p className="text-lg font-black text-primary font-mono mt-0.5">{dataPoint.count} <span className="text-xs text-slate-300 font-normal">tasks</span></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={chartPrimaryColor}
                    radius={[6, 6, 0, 0]}
                    barSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
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
          <div className="clean-card text-left space-y-4">
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
            <div className="grid grid-cols-7 gap-1 text-center py-1 bg-card rounded-2xl p-1.5 border border-border/40">
              {rollingWeekDays.map((wd, i) => {
                const isSelected = wd.dateString === selectedDate;
                const isToday = wd.isToday;

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedDate(wd.dateString)}
                    className={`py-1.5 px-1 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center ${
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
                    <span className="text-xs sm:text-sm font-bold block mt-0.5 font-sans">
                      {wd.dateNum}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tasks Section for Selected Date */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  {isTodaySelected ? "Today's Queue" : `${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })} Queue`}
                </span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  {dayTasks.length} {dayTasks.length === 1 ? 'Task' : 'Tasks'}
                </span>
              </div>

              <div className="dash-scroll max-h-[220px] space-y-2 pr-0.5">
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
                  <div className="p-3.5 text-center text-xs text-muted-foreground rounded-2xl bg-muted/20 border border-dashed border-border font-medium">
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

      {/* Clock In Modal */}
      <ClockInModal
        isOpen={isClockInModalOpen}
        onClose={() => setIsClockInModalOpen(false)}
        onSuccess={() => {
          fetchDashboardData();
          api.get('/attendance/status').then(res => setClockInStatus(res.data)).catch(() => {});
        }}
        user={user}
      />
    </motion.div>
  );
};

export default Dashboard;
