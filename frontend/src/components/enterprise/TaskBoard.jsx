import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare, Plus, Search, Filter, MessageSquare, Clock,
  Calendar, AlertCircle, Trash2, Eye, LayoutGrid, List,
  Send, RefreshCw, X, ChevronRight, ArrowUpDown
} from 'lucide-react';
import api from '../../services/api';
import { useCompanyScope } from '../../context/CompanyScopeContext';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLUMNS = [
  { key: 'PENDING', label: 'To Do', color: 'border-amber-500/40 bg-amber-500/5', badge: 'bg-amber-500/10 text-amber-400' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: 'border-blue-500/40 bg-blue-500/5', badge: 'bg-blue-500/10 text-blue-400' },
  { key: 'WAITING_FOR_REVIEW', label: 'In Review', color: 'border-purple-500/40 bg-purple-500/5', badge: 'bg-purple-500/10 text-purple-400' },
  { key: 'COMPLETED', label: 'Done', color: 'border-emerald-500/40 bg-emerald-500/5', badge: 'bg-emerald-500/10 text-emerald-400' }
];

const PRIORITY_BADGES = {
  LOW: 'bg-slate-700/60 text-slate-300 border-slate-600',
  MEDIUM: 'bg-blue-900/40 text-blue-300 border-blue-600/40',
  HIGH: 'bg-orange-900/40 text-orange-300 border-orange-600/40',
  URGENT: 'bg-rose-900/40 text-rose-300 border-rose-600/40'
};

const TaskBoard = () => {
  const { selectedOrgId } = useCompanyScope();
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & Panels
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    deadline: '',
    assigneeId: ''
  });

  const fetchTasks = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get('/enterprise/tasks', {
        params: {
          search,
          priority: priorityFilter,
          status: statusFilter
        }
      });
      if (res.data?.success) {
        setTasks(res.data.tasks || []);
      }
    } catch (err) {
      console.error('Error fetching internal tasks:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/enterprise/lifecycle/roster');
      if (res.data?.success) {
        setEmployees(res.data.employees || []);
      }
    } catch (err) {
      // Fallback or silently handle
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
  }, [selectedOrgId, priorityFilter, statusFilter]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setSubmittingTask(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/enterprise/tasks', formData);
      if (res.data?.success) {
        setCreateModalOpen(false);
        setFormData({
          title: '',
          description: '',
          priority: 'MEDIUM',
          deadline: '',
          assigneeId: ''
        });
        fetchTasks();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create task');
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await api.patch(`/enterprise/tasks/${taskId}/status`, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/enterprise/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (selectedTask?.id === taskId) {
        setDetailsModalOpen(false);
        setSelectedTask(null);
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const openTaskDetails = async (task) => {
    setSelectedTask(task);
    setDetailsModalOpen(true);
    try {
      const res = await api.get(`/enterprise/tasks/${task.id}`);
      if (res.data?.success) {
        setSelectedTask(res.data.task);
        setComments(res.data.task.comments || []);
      }
    } catch (err) {
      console.error('Failed to fetch full task details:', err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedTask) return;
    setSubmittingComment(true);
    try {
      const res = await api.post(`/enterprise/tasks/${selectedTask.id}/comments`, {
        text: newCommentText
      });
      if (res.data?.success) {
        setComments(prev => [...prev, res.data.comment]);
        setNewCommentText('');
        // Update commentCount in list
        setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, commentCount: (t.commentCount || 0) + 1 } : t));
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      t.title?.toLowerCase().includes(term) ||
      t.description?.toLowerCase().includes(term) ||
      t.assignee?.name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20 text-white">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Internal Task Assignment</h1>
              <p className="text-sm text-slate-400">Collaborative operational task tracking with lightweight workflows</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                viewMode === 'kanban' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
          </div>

          <button
            onClick={() => {
              setFormData({
                title: '',
                description: '',
                priority: 'MEDIUM',
                deadline: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 16),
                assigneeId: ''
              });
              setCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-cyan-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800 backdrop-blur-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks, descriptions, assignees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_REVIEW">In Review</option>
              <option value="COMPLETED">Done</option>
            </select>
          </div>

          <button
            onClick={fetchTasks}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition"
            title="Refresh Tasks"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Task View */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {STATUS_COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter(t => t.status === col.key);
            return (
              <div
                key={col.key}
                className="flex flex-col bg-slate-900/50 rounded-2xl border border-slate-800/80 p-4 min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-200">{col.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${col.badge}`}>
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Task Cards Container */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[680px] pr-1">
                  {colTasks.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                      No tasks in {col.label}
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <motion.div
                        layout
                        key={task.id}
                        onClick={() => openTaskDetails(task)}
                        className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/40 rounded-xl p-3.5 shadow-sm hover:shadow-cyan-500/5 transition cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.MEDIUM}`}>
                            {task.priority}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <select
                              onClick={(e) => e.stopPropagation()}
                              value={task.status}
                              onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                              className="text-[11px] bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none"
                            >
                              <option value="PENDING">To Do</option>
                              <option value="IN_PROGRESS">Progress</option>
                              <option value="WAITING_FOR_REVIEW">Review</option>
                              <option value="COMPLETED">Done</option>
                            </select>
                          </div>
                        </div>

                        <h4 className="text-sm font-semibold text-slate-200 mb-1 group-hover:text-cyan-300 transition line-clamp-2">
                          {task.title}
                        </h4>

                        {task.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            {task.assignee ? (
                              <div className="flex items-center gap-1.5" title={task.assignee.name}>
                                <div className="w-5 h-5 rounded-full bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-[10px] text-cyan-300 font-bold">
                                  {task.assignee.name.charAt(0)}
                                </div>
                                <span className="text-[11px] truncate max-w-[80px]">{task.assignee.name}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">Unassigned</span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            {task.commentCount > 0 && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <MessageSquare className="w-3 h-3 text-cyan-400" />
                                <span>{task.commentCount}</span>
                              </div>
                            )}

                            {task.deadline && (
                              <div className={`flex items-center gap-1 text-[11px] ${
                                new Date(task.deadline) < new Date() && task.status !== 'COMPLETED'
                                  ? 'text-rose-400 font-semibold'
                                  : 'text-slate-400'
                              }`}>
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Task</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Comments</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      No tasks found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => openTaskDetails(task)}
                      className="hover:bg-slate-800/50 transition cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200 group-hover:text-cyan-400 transition">
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-xs text-slate-400 line-clamp-1">{task.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                          className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-cyan-500"
                        >
                          <option value="PENDING">To Do</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="WAITING_FOR_REVIEW">In Review</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.MEDIUM}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-xs text-cyan-300 font-bold">
                              {task.assignee.name.charAt(0)}
                            </div>
                            <span className="text-slate-300 text-xs">{task.assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {task.deadline ? (
                          <span className={new Date(task.deadline) < new Date() && task.status !== 'COMPLETED' ? 'text-rose-400 font-medium' : 'text-slate-400'}>
                            {new Date(task.deadline).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{task.commentCount || 0}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-800">
                <div className="flex items-center gap-2 text-white font-bold text-lg">
                  <CheckSquare className="w-5 h-5 text-cyan-400" />
                  <span>Create Internal Task</span>
                </div>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Prepare Monthly Compliance Checklist"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide details, scope, or instructions..."
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Due Date *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Assignee
                  </label>
                  <select
                    value={formData.assigneeId}
                    onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Unassigned --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.department || 'Employee'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTask}
                    className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition"
                  >
                    {submittingTask && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Create Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Details & Comments Drawer / Modal */}
      <AnimatePresence>
        {detailsModalOpen && selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${PRIORITY_BADGES[selectedTask.priority] || PRIORITY_BADGES.MEDIUM}`}>
                      {selectedTask.priority}
                    </span>
                    <select
                      value={selectedTask.status}
                      onChange={(e) => handleUpdateStatus(selectedTask.id, e.target.value)}
                      className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
                    >
                      <option value="PENDING">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="WAITING_FOR_REVIEW">In Review</option>
                      <option value="COMPLETED">Done</option>
                    </select>
                  </div>
                  <h3 className="text-lg font-bold text-white leading-snug">{selectedTask.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteTask(selectedTask.id)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    title="Delete Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDetailsModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Meta details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-slate-950/40 rounded-xl border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-1">Assignee</span>
                    <span className="font-semibold text-slate-300">
                      {selectedTask.assignee?.name || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Due Date</span>
                    <span className="font-semibold text-slate-300">
                      {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleString() : 'No date'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Created By</span>
                    <span className="font-semibold text-slate-300">
                      {selectedTask.creator?.name || 'System'}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
                  <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {selectedTask.description || 'No description provided.'}
                  </div>
                </div>

                {/* Comments Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-semibold text-white">Comments & Discussion</h4>
                    <span className="text-xs text-slate-500 font-mono">({comments.length})</span>
                  </div>

                  {/* Comment list */}
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {comments.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">No comments yet. Start the conversation!</p>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-cyan-300">{comment.user?.name || 'Team Member'}</span>
                            <span className="text-slate-500 text-[10px]">
                              {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300">{comment.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add comment box */}
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Write an operational note or comment..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="flex-1 px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="submit"
                      disabled={submittingComment || !newCommentText.trim()}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Post
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaskBoard;
