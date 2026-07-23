import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Clock,
  Ticket,
  Megaphone,
  BarChart3,
  History,
  User as UserIcon,
  LogOut,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Layers,
  FileText,
  Code,
  Settings,
  Calendar,
  Mail,
  HelpCircle,
  Search
} from 'lucide-react';

import { getUploadUrl } from '../../services/api';

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markRead, markAllAsRead, deleteNotification } = useSocket();

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(localStorage.getItem('sidebar_collapsed') === 'true');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const currentFull = location.pathname + location.search;

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Handle popup notifications
  useEffect(() => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length > 0) {
      const latest = unread[0];
      setToastMessage({ title: latest.title, message: latest.message });
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const toggleCollapse = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    localStorage.setItem('sidebar_collapsed', String(nextVal));
  };

  const [openCategories, setOpenCategories] = useState({
    Overview: true,
    Workspaces: true,
    Operations: true,
    'System Control': true
  });

  const toggleCategory = (title) => {
    setOpenCategories(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const categories = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN'] },
        { label: 'My Profile', path: '/profile', icon: UserIcon, roles: ['ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN'] }
      ]
    },
    {
      title: 'Workspaces',
      items: [
        { label: 'Active Board', path: '/tasks?tab=Board', icon: Layers, roles: ['ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN'] },
        { label: 'Backlog', path: '/tasks?tab=Backlog', icon: FileText, roles: ['ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN'] },
        { label: 'Roadmap', path: '/tasks?tab=Timeline', icon: Calendar, roles: ['ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN'] },
        { label: 'Repositories', path: '/tasks?tab=Code', icon: Code, roles: ['ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN'] },
        { label: 'Integrations', path: '/tasks?tab=Development', icon: Settings, roles: ['ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN'] }
      ]
    },
    {
      title: 'Operations',
      items: [
        { label: 'Attendance Portal', path: '/attendance', icon: Clock, roles: ['INTERN', 'TEAM_LEADER', 'EMPLOYEE'] },
        { label: 'Attendance Audit', path: '/attendance-audit', icon: Clock, roles: ['ADMIN', 'TEAM_LEADER'] },
        { label: 'Ticket Desk', path: '/tickets', icon: Ticket, roles: ['ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN'] },
        { label: 'Announcements', path: '/announcements', icon: Megaphone, roles: ['ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN'] }
      ]
    },
    {
      title: 'System Control',
      items: [
        { label: 'Intern Registry', path: '/interns', icon: Users, roles: ['ADMIN'] },
        { label: 'Employee Registry', path: '/employees', icon: Users, roles: ['ADMIN'] },
        { label: 'Team Leader Registry', path: '/team-leaders', icon: Users, roles: ['ADMIN'] },
        { label: 'Team Hub', path: '/teams', icon: Briefcase, roles: ['ADMIN', 'EMPLOYEE', 'TEAM_LEADER', 'INTERN'] },
        { label: 'Report Center', path: '/reports', icon: BarChart3, roles: ['ADMIN', 'TEAM_LEADER'] },
        { label: 'Audit Logs', path: '/audit-logs', icon: History, roles: ['ADMIN'] },
        { label: 'Site Settings', path: '/settings', icon: ShieldCheck, roles: ['ADMIN'] }
      ]
    }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNotificationClick = (notif) => {
    markRead(notif.id);
    setNotifOpen(false);

    if (notif.type.startsWith('TASK')) {
      navigate('/tasks');
    } else if (notif.type.startsWith('TICKET')) {
      navigate('/tickets');
    } else if (notif.type.startsWith('NEW_ANNOUNCEMENT')) {
      navigate('/announcements');
    }
  };

  // Breadcrumb generation based on current path + query params
  const getBreadcrumbs = () => {
    const parts = [{ label: 'Portal', path: '/' }];
    const pathname = location.pathname;
    const query = new URLSearchParams(location.search);
    const tab = query.get('tab');

    if (pathname === '/profile') {
      parts.push({ label: 'My Profile', path: '/profile' });
    } else if (pathname === '/attendance') {
      parts.push({ label: 'Operations', path: '/attendance' });
      parts.push({ label: 'Attendance Portal', path: '/attendance' });
    } else if (pathname === '/attendance-audit') {
      parts.push({ label: 'Operations', path: '/attendance-audit' });
      parts.push({ label: 'Attendance Audit', path: '/attendance-audit' });
    } else if (pathname === '/interns') {
      parts.push({ label: 'System Control', path: '/interns' });
      parts.push({ label: 'Intern Registry', path: '/interns' });
    } else if (pathname === '/team-leaders') {
      parts.push({ label: 'System Control', path: '/team-leaders' });
      parts.push({ label: 'Team Leader Registry', path: '/team-leaders' });
    } else if (pathname === '/employees') {
      parts.push({ label: 'System Control', path: '/employees' });
      parts.push({ label: 'Employee Registry', path: '/employees' });
    } else if (pathname === '/teams') {
      parts.push({ label: 'System Control', path: '/teams' });
      parts.push({ label: 'Team Hub', path: '/teams' });
    } else if (pathname === '/tickets') {
      parts.push({ label: 'Operations', path: '/tickets' });
      parts.push({ label: 'Ticket Desk', path: '/tickets' });
    } else if (pathname === '/announcements') {
      parts.push({ label: 'Operations', path: '/announcements' });
      parts.push({ label: 'Announcements', path: '/announcements' });
    } else if (pathname === '/reports') {
      parts.push({ label: 'System Control', path: '/reports' });
      parts.push({ label: 'Report Center', path: '/reports' });
    } else if (pathname === '/audit-logs') {
      parts.push({ label: 'System Control', path: '/audit-logs' });
      parts.push({ label: 'Audit Logs', path: '/audit-logs' });
    } else if (pathname === '/settings') {
      parts.push({ label: 'System Control', path: '/settings' });
      parts.push({ label: 'Site Settings', path: '/settings' });
    } else if (pathname === '/tasks') {
      parts.push({ label: 'Workspaces', path: '/tasks' });
      parts.push({ label: tab ? `${tab}` : 'Active Board', path: currentFull });
    }
    return parts;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar for Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-40 border-r border-border/60 bg-card font-sans transition-all duration-300 md:translate-x-0 md:relative flex flex-col justify-between ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div>
          {/* Logo Header */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-border/40 font-sans">
            <Link to="/" className="flex items-center gap-3">
              {isCollapsed ? (
                <div className="w-9 h-9 overflow-hidden relative rounded-xl border border-border/40 flex items-center justify-center bg-white shadow-sm">
                  <img
                    src="/logo.png"
                    alt="INNOVEITY Icon"
                    className="absolute left-1 max-w-none h-6"
                    style={{ width: '120.9px' }}
                  />
                </div>
              ) : (
                <img src="/logo.png" alt="INNOVEITY" className="h-11 object-contain" />
              )}
            </Link>
            <button className="rounded-lg p-1.5 hover:bg-muted md:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Items grouped by collapsible categories */}
          <nav className="flex-1 space-y-4 px-3 py-6 overflow-y-auto max-h-[calc(100vh-8rem)] font-sans">
            {categories.map((cat) => {
              const filteredItems = cat.items.filter(item => item.roles.includes(user?.role));
              if (filteredItems.length === 0) return null;
              const isCategoryOpen = openCategories[cat.title] !== false;

              return (
                <div key={cat.title} className="space-y-1">
                  {!isCollapsed ? (
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat.title)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors rounded-lg hover:bg-muted/40"
                    >
                      <span>{cat.title}</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isCategoryOpen ? 'rotate-0' : '-rotate-90'}`} />
                    </button>
                  ) : (
                    <div className="border-t border-border/40 my-2" />
                  )}

                  {(isCollapsed || isCategoryOpen) && (
                    <div className="space-y-1 pt-0.5">
                      {filteredItems.map((item) => {
                        const Icon = item.icon;
                        const itemPathBase = item.path.split('?')[0];
                        const isActive = currentFull === item.path || (itemPathBase === '/tasks' && location.pathname === '/tasks' && !location.search && item.label === 'Active Board');

                        return (
                          <Link
                            key={item.label}
                            to={item.path}
                            title={isCollapsed ? item.label : undefined}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all relative group ${isActive
                                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 font-bold'
                                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                              }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <Icon className="h-4.5 w-4.5 shrink-0" />
                            {!isCollapsed && <span>{item.label}</span>}
                            {isActive && !isCollapsed && <ChevronRight className="ml-auto h-4 w-4" />}
                            {isCollapsed && (
                              <div className="absolute left-16 bg-slate-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">
                                {item.label}
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer collapse toggle button */}
        <div className="p-4 border-t border-border/40 flex justify-center">
          <button
            onClick={toggleCollapse}
            className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted text-muted-foreground transition-all"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/40 bg-card/75 px-6 backdrop-blur-md">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-4">
            <button className="rounded-lg p-1.5 hover:bg-muted md:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-muted-foreground/40 font-bold">/</span>}
                  <Link
                    to={crumb.path}
                    className={`hover:text-foreground capitalize ${idx === breadcrumbs.length - 1 ? 'text-foreground font-bold' : ''}`}
                  >
                    {crumb.label.toLowerCase()}
                  </Link>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Search bar, tools & user profile */}
          <div className="flex items-center gap-4">
            {/* Global Search Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  navigate(`/tasks?search=${encodeURIComponent(searchQuery)}`);
                }
              }}
              className="relative hidden md:block"
            >
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search resources, tasks, modules... (Press Enter)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9 pr-4 py-1.5 text-sm rounded-xl border bg-muted/30 focus:bg-card transition-all"
              />
            </form>

            {/* Dark Mode Toggle */}
            <button onClick={toggleTheme} className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            {/* Help Hub */}
            <button className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-all hidden sm:block">
              <HelpCircle className="h-5 w-5" />
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="relative rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white ring-2 ring-card animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 mt-2.5 z-40 w-80 rounded-2xl border border-border/60 bg-card p-2 shadow-lg shadow-black/5 animate-in fade-in slide-in-from-top-3 duration-200">
                    <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
                      <span className="text-xs font-bold">Workspace Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="text-[10px] text-primary hover:underline font-bold">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <CheckCircle2 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                          <span className="text-xs text-muted-foreground">All caught up!</span>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className={`flex flex-col gap-1 rounded-xl p-2.5 hover:bg-muted cursor-pointer transition-all ${!notif.isRead ? 'bg-primary/5 font-semibold' : ''}`}
                            onClick={() => handleNotificationClick(notif)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs text-foreground font-semibold">{notif.title}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notif.id);
                                }}
                                className="text-muted-foreground hover:text-danger rounded p-0.5"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{notif.message}</p>
                            <span className="text-[9px] text-muted-foreground/60">{new Date(notif.createdAt).toLocaleTimeString()}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 rounded-xl p-1 hover:bg-muted transition-all">
                <img
                  src={user?.profilePic ? getUploadUrl(user.profilePic) : `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`}
                  alt={user?.name}
                  className="h-8 w-8 rounded-lg object-cover ring-2 ring-primary/20"
                />
                <div className="hidden text-left md:block pr-1">
                  <p className="text-xs font-extrabold leading-none">{user?.name}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 capitalize leading-none">{user?.role?.replace('_', ' ').toLowerCase()}</p>
                </div>
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2.5 z-40 w-56 rounded-2xl border border-border/60 bg-card p-2 shadow-lg shadow-black/5 animate-in fade-in slide-in-from-top-3 duration-200">
                    <div className="px-3 py-2.5 border-b border-border/30 mb-1.5 text-left">
                      <p className="text-xs font-bold text-foreground">{user?.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                      <span className="mt-1.5 inline-block text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-extrabold uppercase">{user?.role}</span>
                    </div>

                    <Link to="/profile" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground font-semibold" onClick={() => setProfileOpen(false)}>
                      <UserIcon className="h-4 w-4" />
                      <span>My Profile</span>
                    </Link>
                    {user?.role === 'ADMIN' && (
                      <Link to="/settings" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground font-semibold" onClick={() => setProfileOpen(false)}>
                        <Settings className="h-4 w-4" />
                        <span>Site Settings</span>
                      </Link>
                    )}
                    <hr className="my-1 border-border/40" />
                    <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-danger hover:bg-danger/5 font-bold">
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic content rendering */}
        <main className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50/50 dark:bg-slate-900/40">
          {children}
        </main>
      </div>

      {/* Toast Alert Popup */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex max-w-sm gap-3 rounded-2xl border border-primary/20 bg-card p-4 shadow-2xl animate-in slide-in-from-bottom duration-300 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-5 w-5 animate-bounce" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">{toastMessage.title}</h4>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{toastMessage.message}</p>
          </div>
          <button onClick={() => setToastMessage(null)} className="ml-auto rounded-lg p-1 hover:bg-muted self-start">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
