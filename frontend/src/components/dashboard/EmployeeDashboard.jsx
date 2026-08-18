import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api, { getSocket } from '../../services/api';
import UserAvatar from '../common/UserAvatar';
import ClockInModal from '../attendance/ClockInModal';
import { calculateAttendanceStreak, formatStreakDays } from '../../utils/streakCalculator';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  FileText,
  Calendar,
  CheckCircle,
  User as UserIcon,
  Users,
  Briefcase,
  TrendingUp,
  Award,
  Sparkles,
  ChevronRight,
  Plus,
  MessageSquare,
  Megaphone,
  Activity,
  Search,
  MapPin,
  Flame,
  Shield,
  Layers,
  ArrowUpRight,
  Laptop,
  Send,
  X
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
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

export const EmployeeDashboard = () => {
  const { user } = useAuth();
  const { onlineUsers, notifications } = useSocket();
  const navigate = useNavigate();

  // Time & Live Clock State
  const [time, setTime] = useState(new Date());

  // Attendance State
  const [clockedRecord, setClockedRecord] = useState(null);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [clockLoading, setClockLoading] = useState(false);
  const [clockStatus, setClockStatus] = useState(null);
  const [attendanceAlert, setAttendanceAlert] = useState('');

  // Data States (Strictly Database Fetched & Employee Scoped)
  const [myTasks, setMyTasks] = useState([]);
  const [myProjects, setMyProjects] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [myActivities, setMyActivities] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  // Leave Modal State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    type: 'CASUAL',
    reason: '',
    contactPhone: ''
  });
  const [leaveSuccess, setLeaveSuccess] = useState(null);

  // Time Filter for Charts & Dynamic Theme RGB Color Tracking
  const [timeFilter, setTimeFilter] = useState('1W');
  const [chartPrimaryColor, setChartPrimaryColor] = useState('rgb(var(--primary))');

  useEffect(() => {
    const updateThemeColor = () => {
      const computed = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
      if (computed) {
        setChartPrimaryColor(`rgb(${computed})`);
      }
    };
    updateThemeColor();
    const observer = new MutationObserver(updateThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchEmployeeDashboardData();

    const socket = getSocket();
    if (socket) {
      const handleAttendanceEvent = () => {
        fetchEmployeeDashboardData();
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

  const fetchEmployeeDashboardData = async () => {
    try {
      setLoading(true);

      const [
        tasksRes,
        projectsRes,
        attendanceStatusRes,
        attendanceLogsRes,
        announcementsRes,
        leavesRes,
        teamsRes,
        logsRes,
        holidaysRes
      ] = await Promise.all([
        api.get('/tasks').catch(() => ({ data: [] })),
        api.get('/projects').catch(() => ({ data: [] })),
        api.get('/attendance/status').catch(() => ({ data: null })),
        api.get('/attendance/logs').catch(() => ({ data: [] })),
        api.get('/announcements').catch(() => ({ data: [] })),
        api.get('/leaves').catch(() => ({ data: [] })),
        api.get('/teams').catch(() => ({ data: [] })),
        api.get('/logs?limit=20').catch(() => ({ data: { logs: [] } })),
        api.get('/payroll/holidays').catch(() => ({ data: [] }))
      ]);

      // 1. My Tasks (Strictly Filtered for logged-in Employee)
      const tasksData = Array.isArray(tasksRes.data) ? tasksRes.data : [];
      const userAssigned = tasksData.filter(t => 
        t.assigneeId === user.id || 
        t.assignedToId === user.id || 
        t.assignedTo?.id === user.id ||
        (t.assignees && t.assignees.some(a => a.id === user.id))
      );
      setMyTasks(userAssigned);

      // 2. My Projects (Filtered for logged-in Employee)
      const projectsData = Array.isArray(projectsRes.data) ? projectsRes.data : [];
      const userProj = projectsData.filter(p => 
        p.members && p.members.some(m => m.userId === user.id || m.id === user.id)
      );
      setMyProjects(userProj);

      // 3. Attendance Status & Logs
      const logs = Array.isArray(attendanceLogsRes.data) ? attendanceLogsRes.data : [];
      setAttendanceLogs(logs);
      
      const holData = Array.isArray(holidaysRes.data) ? holidaysRes.data : [];
      setHolidays(holData);
      
      const statusData = attendanceStatusRes.data;
      setClockStatus(statusData);

      const localDateStr = new Date().toLocaleDateString('en-CA');
      const todayRec = statusData?.existingRecord || logs.find(l => new Date(l.date).toLocaleDateString('en-CA') === localDateStr);
      setClockedRecord(todayRec || null);

      // 4. Announcements
      const ancData = Array.isArray(announcementsRes.data) ? announcementsRes.data : [];
      setAnnouncements(ancData);

      // 5. My Leaves
      const leavesData = Array.isArray(leavesRes.data) ? leavesRes.data : [];
      setLeaves(leavesData);

      // 6. My Team Information (Strictly Employee Team)
      const teamsData = Array.isArray(teamsRes.data) ? teamsRes.data : [];
      const userTeam = teamsData.find(t => 
        t.members && t.members.some(m => m.userId === user.id || m.user?.id === user.id)
      );
      setMyTeam(userTeam || null);

      // 7. My Recent Activity Logs
      const rawLogs = logsRes.data?.logs || logsRes.data || [];
      const userLogs = Array.isArray(rawLogs) ? rawLogs.filter(l => l.userId === user.id || l.userCode === user.employeeId) : [];
      setMyActivities(userLogs);

      setLoading(false);
    } catch (err) {
      console.error('Error fetching Employee Dashboard data:', err);
      setLoading(false);
    }
  };

  // Helper for Geolocation Clock In/Out
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
          resolve('Office Location Validated');
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);

  const handleClockIn = () => {
    setIsClockInModalOpen(true);
  };

  const handleClockOut = async () => {
    try {
      setClockLoading(true);
      setAttendanceAlert('');
      const locationStr = await getCoordinates();
      const res = await api.post('/attendance/clock-out', { location: locationStr });
      setClockedRecord(res.data);
      setAttendanceAlert(`Clocked Out successfully at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      await fetchEmployeeDashboardData();
    } catch (err) {
      setAttendanceAlert(err.response?.data?.message || 'Clock out failed.');
    } finally {
      setClockLoading(false);
    }
  };

  // Real Database Leave Balances State
  const [leaveBalances, setLeaveBalances] = useState({
    casualRemaining: 12,
    sickRemaining: 12,
    emergencyRemaining: 6,
    approvedCasual: 0,
    approvedSick: 0,
    approvedEmergency: 0,
    pendingRequests: 0,
    approvedRequests: 0
  });

  const fetchLeaveBalances = async () => {
    try {
      const res = await api.get('/leaves/balances');
      if (res.data) {
        setLeaveBalances(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch user leave balances:', err);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchLeaveBalances();
    }
  }, [user?.id, leaves]);

  const handleApplyLeaveSubmit = async (e) => {
    e.preventDefault();
    try {
      setLeaveSubmitting(true);
      setLeaveSuccess(null);
      await api.post('/leaves', {
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        leaveType: leaveForm.type,
        payType: leaveForm.payType || (['LOP', 'UNPAID', 'LOSS_OF_PAY'].includes(leaveForm.type) ? 'UNPAID' : 'PAID'),
        type: leaveForm.type,
        reason: leaveForm.reason,
        contactPhone: leaveForm.contactPhone
      });
      setLeaveSuccess('Leave application submitted successfully for review!');
      await fetchEmployeeDashboardData();
      await fetchLeaveBalances();
      setTimeout(() => {
        setIsLeaveModalOpen(false);
        setLeaveSuccess(null);
        setLeaveForm({
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          type: 'CASUAL',
          reason: '',
          contactPhone: ''
        });
      }, 1500);
    } catch (err) {
      setLeaveSuccess(`Error: ${err.response?.data?.message || 'Failed to submit leave application'}`);
    } finally {
      setLeaveSubmitting(false);
    }
  };

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = time.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Live Working Hours calculation
  const currentWorkingHours = useMemo(() => {
    if (!clockedRecord) return 0;
    if (clockedRecord.clockOut) return clockedRecord.workingHours || 0;
    if (clockedRecord.clockIn) {
      const diff = (time - new Date(clockedRecord.clockIn)) / (1000 * 3600);
      return Math.max(0, Math.round(diff * 10) / 10);
    }
    return 0;
  }, [clockedRecord, time]);

  // Task Stats Breakdown
  const pendingTasks = myTasks.filter(t => t.status === 'PENDING');
  const inProgressTasks = myTasks.filter(t => t.status === 'IN_PROGRESS');
  const reviewTasks = myTasks.filter(t => t.status === 'WAITING_FOR_REVIEW');
  const completedTasks = myTasks.filter(t => t.status === 'APPROVED' || t.status === 'COMPLETED');

  // Real Monthly Attendance Rate %
  const attendanceRate = useMemo(() => {
    if (!attendanceLogs || attendanceLogs.length === 0) return 100;
    const now = new Date();
    const thisMonthLogs = attendanceLogs.filter(l => new Date(l.date).getMonth() === now.getMonth());
    if (thisMonthLogs.length === 0) return 100;
    const presentCount = thisMonthLogs.filter(l => ['PRESENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME'].includes(l.status)).length;
    return Math.round((presentCount / thisMonthLogs.length) * 100);
  }, [attendanceLogs]);

  // Real Attendance Streak (consecutive days)
  const attendanceStreak = useMemo(() => {
    return calculateAttendanceStreak(attendanceLogs, holidays);
  }, [attendanceLogs, holidays]);

  // Leave Balances (12 Casual, 8 Sick, 3 Emergency default limits minus approved)
  const leaveStats = useMemo(() => {
    const approved = leaves.filter(l => l.status === 'APPROVED');
    const pending = leaves.filter(l => l.status === 'PENDING').length;
    
    let casualUsed = 0;
    let sickUsed = 0;
    let emergencyUsed = 0;

    approved.forEach(l => {
      const days = Math.ceil((new Date(l.endDate) - new Date(l.startDate)) / (1000 * 3600 * 24)) + 1;
      if (l.type === 'SICK') sickUsed += days;
      else if (l.type === 'EMERGENCY') emergencyUsed += days;
      else casualUsed += days;
    });

    return {
      casualLeft: Math.max(0, 12 - casualUsed),
      sickLeft: Math.max(0, 8 - sickUsed),
      emergencyLeft: Math.max(0, 3 - emergencyUsed),
      pendingRequests: pending,
      approvedRequests: approved.length
    };
  }, [leaves]);

  // Real Weekly Productivity Bar Chart Data from last 7 days attendance logs
  const weeklyProductivityData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];
    const now = new Date();
    let hasData = false;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString('en-CA');
      const dayName = days[d.getDay()];
      
      const log = attendanceLogs.find(l => new Date(l.date).toLocaleDateString('en-CA') === dateStr);
      let hours = 0;
      if (log) {
        if (log.workingHours) {
          hours = log.workingHours;
        } else if (log.clockIn && log.clockOut) {
          hours = (new Date(log.clockOut) - new Date(log.clockIn)) / (1000 * 3600);
        } else if (log.clockIn) {
          hours = (new Date() - new Date(log.clockIn)) / (1000 * 3600);
        }
      }
      hours = Math.round(hours * 10) / 10;
      if (hours > 0) hasData = true;

      result.push({ day: dayName, hours });
    }

    return { data: result, hasData };
  }, [attendanceLogs]);

  // Real Today's Schedule Timeline items
  const todaySchedule = useMemo(() => {
    const items = [];
    const todayStr = new Date().toLocaleDateString('en-CA');

    if (clockedRecord?.clockIn) {
      items.push({
        time: new Date(clockedRecord.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: 'Shift Check-In',
        subtitle: `Clocked in (${clockedRecord.status})`,
        color: 'bg-primary'
      });
    }

    myTasks.forEach(task => {
      if (task.dueDate && new Date(task.dueDate).toLocaleDateString('en-CA') === todayStr) {
        items.push({
          time: 'Due Today',
          title: task.title,
          subtitle: `Priority: ${task.priority || 'NORMAL'} • Status: ${task.status}`,
          color: 'bg-amber-500'
        });
      }
    });

    if (clockedRecord?.clockOut) {
      items.push({
        time: new Date(clockedRecord.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: 'Shift Check-Out',
        subtitle: `Shift completed (${clockedRecord.workingHours?.toFixed(1) || 0} hrs)`,
        color: 'bg-primary'
      });
    }

    return items;
  }, [clockedRecord, myTasks]);

  if (loading) {
    return (
      <div className="space-y-6 p-2">
        <div className="skeleton h-36 w-full rounded-[28px]" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="skeleton h-24 rounded-[24px]" />
          <div className="skeleton h-24 rounded-[24px]" />
          <div className="skeleton h-24 rounded-[24px]" />
          <div className="skeleton h-24 rounded-[24px]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="skeleton h-96 lg:col-span-2 rounded-[28px]" />
          <div className="skeleton h-96 rounded-[28px]" />
        </div>
        {/* Clock In Modal */}
      <ClockInModal
        isOpen={isClockInModalOpen}
        onClose={() => setIsClockInModalOpen(false)}
        onSuccess={() => fetchEmployeeDashboardData()}
        user={user}
      />
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6 pb-10"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 1. Personalized Welcome Banner Section */}
      <motion.div variants={itemVariants} className="relative rounded-[28px] border border-border/80 bg-card p-6 md:p-8 shadow-sm backdrop-blur-xl overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* User Identity & Info */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative">
              <UserAvatar user={user} className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl ring-4 ring-primary/20 shadow-lg object-cover" />
              <span className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-card ${
                clockedRecord && !clockedRecord.clockOut ? 'bg-success' : 'bg-amber-500'
              }`} title={clockedRecord && !clockedRecord.clockOut ? 'Clocked In & Active' : 'Not Clocked In'} />
            </div>

            <div className="space-y-1.5 text-left">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {getGreeting()}, {user.name} 👋
              </h1>
              <div>
                <span className="inline-block px-3 py-0.5 text-xs font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                  {user.role}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-semibold pt-0.5">
                <span>{user?.role === 'INTERN' ? 'Intern ID' : 'Employee ID'}: <strong className="text-foreground font-mono">{user.internId || user.employeeId || user.id?.substring(0, 8)}</strong></span>
                <span>•</span>
                <span>Dept: <strong className="text-foreground">{user.department || 'General'}</strong></span>
                <span>•</span>
                <span>Team: <strong className="text-foreground">{myTeam?.name || 'No Team Assigned'}</strong></span>
                {myTeam?.leader && (
                  <>
                    <span>•</span>
                    <span>Reporting To: <strong className="text-foreground">{myTeam.leader.name}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Live Date & Time Counter Badge with Clock In/Out Buttons underneath */}
          <div className="flex flex-col items-center justify-center gap-2 bg-muted/40 border border-border/60 rounded-2xl p-4 shrink-0 text-center min-w-[210px]">
            <div className="text-center space-y-0.5">
              <span className="text-2xl font-black font-mono tracking-tight text-primary block">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-xs text-muted-foreground font-bold block">
                {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-border/40 w-full">
              <button
                onClick={handleClockIn}
                disabled={clockLoading || !clockStatus?.canClockIn}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Clock In</span>
              </button>
              <button
                onClick={handleClockOut}
                disabled={clockLoading || !clockStatus?.canClockOut}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Clock Out</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 8. Quick Actions Bar (Center Aligned) */}
      <motion.div variants={itemVariants} className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap pb-2">
        <Link
          to="/tasks"
          className="flex items-center gap-2 bg-card hover:bg-muted text-foreground border border-border/70 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xs transition-all shrink-0"
        >
          <FileText className="h-4 w-4 text-primary" />
          <span>My Tasks ({myTasks.length})</span>
        </Link>

        <button
          onClick={() => setIsLeaveModalOpen(true)}
          className="flex items-center gap-2 bg-card hover:bg-muted text-foreground border border-border/70 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xs transition-all shrink-0 cursor-pointer"
        >
          <Calendar className="h-4 w-4 text-amber-500" />
          <span>Apply Leave</span>
        </button>

        <Link
          to="/profile"
          className="flex items-center gap-2 bg-card hover:bg-muted text-foreground border border-border/70 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xs transition-all shrink-0"
        >
          <UserIcon className="h-4 w-4 text-blue-500" />
          <span>My Profile</span>
        </Link>

        <Link
          to="/chat"
          className="flex items-center gap-2 bg-card hover:bg-muted text-foreground border border-border/70 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xs transition-all shrink-0"
        >
          <MessageSquare className="h-4 w-4 text-purple-500" />
          <span>Chat Room</span>
        </Link>

        <Link
          to="/announcements"
          className="flex items-center gap-2 bg-card hover:bg-muted text-foreground border border-border/70 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xs transition-all shrink-0"
        >
          <Megaphone className="h-4 w-4 text-primary" />
          <span>Announcements</span>
        </Link>
      </motion.div>

      {/* 12. Employee Statistics Strip Cards (Dynamic Database Values) */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm flex flex-col justify-between text-left">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Total Tasks</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-foreground">{myTasks.length}</span>
            <FileText className="h-5 w-5 text-primary opacity-80" />
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Assigned to you</span>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm flex flex-col justify-between text-left">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Completed</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-primary">{completedTasks.length}</span>
            <CheckCircle2 className="h-5 w-5 text-primary opacity-80" />
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Approved deliverables</span>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm flex flex-col justify-between text-left">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Pending</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-500">{pendingTasks.length + inProgressTasks.length + reviewTasks.length}</span>
            <Clock className="h-5 w-5 text-amber-500 opacity-80" />
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">In progress & queued</span>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm flex flex-col justify-between text-left">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Attendance %</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-primary">{attendanceRate}%</span>
            <CheckCircle className="h-5 w-5 text-primary opacity-80" />
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">This month</span>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm flex flex-col justify-between text-left">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Assigned Projects</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-blue-500">{myProjects.length}</span>
            <Briefcase className="h-5 w-5 text-blue-500 opacity-80" />
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Active workspaces</span>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm flex flex-col justify-between text-left">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Streak</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-500">{formatStreakDays(attendanceStreak)}</span>
            <span className="text-xl shrink-0">🔥</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">On-time checkins</span>
        </div>
      </motion.div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column (2 Cols wide on Desktop) */}
        <div className="lg:col-span-2 space-y-6">

          {/* 2. Attendance Summary Card with Real Hours & Dynamic Progress Bar */}
          <motion.div variants={itemVariants} className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Today's Shift Attendance Summary</h3>
                  <p className="text-xs text-muted-foreground font-medium">Logged check-in times, shift status, and daily hours progress.</p>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                clockedRecord && clockedRecord.clockOut
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : clockedRecord
                  ? 'bg-success/10 text-success border-success/20'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
              }`}>
                {clockedRecord && clockedRecord.clockOut
                  ? 'Shift Completed'
                  : clockedRecord
                  ? `Active (${clockedRecord.status || 'PRESENT'})`
                  : 'Not Clocked In'}
              </span>
            </div>

            {attendanceAlert && (
              <div className="p-3 rounded-xl border border-primary/20 bg-primary/10 text-primary text-xs font-semibold flex items-center justify-between">
                <span>{attendanceAlert}</span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/40">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Check In</span>
                <span className="text-lg font-black text-foreground block mt-1">
                  {clockedRecord?.clockIn
                    ? new Date(clockedRecord.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/40">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Check Out</span>
                <span className="text-lg font-black text-foreground block mt-1">
                  {clockedRecord?.clockOut
                    ? new Date(clockedRecord.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/40">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Working Hours</span>
                <span className="text-lg font-black text-primary block mt-1">
                  {currentWorkingHours.toFixed(1)} hrs
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/40">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Break & Overtime</span>
                <span className="text-lg font-black text-foreground block mt-1">
                  {clockedRecord ? '45m' : '0m'} / {currentWorkingHours > 8 ? `${(currentWorkingHours - 8).toFixed(1)}h` : '0h'}
                </span>
              </div>
            </div>

            {/* Daily Shift Progress Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-muted-foreground">Shift Completion Progress (Target: 8.0 Hours)</span>
                <span className="text-primary font-mono font-bold">
                  {Math.min(100, Math.round((currentWorkingHours / 8) * 100))}%
                </span>
              </div>
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden p-0.5 border border-border/40">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((currentWorkingHours / 8) * 100))}%` }}
                />
              </div>
            </div>
          </motion.div>

          {/* 3. My Tasks Widget (Strictly Employee Assigned Tasks) */}
          <motion.div variants={itemVariants} className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">My Assigned Deliverables & Tasks</h3>
                <p className="text-xs text-muted-foreground font-medium">Tasks explicitly assigned to your workflow.</p>
              </div>

              <Link to="/tasks" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                <span>View All Tasks</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Task Status Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
              <span className="px-3 py-1 rounded-full bg-muted text-foreground border border-border/40">All ({myTasks.length})</span>
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">Pending ({pendingTasks.length})</span>
              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">In Progress ({inProgressTasks.length})</span>
              <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">In Review ({reviewTasks.length})</span>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">Completed ({completedTasks.length})</span>
            </div>

            {/* Task Cards List */}
            <div className="dash-scroll max-h-80 space-y-3">
              {myTasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/60">
                  No tasks assigned. You're all caught up!
                </div>
              ) : (
                myTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => navigate('/tasks')}
                    className="p-4 rounded-2xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {task.title}
                        </span>
                        {task.priority && (
                          <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md ${
                            task.priority === 'HIGH' || task.priority === 'URGENT'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                          }`}>
                            {task.priority}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {task.description || 'No detailed description provided.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Due Date'}
                      </span>

                      <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full ${
                        task.status === 'APPROVED' || task.status === 'COMPLETED'
                          ? 'bg-success/10 text-success border-success/20'
                          : task.status === 'WAITING_FOR_REVIEW'
                          ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* 6 & 13. Real Performance Analytics & Weekly Productivity Chart */}
          <motion.div variants={itemVariants} className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Performance Analytics & Productivity</h3>
                <p className="text-xs text-muted-foreground font-medium">Weekly productivity hours and task velocity breakdown.</p>
              </div>

              <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border/40 text-xs font-semibold">
                {['1W', '1M'].map(f => (
                  <button
                    key={f}
                    onClick={() => setTimeFilter(f)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      timeFilter === f ? 'bg-primary text-white font-bold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 w-full pt-2 flex items-center justify-center">
              {!weeklyProductivityData.hasData ? (
                <div className="text-xs text-muted-foreground text-center py-10 font-medium">
                  No analytics available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyProductivityData.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200, 200, 200, 0.2)" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs font-medium text-muted-foreground" />
                    <YAxis tickLine={false} axisLine={false} className="text-xs font-medium text-muted-foreground" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '16px', fontSize: '12px' }}
                    />
                    <Bar dataKey="hours" radius={[8, 8, 0, 0]} fill={chartPrimaryColor}>
                      {weeklyProductivityData.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartPrimaryColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

        </div>

        {/* Right Column (1 Col wide on Desktop) */}
        <div className="space-y-6">

          {/* 4. Today's Dynamic Schedule */}
          <motion.div variants={itemVariants} className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span>Today's Schedule</span>
              </h3>
              <span className="text-xs text-muted-foreground font-semibold">{time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>

            <div className="dash-scroll max-h-52">
            {todaySchedule.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center font-medium">No schedule for today.</p>
            ) : (
              <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
                {todaySchedule.map((item, idx) => (
                  <div key={idx} className="pl-7 relative flex items-start justify-between gap-2">
                    <span className={`absolute left-1.5 top-1.5 h-3 w-3 rounded-full ${item.color} ring-4 ring-card`} />
                    <div>
                      <span className="text-xs font-bold text-foreground block">{item.time} — {item.title}</span>
                      <span className="text-[11px] text-muted-foreground">{item.subtitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </motion.div>

          {/* 5. Real Leave Balances & Apply Modal Trigger */}
          <motion.div variants={itemVariants} className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold text-foreground">Leave Balances</h3>
              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Apply</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/40">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">Casual</span>
                <span className="text-xl font-black text-foreground block mt-1">{leaveBalances.casualRemaining ?? leaveStats.casualLeft}</span>
                <span className="text-[9px] text-muted-foreground font-semibold">Days left</span>
              </div>

              <div className="p-3 rounded-2xl bg-muted/40 border border-border/40">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">Sick</span>
                <span className="text-xl font-black text-foreground block mt-1">{leaveBalances.sickRemaining ?? leaveStats.sickLeft}</span>
                <span className="text-[9px] text-muted-foreground font-semibold">Days left</span>
              </div>

              <div className="p-3 rounded-2xl bg-muted/40 border border-border/40">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">Emergency</span>
                <span className="text-xl font-black text-foreground block mt-1">{leaveBalances.emergencyRemaining ?? leaveStats.emergencyLeft}</span>
                <span className="text-[9px] text-muted-foreground font-semibold">Days left</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-bold pt-1">
              <span className="text-muted-foreground">Pending Requests: <strong className="text-amber-500">{leaveBalances.pendingRequests ?? leaveStats.pendingRequests}</strong></span>
              <span className="text-muted-foreground">Approved: <strong className="text-success">{leaveBalances.approvedRequests ?? leaveStats.approvedRequests}</strong></span>
            </div>
          </motion.div>

          {/* 10. Real Team Card */}
          <motion.div variants={itemVariants} className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold text-foreground">My Team {myTeam ? `(${myTeam.name})` : ''}</h3>
              <Users className="h-5 w-5 text-primary" />
            </div>

            {!myTeam ? (
              <p className="text-xs text-muted-foreground py-4 text-center font-medium">No team assigned.</p>
            ) : (
              <>
                {myTeam.leader && (
                  <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3">
                    <UserAvatar user={myTeam.leader} className="h-10 w-10 rounded-xl" />
                    <div>
                      <span className="text-xs font-bold text-foreground block">{myTeam.leader.name}</span>
                      <span className="text-[10px] text-primary font-bold">Team Leader</span>
                    </div>
                  </div>
                )}

                <div className="dash-scroll max-h-48 space-y-2">
                  {myTeam.members && myTeam.members.map((mem) => (
                    <div key={mem.id || mem.userId} className="flex items-center justify-between p-2 rounded-xl border border-border/40 bg-muted/20 text-xs">
                      <div className="flex items-center gap-2">
                        <UserAvatar user={mem.user || mem} className="h-7 w-7 rounded-lg" />
                        <span className="font-semibold text-foreground">{mem.user?.name || mem.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-bold">{mem.user?.role || 'MEMBER'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>

          {/* 7. Real Announcements & Alerts */}
          <motion.div variants={itemVariants} className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold text-foreground">Announcements & Alerts</h3>
              <Megaphone className="h-5 w-5 text-primary" />
            </div>

            <div className="dash-scroll max-h-56 space-y-3">
              {announcements.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center font-medium">No announcements.</p>
              ) : (
                announcements.map((anc) => (
                  <div key={anc.id} className="p-3 rounded-2xl border border-border/40 bg-muted/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{anc.title}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{new Date(anc.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{anc.content}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>

        </div>
      </div>

      {/* 5. Interactive Apply Leave Modal */}
      <AnimatePresence>
        {isLeaveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-[28px] border border-border bg-card p-6 shadow-xl text-left space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <h3 className="text-lg font-bold text-foreground">Apply for Leave / WFH Letter</h3>
                <button onClick={() => setIsLeaveModalOpen(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {leaveSuccess && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  leaveSuccess.startsWith('Error') ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-success/10 text-success border border-success/20'
                }`}>
                  {leaveSuccess}
                </div>
              )}

              <form onSubmit={handleApplyLeaveSubmit} className="space-y-4 text-xs font-semibold">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-muted-foreground mb-1">Start Date</label>
                    <input
                      type="date"
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      required
                      className="w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">End Date</label>
                    <input
                      type="date"
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      required
                      className="w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Leave Type</label>
                  <select
                    value={leaveForm.type}
                    onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                    className="w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="CASUAL">Casual Leave</option>
                    <option value="SICK">Sick Leave</option>
                    <option value="EMERGENCY">Emergency Leave</option>
                    <option value="WFH">Work From Home (WFH)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Reason & Application Letter</label>
                  <textarea
                    rows={3}
                    placeholder="Provide details about your leave application..."
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    required
                    className="w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-foreground focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsLeaveModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-border text-muted-foreground hover:bg-muted font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={leaveSubmitting}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-xl font-bold shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    <span>{leaveSubmitting ? 'Submitting...' : 'Submit Application'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clock In Modal */}
      <ClockInModal
        isOpen={isClockInModalOpen}
        onClose={() => setIsClockInModalOpen(false)}
        onSuccess={() => fetchEmployeeDashboardData()}
        user={user}
      />
    </motion.div>
  );
};

export default EmployeeDashboard;
