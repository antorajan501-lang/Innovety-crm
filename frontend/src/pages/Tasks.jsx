import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api, { getUploadUrl, downloadFile } from '../services/api';
import confetti from 'canvas-confetti';
import {
  Download,
  Plus,
  Calendar,
  Layers,
  ChevronRight,
  Clock,
  MessageSquare,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Upload,
  User,
  Users,
  Settings,
  MoreHorizontal,
  FolderOpen,
  Filter,
  FileText,
  Code as CodeIcon,
  Sun,
  Moon,
  Search,
  CheckSquare,
  Bookmark,
  Bug,
  Trash2
} from 'lucide-react';

const Tasks = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [viewMode, setViewMode] = useState('kanban'); // kanban or calendar
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  
  // Theme state
  const [theme, setTheme] = useState(document.documentElement.classList.contains('dark') ? 'dark' : 'light');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Form states
  const [assignType, setAssignType] = useState('INDIVIDUAL'); // INDIVIDUAL or TEAM
  const [createFormData, setCreateFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    deadline: '',
    assigneeId: '',
    teamId: '',
    type: 'TASK',
    storyPoints: 0,
    sprintName: ''
  });
  const [taskFiles, setTaskFiles] = useState([]);

  // Edit task states
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    deadline: '',
    assigneeId: '',
    status: 'PENDING',
    type: 'TASK',
    storyPoints: 0,
    sprintName: ''
  });

  // Submissions form
  const [submitNotes, setSubmitNotes] = useState('');
  const [submitFiles, setSubmitFiles] = useState([]);
  
  // Comments
  const [commentText, setCommentText] = useState('');

  // active sub-tab
  const [activeSubTab, setActiveSubTab] = useState('Board');

  // Filter queries
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  // Drag highlight state
  const [activeDragCol, setActiveDragCol] = useState(null);

  // Subtask input state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Git Repositories states
  const [repositories, setRepositories] = useState([]);
  const [newRepoForm, setNewRepoForm] = useState({ name: '', url: '', lang: 'React/JS' });
  const [showAddRepo, setShowAddRepo] = useState(false);
  
  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Custom Prompt Modal state
  const [promptModal, setPromptModal] = useState({
    isOpen: false,
    title: '',
    placeholder: '',
    value: '',
    onConfirm: null
  });

  const subTabs = ['Summary', 'Backlog', 'Board', 'Code', 'Timeline', 'Docs', 'Forms', 'Development'];

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tasks');
      setTasks(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setAlertMsg('Failed to load tasks.');
      setLoading(false);
    }
  };

  const fetchRepositories = async () => {
    try {
      const res = await api.get('/repositories');
      setRepositories(res.data || []);
    } catch (err) {
      console.error('Failed to load repositories:', err);
    }
  };

  const handleRegisterRepo = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/repositories', newRepoForm);
      setRepositories([...repositories, res.data]);
      setNewRepoForm({ name: '', url: '', lang: 'React/JS' });
      setShowAddRepo(false);
      setAlertMsg('Git repository registered successfully.');
    } catch (err) {
      setAlertMsg(err.response?.data?.message || 'Failed to register repository.');
    }
  };

  const handleDeleteRepo = (repoId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Repository Link',
      message: 'Are you sure you want to delete this repository link?',
      onConfirm: async () => {
        try {
          await api.delete(`/repositories/${repoId}`);
          setRepositories(repositories.filter(r => r.id !== repoId));
          setAlertMsg('Repository link removed successfully.');
        } catch (err) {
          setAlertMsg('Failed to delete repository.');
        }
      }
    });
  };

  const handleCreateBranch = async (repoId, name) => {
    try {
      const res = await api.post(`/repositories/${repoId}/branches`, { name });
      setRepositories(repositories.map(r => {
        if (r.id === repoId) {
          return {
            ...r,
            branches: [...(r.branches || []), res.data]
          };
        }
        return r;
      }));
      setAlertMsg(`Branch '${name}' registered successfully.`);
    } catch (err) {
      setAlertMsg(err.response?.data?.message || 'Failed to create branch.');
    }
  };

  const handleDeleteBranch = (repoId, branchId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Branch',
      message: 'Are you sure you want to delete this branch?',
      onConfirm: async () => {
        try {
          await api.delete(`/repositories/${repoId}/branches/${branchId}`);
          setRepositories(repositories.map(r => {
            if (r.id === repoId) {
              return {
                ...r,
                branches: r.branches.filter(b => b.id !== branchId)
              };
            }
            return r;
          }));
          setAlertMsg('Branch removed successfully.');
        } catch (err) {
          setAlertMsg('Failed to delete branch.');
        }
      }
    });
  };

  const fetchTeamMembers = async () => {
    try {
      if (user?.role === 'ADMIN') {
        const res = await api.get('/users?limit=100&status=ACTIVE');
        const assignable = (res.data.users || []).filter(u => u.role === 'TEAM_LEADER' || u.role === 'INTERN' || u.role === 'EMPLOYEE');
        setTeamMembers(assignable);
      } else {
        const res = await api.get('/users?role=INTERN&status=ACTIVE');
        const internMembers = (res.data.users || []);
        const empRes = await api.get('/users?role=EMPLOYEE&status=ACTIVE');
        const empMembers = (empRes.data.users || []);
        setTeamMembers([...internMembers, ...empMembers]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await api.get('/teams');
      setTeams(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchRepositories();
    if (user.role === 'ADMIN' || user.role === 'TEAM_LEADER') {
      fetchTeamMembers();
      fetchTeams();
    }
  }, [user]);

  // Synchronize active tab from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      const match = subTabs.find(t => t.toLowerCase() === tabParam.toLowerCase());
      if (match) {
        setActiveSubTab(match);
      }
    }
  }, [location]);

  // Handle Drag & Drop
  const onDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = async (e, targetTitle) => {
    setActiveDragCol(null);
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    let targetStatus = 'PENDING';
    if (targetTitle === 'IN PROGRESS') targetStatus = 'IN_PROGRESS';
    if (targetTitle === 'IN REVIEW') targetStatus = 'WAITING_FOR_REVIEW';
    if (targetTitle === 'DONE') targetStatus = 'APPROVED';

    // Validate role permissions
    if ((user.role === 'INTERN' || user.role === 'EMPLOYEE') && task.assigneeId !== user.id) return;
    if ((user.role === 'INTERN' || user.role === 'EMPLOYEE') && !['IN_PROGRESS', 'WAITING_FOR_REVIEW'].includes(targetStatus)) {
      return; 
    }

    try {
      await api.put(`/tasks/${taskId}/status`, { status: targetStatus });
      fetchTasks();
      if (targetStatus === 'WAITING_FOR_REVIEW') {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      }
    } catch (err) {
      console.error(err);
      setAlertMsg('Unauthorized state transition.');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('title', createFormData.title);
      formData.append('description', createFormData.description);
      formData.append('priority', createFormData.priority);
      formData.append('deadline', createFormData.deadline);
      formData.append('assignType', assignType);
      
      if (assignType === 'TEAM') {
        formData.append('teamId', createFormData.teamId);
      } else {
        formData.append('assigneeId', createFormData.assigneeId);
      }
      
      formData.append('type', createFormData.type);
      formData.append('storyPoints', createFormData.storyPoints);
      formData.append('sprintName', createFormData.sprintName);
      
      for (let file of taskFiles) {
        formData.append('attachments', file);
      }

      await api.post('/tasks', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setCreateModalOpen(false);
      setCreateFormData({
        title: '',
        description: '',
        priority: 'MEDIUM',
        deadline: '',
        assigneeId: '',
        teamId: '',
        type: 'TASK',
        storyPoints: 0,
        sprintName: ''
      });
      setTaskFiles([]);
      setAlertMsg('Task assigned successfully.');
      fetchTasks();
    } catch (err) {
      setAlertMsg(err.response?.data?.message || 'Failed to assign task.');
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.put(`/tasks/${selectedTask.id}`, editFormData);
      setDetailModalOpen(false);
      setIsEditing(false);
      setAlertMsg('Task updated successfully.');
      fetchTasks();
    } catch (err) {
      setAlertMsg(err.response?.data?.message || 'Failed to update task.');
      setLoading(false);
    }
  };

  const startEditing = () => {
    setEditFormData({
      title: selectedTask.title,
      description: selectedTask.description,
      priority: selectedTask.priority,
      deadline: selectedTask.deadline ? selectedTask.deadline.split('T')[0] : '',
      assigneeId: selectedTask.assigneeId,
      status: selectedTask.status,
      type: selectedTask.type || 'TASK',
      storyPoints: selectedTask.storyPoints || 0,
      sprintName: selectedTask.sprintName || ''
    });
    setIsEditing(true);
  };

  const openDetailModal = async (task) => {
    try {
      const res = await api.get(`/tasks/${task.id}`);
      setSelectedTask(res.data);
      setDetailModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      const res = await api.post(`/tasks/${selectedTask.id}/comment`, { text: commentText });
      setSelectedTask({
        ...selectedTask,
        comments: [...(selectedTask.comments || []), res.data]
      });
      setCommentText('');
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmissionSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('submitNotes', submitNotes);
      for (let file of submitFiles) {
        formData.append('files', file);
      }

      await api.post(`/tasks/${selectedTask.id}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setDetailModalOpen(false);
      setSubmitNotes('');
      setSubmitFiles([]);
      setAlertMsg('Task work successfully submitted.');
      fetchTasks();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
    } catch (err) {
      setAlertMsg('Failed to submit work files.');
      setLoading(false);
    }
  };

  const handleReviewDecision = async (status) => {
    try {
      await api.put(`/tasks/${selectedTask.id}/status`, { status });
      setDetailModalOpen(false);
      setAlertMsg(`Task review completed: ${status}`);
      fetchTasks();
      if (status === 'APPROVED') {
        confetti({ particleCount: 150, spread: 80, colors: ['#10b981', '#6366f1'] });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleLocalTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Subtasks API Handlers
  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    try {
      const res = await api.post(`/tasks/${selectedTask.id}/subtasks`, { title: newSubtaskTitle });
      setSelectedTask({
        ...selectedTask,
        subtasks: [...(selectedTask.subtasks || []), res.data]
      });
      setNewSubtaskTitle('');
      fetchTasks();
    } catch (err) {
      console.error(err);
      setAlertMsg('Failed to add checklist item.');
    }
  };

  const handleToggleSubtask = async (subtaskId, isDone) => {
    try {
      const res = await api.put(`/tasks/subtasks/${subtaskId}`, { isDone });
      setSelectedTask({
        ...selectedTask,
        subtasks: selectedTask.subtasks.map(sub => sub.id === subtaskId ? res.data : sub)
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    try {
      await api.delete(`/tasks/subtasks/${subtaskId}`);
      setSelectedTask({
        ...selectedTask,
        subtasks: selectedTask.subtasks.filter(sub => sub.id !== subtaskId)
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter tasks based on Search, Sprint, Priority, and Type
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSprint = selectedSprint === 'ALL' || t.sprintName === selectedSprint;
    const matchesPriority = selectedPriority === 'ALL' || t.priority === selectedPriority;
    const matchesType = selectedType === 'ALL' || t.type === selectedType;
    return matchesSearch && matchesSprint && matchesPriority && matchesType;
  });

  const getColTasks = (statuses) => {
    return filteredTasks.filter(t => statuses.includes(t.status));
  };

  const columns = [
    { title: 'TO DO', statuses: ['PENDING', 'REJECTED'] },
    { title: 'IN PROGRESS', statuses: ['IN_PROGRESS'] },
    { title: 'IN REVIEW', statuses: ['WAITING_FOR_REVIEW'] },
    { title: 'DONE', statuses: ['APPROVED'] }
  ];

  // Extract unique sprints from tasks
  const sprintsList = ['ALL', ...new Set(tasks.map(t => t.sprintName).filter(Boolean))];

  const getTypeIcon = (type) => {
    switch (type) {
      case 'BUG':
        return <Bug className="h-3.5 w-3.5 text-red-500" />;
      case 'STORY':
        return <Bookmark className="h-3.5 w-3.5 text-emerald-500" fill="currentColor" />;
      default:
        return <CheckSquare className="h-3.5 w-3.5 text-sky-500" fill="currentColor" />;
    }
  };

  const renderSummaryTab = () => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'APPROVED').length;
    const inProgress = filteredTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const review = filteredTasks.filter(t => t.status === 'WAITING_FOR_REVIEW').length;
    const pending = filteredTasks.filter(t => ['PENDING', 'REJECTED'].includes(t.status)).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const bugs = filteredTasks.filter(t => t.type === 'BUG').length;
    const stories = filteredTasks.filter(t => t.type === 'STORY').length;
    const tasksCount = filteredTasks.filter(t => t.type === 'TASK' || !t.type).length;

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Work Completion</span>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xl font-black">{rate}%</span>
              <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden border">
                <div className="bg-success h-full" style={{ width: `${rate}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Active Work items</span>
            <span className="text-xl font-black mt-2 block text-primary">{inProgress + review + pending} Open</span>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Total Sprints Weight</span>
            <span className="text-xl font-black mt-2 block text-violet-500">
              {filteredTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0)} Story Points
            </span>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Bugs Density</span>
            <span className="text-xl font-black mt-2 block text-rose-500">{bugs} Active Bugs</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Task Type Breakdown */}
          <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-3">Task Type Breakdown</h4>
            <div className="space-y-3">
              {[
                { type: 'User Stories', count: stories, pct: total > 0 ? Math.round((stories/total)*100) : 0, color: 'bg-emerald-500' },
                { type: 'Engineering Tasks', count: tasksCount, pct: total > 0 ? Math.round((tasksCount/total)*100) : 0, color: 'bg-sky-500' },
                { type: 'Defect Reports / Bugs', count: bugs, pct: total > 0 ? Math.round((bugs/total)*100) : 0, color: 'bg-red-500' }
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{item.type}</span>
                    <span className="text-muted-foreground">{item.count} items ({item.pct}%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Priority breakdown */}
          <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-3">Priority Allocation</h4>
            <div className="space-y-3">
              {[
                { label: 'Urgent Priority', count: filteredTasks.filter(t => t.priority === 'URGENT').length, color: 'text-red-500' },
                { label: 'High Priority', count: filteredTasks.filter(t => t.priority === 'HIGH').length, color: 'text-orange-500' },
                { label: 'Medium Priority', count: filteredTasks.filter(t => t.priority === 'MEDIUM').length, color: 'text-sky-500' },
                { label: 'Low Priority', count: filteredTasks.filter(t => t.priority === 'LOW').length, color: 'text-slate-500' }
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${item.color.replace('text-', 'bg-')}`} />
                    <span>{item.label}</span>
                  </span>
                  <span className="bg-muted px-2.5 py-0.5 rounded-full text-muted-foreground text-[10px]">{item.count} items</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBacklogTab = () => {
    const activeSprintTasks = filteredTasks.filter(t => t.sprintName);
    const poolTasks = filteredTasks.filter(t => !t.sprintName);

    const renderBacklogList = (tasksList, title) => (
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border/20 pb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/80">{title} ({tasksList.length})</h4>
          {['ADMIN', 'TEAM_LEADER'].includes(user.role) && (
            <button 
              onClick={() => setCreateModalOpen(true)}
              className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 font-bold px-2.5 py-1 rounded"
            >
              + Add Task
            </button>
          )}
        </div>

        {tasksList.length === 0 ? (
          <div className="border border-dashed rounded-xl p-8 text-center text-xs text-muted-foreground">
            No items in this backlog segment.
          </div>
        ) : (
          <div className="space-y-2">
            {tasksList.map(task => (
              <div 
                key={task.id} 
                onClick={() => openDetailModal(task)}
                className="flex flex-col sm:flex-row sm:items-center justify-between bg-card border border-border/30 rounded-xl p-3 shadow-sm hover:border-primary/30 transition-all cursor-pointer text-left gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getTypeIcon(task.type)}
                  <span className="text-[10px] text-muted-foreground font-mono font-bold shrink-0">
                    MRF-{task.id.slice(0, 4).toUpperCase()}
                  </span>
                  <p className="text-xs font-bold text-foreground truncate">{task.title}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                  {task.storyPoints > 0 && (
                    <span className="h-4.5 min-w-4.5 px-1.5 flex items-center justify-center rounded-full bg-muted border text-[9px] font-bold text-muted-foreground" title="Story Points">
                      {task.storyPoints} SP
                    </span>
                  )}
                  
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${
                    task.priority === 'URGENT' ? 'bg-red-500/10 text-red-500' :
                    task.priority === 'HIGH' ? 'bg-orange-500/10 text-orange-500' :
                    task.priority === 'MEDIUM' ? 'bg-sky-500/10 text-sky-500' :
                    'bg-slate-500/10 text-slate-500'
                  }`}>
                    {task.priority}
                  </span>

                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[8px] font-extrabold uppercase ${
                    task.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600' :
                    task.status === 'IN_PROGRESS' ? 'bg-yellow-500/10 text-yellow-600' :
                    task.status === 'WAITING_FOR_REVIEW' ? 'bg-purple-500/10 text-purple-600' :
                    'bg-slate-500/10 text-slate-600'
                  }`}>
                    {task.status.replace('_', ' ')}
                  </span>

                  <img 
                    src={task.assignee?.profilePic ? getUploadUrl(task.assignee.profilePic) : `https://api.dicebear.com/7.x/initials/svg?seed=${task.assignee?.name}`}
                    className="h-5 w-5 rounded-full border object-cover"
                    title={task.assignee?.name}
                    alt="avatar"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {renderBacklogList(activeSprintTasks, "Sprint Backlog Items")}
        <hr className="border-border/30" />
        {renderBacklogList(poolTasks, "Backlog Workspace Pool")}
      </div>
    );
  };

  const renderTimelineTab = () => {
    return (
      <div className="bg-card border border-border/40 p-6 rounded-2xl shadow-sm text-left animate-in fade-in duration-300 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-foreground">Workspace Roadmap</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Timeline schedule of active and future sprint deliverables.</p>
        </div>

        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No roadmap tasks found.</p>
          ) : (
            filteredTasks.slice(0, 8).map((task, i) => {
              const colors = [
                'bg-indigo-500/20 border-indigo-500/40 text-indigo-500',
                'bg-violet-500/20 border-violet-500/40 text-violet-500',
                'bg-emerald-500/20 border-emerald-500/40 text-emerald-500',
                'bg-amber-500/20 border-amber-500/40 text-amber-500',
                'bg-pink-500/20 border-pink-500/40 text-pink-500'
              ];
              const color = colors[i % colors.length];
              const due = new Date(task.deadline);
              const formattedDue = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              
              const offset = (i * 8) % 40;
              const length = 35 + (i * 12) % 45;

              return (
                <div key={task.id} className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs">
                  <div className="w-44 shrink-0 font-bold truncate flex items-center gap-2">
                    {getTypeIcon(task.type)}
                    <span className="truncate">{task.title}</span>
                  </div>
                  
                  <div className="flex-1 bg-muted/30 border border-border/20 rounded-lg h-7 relative flex items-center p-0.5 overflow-hidden">
                    <div 
                      className={`absolute border rounded-md h-5 flex items-center px-2 text-[9px] font-bold ${color}`}
                      style={{ left: `${offset}%`, width: `${length}%` }}
                    >
                      <span className="truncate">Due {formattedDue}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const getDynamicCommits = () => {
    const activeTasks = tasks.filter(t => t.status === 'APPROVED' || t.status === 'IN_PROGRESS');
    if (activeTasks.length === 0) {
      return [
        { hash: 'a1b2c3d', message: 'Initial commit and repository setup', author: user.name, time: '2 days ago' }
      ];
    }
    return activeTasks.map((t, idx) => {
      const hashes = ['a8d7f6e', 'b9c8d7e', 'c0b9a8f', 'd1e2f3a', 'e4d3c2b', 'f5e6d7c'];
      const hash = hashes[idx % hashes.length] || 'a1b2c3d';
      const action = t.status === 'APPROVED' ? 'feat' : 'work';
      const author = t.assignee?.name || user.name;
      const time = `${idx + 1} day${idx > 0 ? 's' : ''} ago`;
      return {
        hash,
        message: `${action}: ${t.title.toLowerCase().replace(/\./g, '')}`,
        author: `${author} (${t.assignee?.employeeId || 'System'})`,
        time
      };
    });
  };

  const renderCodeTab = () => {
    const commits = getDynamicCommits();

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300 text-left">
        {/* Left side: Repositories & Commit stream */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2 mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Workspace Repositories</h4>
              {['ADMIN', 'TEAM_LEADER'].includes(user.role) && (
                <button 
                  onClick={() => setShowAddRepo(!showAddRepo)}
                  className="text-[10px] bg-primary text-primary-foreground hover:bg-primary-hover font-bold px-2.5 py-1 rounded shadow-sm"
                >
                  {showAddRepo ? 'Cancel' : '+ Register Link'}
                </button>
              )}
            </div>

            {showAddRepo && (
              <form onSubmit={handleRegisterRepo} className="bg-muted/30 border border-border/30 rounded-xl p-3.5 space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1 text-[10px]">
                    <label className="font-bold text-muted-foreground uppercase">Repo Name *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. mrf-crm-frontend"
                      value={newRepoForm.name}
                      onChange={(e) => setNewRepoForm({ ...newRepoForm, name: e.target.value })}
                      className="text-xs border bg-card px-2 py-1 rounded"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-[10px]">
                    <label className="font-bold text-muted-foreground uppercase">Git URL (GitHub/GitLab)</label>
                    <input 
                      type="url"
                      placeholder="e.g. https://github.com/org/repo"
                      value={newRepoForm.url}
                      onChange={(e) => setNewRepoForm({ ...newRepoForm, url: e.target.value })}
                      className="text-xs border bg-card px-2 py-1 rounded"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-[10px]">
                    <label className="font-bold text-muted-foreground uppercase">Primary Tech stack</label>
                    <select
                      value={newRepoForm.lang}
                      onChange={(e) => setNewRepoForm({ ...newRepoForm, lang: e.target.value })}
                      className="text-xs border bg-card px-2 py-1 rounded"
                    >
                      <option value="React/JS">React (JS/Vite)</option>
                      <option value="Node/Express">Node/Express/Prisma</option>
                      <option value="Flutter/Dart">Flutter/Dart (Mobile)</option>
                      <option value="Python/FastAPI">Python/FastAPI</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow w-full">
                  Link Repository
                </button>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {repositories.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 col-span-2">No repositories linked yet.</p>
              ) : (
                repositories.map((repo) => (
                  <div key={repo.id} className="border border-border/30 bg-muted/20 p-4 rounded-xl space-y-3.5 relative group flex flex-col justify-between">
                    <div>
                      {['ADMIN', 'TEAM_LEADER'].includes(user.role) && (
                        <button 
                          onClick={() => handleDeleteRepo(repo.id)}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove link"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground font-mono truncate mr-4">{repo.name}</span>
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded font-bold uppercase shrink-0">Build {repo.status}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Framework: {repo.lang}</p>
                    </div>

                    {/* Branches List Section */}
                    <div className="pt-2 border-t border-border/10 space-y-1.5 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Active Branches ({repo.branches?.length || 0})</span>
                        {['ADMIN', 'TEAM_LEADER', 'INTERN'].includes(user.role) && (
                          <button
                            onClick={() => {
                              setPromptModal({
                                isOpen: true,
                                title: 'Create Git Branch',
                                placeholder: 'e.g. feat/attendance-map',
                                value: '',
                                onConfirm: (name) => handleCreateBranch(repo.id, name)
                              });
                            }}
                            className="text-[9px] text-primary font-bold hover:underline"
                          >
                            + Add Branch
                          </button>
                        )}
                      </div>
                      <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                        {repo.branches && repo.branches.length > 0 ? (
                          repo.branches.map((br) => (
                            <div key={br.id} className="flex items-center justify-between text-[10px] bg-background/50 border border-border/10 px-2 py-1 rounded">
                              <div className="flex items-center gap-1.5 truncate mr-2">
                                <span className="font-mono text-foreground truncate">{br.name}</span>
                                {br.isDefault && <span className="text-[8px] bg-primary/10 text-primary px-1 rounded font-bold shrink-0">Default</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <a 
                                  href={br.url || (repo.url ? `${repo.url}/tree/${br.name}` : '#')} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-primary hover:underline font-semibold"
                                >
                                  View
                                </a>
                                {!br.isDefault && (
                                  <button 
                                    onClick={() => handleDeleteBranch(repo.id, br.id)} 
                                    className="text-red-500 hover:text-red-600 font-bold px-0.5"
                                    title="Delete Branch"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="text-[9px] text-muted-foreground">No branches found.</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-border/10">
                      <span>Commits logged: <b>{repo.commitsCount}</b></span>
                      <a href={repo.url || '#'} target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">
                        Explore →
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-3">Recent Commit Stream (Linked to task activity)</h4>
            <div className="space-y-3">
              {commits.map((c, i) => (
                <div key={i} className="flex items-start gap-3 border-l-2 border-primary/20 pl-3.5">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground leading-normal">{c.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Committed by {c.author} • {c.time}</p>
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-muted border px-2 py-0.5 rounded shrink-0">{c.hash}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-3">Pull Requests Status</h4>
          <div className="space-y-3">
            {[
              { id: '#42', title: 'feat/attendance-geocoding', state: 'Review Required', color: 'bg-purple-500/10 text-purple-600' },
              { id: '#41', title: 'fix/intern-routes-403', state: 'Approved / Merge ready', color: 'bg-emerald-500/10 text-emerald-600' },
              { id: '#40', title: 'style/admin-dashboard-redesign', state: 'Merged', color: 'bg-slate-500/10 text-slate-500' }
            ].map((pr, i) => (
              <div key={i} className="border border-border/20 p-3 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-primary">{pr.id} {pr.title}</span>
                </div>
                <span className={`inline-block rounded-full px-2 py-0.5 text-[8px] font-bold uppercase mt-1 ${pr.color}`}>
                  {pr.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDevelopmentTab = () => {
    const integrations = [
      { name: 'GitHub Integration', desc: 'Sync commit history and verify pull requests directly.', icon: CodeIcon, connected: true, tagColor: 'text-emerald-500 bg-emerald-500/10' },
      { name: 'Slack Alerts Channel', desc: 'Alert notifications on task allocation and reviews.', icon: MessageSquare, connected: true, tagColor: 'text-emerald-500 bg-emerald-500/10' },
      { name: 'Ticketing Bridge', desc: 'Sync tickets desk queries to backlog workspaces.', icon: FolderOpen, connected: false, tagColor: 'text-slate-500 bg-slate-500/10' },
      { name: 'Figma Assets Sync', desc: 'Verify UI designs references inside doc specs.', icon: Settings, connected: false, tagColor: 'text-slate-500 bg-slate-500/10' }
    ];

    return (
      <div className="bg-card border border-border/40 p-6 rounded-2xl shadow-sm text-left animate-in fade-in duration-300 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-foreground">Third-Party Integrations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Integrate workspace files and alert flows directly to external developer platforms.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="border border-border/30 bg-muted/10 p-4 rounded-xl flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-foreground">{item.name}</h4>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${item.tagColor}`}>
                      {item.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{item.desc}</p>
                  <div className="pt-2 flex justify-between items-center border-t border-border/10 mt-2">
                    <span className="text-[9px] text-muted-foreground">Status: <b>{item.connected ? 'Active Syncing' : 'Inactive'}</b></span>
                    <button className="text-[9px] text-primary hover:underline font-bold">
                      {item.connected ? 'Configure' : 'Configure Connect'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDocsTab = () => {
    const documents = [
      { title: 'MRF Enterprise Intern Onboarding Guide', desc: 'Step-by-step checklist for system configurations and access setup.', author: 'Admin', date: 'Jul 15, 2026' },
      { title: 'Frontend Coding Style & UI Standards', desc: 'Rules for tailwind configs, custom CSS classes, and Lucide icons.', author: 'Suraj Somu', date: 'Jul 12, 2026' },
      { title: 'API Endpoints & Database Schemas Guide', desc: 'Documentation of attendance and team route endpoints parameters.', author: 'Suraj Somu', date: 'Jul 10, 2026' }
    ];

    return (
      <div className="bg-card border border-border/40 p-6 rounded-2xl shadow-sm text-left animate-in fade-in duration-300 space-y-6">
        <div className="flex items-center justify-between border-b border-border/30 pb-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Workspace Wiki Library</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Guides, coding standards, and onboarding tutorials.</p>
          </div>
          <button className="text-[10px] bg-primary text-primary-foreground hover:bg-primary-hover font-bold px-3 py-1.5 rounded-lg shadow-sm">
            + Create Page
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {documents.map((doc, i) => (
            <div key={i} className="border border-border/20 bg-muted/20 hover:border-primary/20 rounded-xl p-4 flex flex-col justify-between h-44 shadow-sm hover:shadow transition-all">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-foreground line-clamp-2 leading-snug">{doc.title}</h4>
                <p className="text-[10px] text-muted-foreground line-clamp-3 leading-relaxed mt-1">{doc.desc}</p>
              </div>
              <div className="flex justify-between items-center text-[9px] text-muted-foreground pt-2 border-t border-border/10">
                <span>Author: <b>{doc.author}</b></span>
                <span>{doc.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFormsTab = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300 text-left">
        <div className="bg-card border border-border/40 p-6 rounded-2xl shadow-sm space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/80">Submit Leave Application</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">Submit shift skip requests for admin approval.</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); setAlertMsg('Leave request submitted successfully.'); }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Start Date</label>
                <input type="date" required className="text-xs border px-2 py-1 rounded bg-card w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">End Date</label>
                <input type="date" required className="text-xs border px-2 py-1 rounded bg-card w-full" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Reason for Leave</label>
              <textarea required rows={3} placeholder="Please provide leave reason details..." className="w-full border border-border bg-card px-3 py-1.5 text-xs rounded-lg" />
            </div>
            <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2 rounded-xl transition-all">
              Submit Application
            </button>
          </form>
        </div>

        <div className="bg-card border border-border/40 p-6 rounded-2xl shadow-sm space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/80">Hardware & Access Request</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Request systems, accessories, or developer access rights.</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); setAlertMsg('Hardware request submitted.'); }} className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Request Item Category</label>
              <select className="text-xs border px-2 py-1 rounded bg-card w-full">
                <option value="LAPTOP">Laptop / Workstation</option>
                <option value="MONITOR">External Display Monitor</option>
                <option value="ACCESS">GitHub / AWS Access Permissions</option>
                <option value="OTHER">Other Accessories</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Details / Description</label>
              <textarea required rows={3} placeholder="Please describe the request items or access parameters..." className="w-full border border-border bg-card px-3 py-1.5 text-xs rounded-lg" />
            </div>
            <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2 rounded-xl transition-all">
              Submit Request
            </button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col space-y-4 text-left">
      {alertMsg && (
        <div className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
          <span>{alertMsg}</span>
          <button onClick={() => setAlertMsg('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Space Title & Sub-tabs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-orange-600 text-sm font-black text-white shadow-md">M</span>
            <div className="text-left">
              <div className="text-xs text-muted-foreground font-semibold">Spaces</div>
              <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                My Software Team
                <span className="text-[10px] font-normal bg-muted border px-2 py-0.5 rounded-full text-muted-foreground">Scrum</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {teamMembers.slice(0, 4).map((member, i) => (
                <img
                  key={i}
                  src={member.profilePic ? getUploadUrl(member.profilePic) : `https://api.dicebear.com/7.x/initials/svg?seed=${member.name}`}
                  className="h-6 w-6 rounded-full border border-card object-cover"
                  title={member.name}
                  alt="avatar"
                />
              ))}
              {teamMembers.length > 4 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-card bg-muted text-[9px] font-black text-muted-foreground">
                  +{teamMembers.length - 4}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sub Tab Navigation */}
        <div className="flex items-center border-b border-border/40 gap-4 overflow-x-auto pb-0.5 scrollbar-thin">
          {subTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`text-xs font-semibold pb-2 border-b-2 px-1 transition-all ${
                activeSubTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border border-border/40 shadow-sm text-left">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Board */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search board..."
              className="w-36 pl-8 py-1 text-xs rounded-lg border bg-muted/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Sprint Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Sprint:</span>
            <select
              className="text-[11px] py-1 px-2 rounded border bg-card"
              value={selectedSprint}
              onChange={(e) => setSelectedSprint(e.target.value)}
            >
              {sprintsList.map((spr, i) => (
                <option key={i} value={spr}>{spr}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Type:</span>
            <select
              className="text-[11px] py-1 px-2 rounded border bg-card"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="ALL">All Types</option>
              <option value="TASK">Task</option>
              <option value="BUG">Bug</option>
              <option value="STORY">Story</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Priority:</span>
            <select
              className="text-[11px] py-1 px-2 rounded border bg-card"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border border-border/30 rounded-lg p-1 bg-muted/40">
            <button 
              onClick={() => setViewMode('kanban')} 
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${viewMode === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              <Layers className="h-3 w-3" />
              <span>Board</span>
            </button>
            <button 
              onClick={() => setViewMode('calendar')} 
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${viewMode === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              <Calendar className="h-3 w-3" />
              <span>Calendar</span>
            </button>
          </div>

          {['ADMIN', 'TEAM_LEADER'].includes(user.role) && (
            <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary-hover transition-all">
              <Plus className="h-3.5 w-3.5" />
              <span>Create</span>
            </button>
          )}
        </div>
      </div>

      {/* Switch Render according to Sub Tab selected */}
      {activeSubTab === 'Board' ? (
        viewMode === 'kanban' ? (
          <div className="flex-1 flex overflow-x-auto gap-4 h-full pb-4 min-h-[500px] scrollbar-thin">
            {columns.map((col, idx) => {
              const isHovered = activeDragCol === col.title;
              return (
                <div
                  key={col.title}
                  onDragOver={onDragOver}
                  onDragEnter={() => setActiveDragCol(col.title)}
                  onDragLeave={() => setActiveDragCol(null)}
                  onDrop={(e) => onDrop(e, col.title)}
                  className={`flex flex-col flex-1 min-w-[280px] max-w-[340px] bg-card/65 border ${
                    isHovered ? 'border-primary bg-primary/5 shadow-md scale-[1.01]' : 'border-border/30'
                  } rounded-xl p-3 h-full overflow-hidden transition-all duration-200`}
                >
                  {/* Column Header */}
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-border/20">
                    <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">{col.title}</span>
                    <span className="text-[10px] bg-muted font-bold text-muted-foreground px-2 py-0.5 rounded-full">
                      {getColTasks(col.statuses).length}
                    </span>
                  </div>

                  {/* Cards Scrolling Box */}
                  <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    {getColTasks(col.statuses).length === 0 ? (
                      <div className="border border-dashed rounded-xl p-6 text-center text-[10px] text-muted-foreground">
                        No tickets
                      </div>
                    ) : (
                      getColTasks(col.statuses).map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, task.id)}
                          onClick={() => openDetailModal(task)}
                          className="group bg-card border border-border/40 rounded-xl p-3 shadow hover:border-primary/45 cursor-grab active:cursor-grabbing transition-all text-left space-y-2.5 animate-in fade-in duration-200"
                        >
                          <h4 className="text-xs font-bold text-foreground group-hover:text-primary leading-tight line-clamp-2">
                            {task.title}
                          </h4>

                          {/* Middle: Deadline & Type info */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Calendar capsule */}
                            <div className="flex items-center gap-1 rounded bg-muted/65 border border-border/30 px-1.5 py-0.5 text-[9px] text-muted-foreground font-semibold">
                              <Calendar className="h-2.5 w-2.5" />
                              <span>{new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>

                            {task.sprintName && (
                              <span className="text-[8px] bg-slate-100 dark:bg-slate-800 text-muted-foreground px-1.5 py-0.5 rounded font-mono font-bold">
                                {task.sprintName}
                              </span>
                            )}
                          </div>

                          {/* Bottom Bar: Key & Type icon left, Avatar right */}
                          <div className="flex items-center justify-between pt-1 border-t border-border/20">
                            <div className="flex items-center gap-1.5">
                              {getTypeIcon(task.type)}
                              <span className="text-[9px] text-muted-foreground font-mono font-bold">
                                MRF-{task.id.slice(0, 4).toUpperCase()}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {task.storyPoints > 0 && (
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted border text-[8px] font-bold text-muted-foreground" title="Story Points">
                                  {task.storyPoints}
                                </span>
                              )}
                              <img
                                src={task.assignee?.profilePic ? getUploadUrl(task.assignee.profilePic) : `https://api.dicebear.com/7.x/initials/svg?seed=${task.assignee?.name}`}
                                className="h-5 w-5 rounded-full border object-cover"
                                title={task.assignee?.name}
                                alt="avatar"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Inline Creation Trigger inside To-Do column */}
                  {col.title === 'TO DO' && ['ADMIN', 'TEAM_LEADER'].includes(user.role) && (
                    <button
                      onClick={() => setCreateModalOpen(true)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed rounded-lg py-2 text-[11px] font-bold hover:bg-muted text-muted-foreground transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create Issue</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Calendar view list */
          <div className="flex-1 bg-card border border-border/40 p-5 rounded-xl shadow-sm overflow-y-auto text-left min-h-[500px]">
            <h3 className="text-sm font-extrabold mb-4">Task Deadlines Calendar</h3>
            <div className="space-y-3">
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => openDetailModal(task)}
                  className="flex items-center justify-between border-b border-border/30 pb-3 hover:bg-muted/10 px-2 cursor-pointer rounded-lg transition-all"
                >
                  <div className="flex items-center gap-3">
                    {getTypeIcon(task.type)}
                    <div>
                      <h4 className="text-xs font-bold">{task.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Assigned to: {task.assignee?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] bg-muted px-2 py-0.5 rounded font-mono font-bold">MRF-{task.id.slice(0, 4).toUpperCase()}</span>
                    <span className="text-[10px] text-muted-foreground font-semibold">{new Date(task.deadline).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : activeSubTab === 'Summary' ? (
        renderSummaryTab()
      ) : activeSubTab === 'Backlog' ? (
        renderBacklogTab()
      ) : activeSubTab === 'Timeline' ? (
        renderTimelineTab()
      ) : activeSubTab === 'Code' ? (
        renderCodeTab()
      ) : activeSubTab === 'Development' ? (
        renderDevelopmentTab()
      ) : activeSubTab === 'Docs' ? (
        renderDocsTab()
      ) : activeSubTab === 'Forms' ? (
        renderFormsTab()
      ) : null}

      {/* Task Creation Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold">Assign New Task</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => setCreateModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Assignee Type</label>
                  <select 
                    value={assignType} 
                    onChange={(e) => setAssignType(e.target.value)}
                  >
                    <option value="INDIVIDUAL">Individual Intern</option>
                    <option value="TEAM">Entire Team</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  {assignType === 'TEAM' ? (
                    <>
                      <label className="text-xs font-semibold text-muted-foreground">Target Team *</label>
                      <select 
                        required
                        value={createFormData.teamId} 
                        onChange={(e) => setCreateFormData({ ...createFormData, teamId: e.target.value })}
                      >
                        <option value="">Select Team</option>
                        {teams.map(team => (
                          <option key={team.id} value={team.id}>
                            {team.name} ({team.members?.length || 0} members)
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="text-xs font-semibold text-muted-foreground">Assigned Intern *</label>
                      <select 
                        required
                        value={createFormData.assigneeId} 
                        onChange={(e) => setCreateFormData({ ...createFormData, assigneeId: e.target.value })}
                      >
                        <option value="">Select Intern</option>
                        {teamMembers.map(member => (
                          <option key={member.id} value={member.id}>{member.name} ({member.employeeId})</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Task Title *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Task title" 
                  value={createFormData.title} 
                  onChange={(e) => setCreateFormData({ ...createFormData, title: e.target.value })} 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Task Description *</label>
                <textarea 
                  rows={3} 
                  required 
                  placeholder="Task details and instructions" 
                  className="w-full border border-border bg-card px-4 py-2 text-sm rounded-lg"
                  value={createFormData.description} 
                  onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })} 
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Task Type</label>
                  <select 
                    value={createFormData.type} 
                    onChange={(e) => setCreateFormData({ ...createFormData, type: e.target.value })}
                  >
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                    <option value="STORY">Story</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Story Points</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={createFormData.storyPoints} 
                    onChange={(e) => setCreateFormData({ ...createFormData, storyPoints: parseInt(e.target.value, 10) || 0 })} 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Sprint Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Sprint 1" 
                    value={createFormData.sprintName} 
                    onChange={(e) => setCreateFormData({ ...createFormData, sprintName: e.target.value })} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Priority *</label>
                  <select 
                    value={createFormData.priority} 
                    onChange={(e) => setCreateFormData({ ...createFormData, priority: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Deadline *</label>
                  <input 
                    type="date" 
                    required 
                    value={createFormData.deadline} 
                    onChange={(e) => setCreateFormData({ ...createFormData, deadline: e.target.value })} 
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Attachments</span>
                </label>
                <input 
                  type="file" 
                  multiple 
                  className="hidden" 
                  id="task-file-input"
                  onChange={(e) => setTaskFiles(Array.from(e.target.files))} 
                />
                <label 
                  htmlFor="task-file-input" 
                  className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-xs cursor-pointer hover:bg-muted/40 transition-all text-muted-foreground"
                >
                  <Upload className="h-4 w-4" />
                  <span>{taskFiles.length > 0 ? `${taskFiles.length} files selected` : 'Select reference files'}</span>
                </label>
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50 transition-all">
                {loading ? 'Assigning...' : 'Assign Task'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Task Details Dialog Modal */}
      {detailModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border/40 bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary-hover rounded-full uppercase">Task Details</span>
                  {selectedTask.type && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      selectedTask.type === 'BUG' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                      selectedTask.type === 'STORY' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                      'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                    }`}>
                      {selectedTask.type}
                    </span>
                  )}
                  {selectedTask.sprintName && (
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-muted-foreground px-1.5 py-0.5 rounded font-mono font-bold">
                      {selectedTask.sprintName}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold mt-1.5">{selectedTask.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                {['ADMIN', 'TEAM_LEADER'].includes(user.role) && !isEditing && (
                  <button onClick={startEditing} className="rounded-lg px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-all">
                    Edit Task
                  </button>
                )}
                <button className="rounded-lg p-1 hover:bg-muted" onClick={() => { setDetailModalOpen(false); setIsEditing(false); }}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Task Title *</label>
                  <input 
                    type="text" 
                    required 
                    value={editFormData.title} 
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} 
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Task Description *</label>
                  <textarea 
                    rows={4} 
                    required 
                    className="w-full border border-border bg-card px-4 py-2 text-sm rounded-lg"
                    value={editFormData.description} 
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} 
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Task Type</label>
                    <select 
                      value={editFormData.type} 
                      onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                    >
                      <option value="TASK">Task</option>
                      <option value="BUG">Bug</option>
                      <option value="STORY">Story</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Story Points</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={editFormData.storyPoints} 
                      onChange={(e) => setEditFormData({ ...editFormData, storyPoints: parseInt(editFormData.storyPoints, 10) || 0 })} 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Sprint Name</label>
                    <input 
                      type="text" 
                      value={editFormData.sprintName} 
                      onChange={(e) => setEditFormData({ ...editFormData, sprintName: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Priority *</label>
                    <select 
                      value={editFormData.priority} 
                      onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Deadline *</label>
                    <input 
                      type="date" 
                      required 
                      value={editFormData.deadline} 
                      onChange={(e) => setEditFormData({ ...editFormData, deadline: e.target.value })} 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Status</label>
                    <select 
                      value={editFormData.status} 
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    >
                      <option value="PENDING">To Do / Pending</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="WAITING_FOR_REVIEW">Under Review</option>
                      <option value="APPROVED">Completed</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Assigned Intern *</label>
                  <select 
                    required
                    value={editFormData.assigneeId} 
                    onChange={(e) => setEditFormData({ ...editFormData, assigneeId: e.target.value })}
                  >
                    <option value="">Select Intern</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.id}>{member.name} ({member.employeeId})</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 justify-end pt-3 border-t">
                  <button type="button" onClick={() => setIsEditing(false)} className="rounded-xl border px-4 py-2 text-xs font-semibold">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold">
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Task Details Info Column */}
                <div className="md:col-span-2 space-y-5">
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground">Description</h4>
                    <p className="text-xs text-foreground mt-1.5 bg-muted/30 p-3 rounded-xl border border-border/30 whitespace-pre-wrap">{selectedTask.description}</p>
                  </div>

                  {/* Checklist subtasks manager */}
                  <div className="space-y-2 border-t border-border/30 pt-3 text-left">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-muted-foreground">Subtask Checklist</h4>
                      <span className="text-[10px] text-muted-foreground">
                        {selectedTask.subtasks?.filter(s => s.isDone).length || 0} of {selectedTask.subtasks?.length || 0} completed
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {selectedTask.subtasks?.length > 0 && (
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{
                            width: `${Math.round(
                              ((selectedTask.subtasks?.filter(s => s.isDone).length || 0) / (selectedTask.subtasks?.length || 1)) * 100
                            )}%`
                          }}
                        />
                      </div>
                    )}

                    {/* Subtask list */}
                    <div className="space-y-1.5 mt-2">
                      {selectedTask.subtasks?.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between bg-muted/20 border border-border/30 rounded-lg p-2 text-xs hover:bg-muted/40 transition-all">
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input 
                              type="checkbox" 
                              checked={sub.isDone} 
                              onChange={(e) => handleToggleSubtask(sub.id, e.target.checked)} 
                            />
                            <span className={sub.isDone ? 'line-through text-muted-foreground' : 'text-foreground'}>
                              {sub.title}
                            </span>
                          </label>
                          <button 
                            type="button"
                            onClick={() => handleDeleteSubtask(sub.id)}
                            className="text-muted-foreground hover:text-red-500 rounded p-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}

                      {selectedTask.subtasks?.length === 0 && (
                        <p className="text-[10px] text-muted-foreground py-2 text-center">No checklist items added. Use the input below to create subtasks.</p>
                      )}
                    </div>

                    {/* Add Subtask Input Form */}
                    <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2">
                      <input 
                        type="text" 
                        placeholder="Add subtask checklist item..." 
                        className="flex-1 text-xs py-1"
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      />
                      <button 
                        type="submit" 
                        className="bg-muted hover:bg-muted-foreground/10 text-foreground border rounded-lg px-3 py-1.5 text-xs font-bold"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                  {/* Attachments Section */}
                  {selectedTask.attachments?.length > 0 && (
                    <div className="border-t border-border/30 pt-3">
                      <h4 className="text-xs font-semibold text-muted-foreground">Task Reference Attachments</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedTask.attachments.map((file, i) => (
                          <button
                            key={i} 
                            type="button"
                            onClick={() => downloadFile(file)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 text-[11px] font-semibold bg-muted/20 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer"
                            title="Download Attachment"
                          >
                            <Paperclip className="h-3 w-3" />
                            <span>Attachment #{i + 1}</span>
                            <Download className="h-3 w-3 ml-1 opacity-70" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments Section */}
                  <div className="space-y-3 border-t border-border/30 pt-3">
                    <h4 className="text-xs font-semibold text-muted-foreground">Task Thread Discussion</h4>
                    <div className="space-y-2.5 max-h-40 overflow-y-auto bg-muted/15 p-2 rounded-xl border border-border/30">
                      {selectedTask.comments?.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-4">No comments posted yet.</p>
                      ) : (
                        selectedTask.comments?.map((comment) => (
                          <div key={comment.id} className="text-xs bg-card p-2.5 rounded-xl border border-border/30">
                            <div className="flex justify-between items-center text-[9px] text-muted-foreground mb-1">
                              <span className="font-bold">{comment.user?.name || `Member #${comment.userId?.substring(0, 5)}`}</span>
                              <span>{new Date(comment.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <p>{comment.text}</p>
                          </div>
                        ))
                      )}
                    </div>
                    
                    <form onSubmit={handleCommentSubmit} className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Write comment..." 
                        className="flex-1 text-xs"
                        value={commentText} 
                        onChange={(e) => setCommentText(e.target.value)} 
                      />
                      <button type="submit" className="bg-primary hover:bg-primary-hover text-white rounded-lg p-2 flex items-center justify-center">
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>

                {/* Status workflow review pane column */}
                <div className="space-y-4 border-l border-border/40 pl-0 md:pl-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-muted-foreground">Status</h4>
                    <p className="text-xs font-bold uppercase text-primary">{selectedTask.status}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-muted-foreground">Assignee</h4>
                    <p className="text-xs font-semibold">{selectedTask.assignee?.name}</p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-muted-foreground">Deadline</h4>
                    <p className="text-xs font-semibold">{new Date(selectedTask.deadline).toLocaleDateString()}</p>
                  </div>

                  {selectedTask.storyPoints > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-muted-foreground">Story Points</h4>
                      <p className="text-xs font-semibold">{selectedTask.storyPoints} pts</p>
                    </div>
                  )}

                  {/* Submissions Section */}
                  {selectedTask.submissions?.length > 0 && (
                    <div className="border-t border-border/30 pt-3 space-y-2">
                      <h4 className="text-xs font-bold">Latest Intern Work</h4>
                      <p className="text-[11px] bg-muted/40 p-2 rounded border border-border/20 italic">
                        "{selectedTask.submissions[0].submitNotes || 'No notes uploaded.'}"
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedTask.submissions[0].files.map((file, i) => (
                          <a 
                            key={i} 
                            href={getUploadUrl(file)} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[9px] font-bold border rounded px-2 py-1 bg-card hover:bg-muted"
                          >
                            <Paperclip className="h-2.5 w-2.5" />
                            <span>File #{i + 1}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Role Specific Task Actions */}
                  {(user.role === 'INTERN' || user.role === 'EMPLOYEE') && selectedTask.assigneeId === user.id && (
                    <div className="border-t border-border/30 pt-3 space-y-2">
                      {selectedTask.status === 'PENDING' && (
                        <button 
                          onClick={() => onDrop({ preventDefault: () => {}, dataTransfer: { getData: () => selectedTask.id } }, 'IN PROGRESS')}
                          className="w-full bg-primary hover:bg-primary-hover text-primary-foreground text-xs py-2 rounded-lg font-semibold"
                        >
                          Start Work (In Progress)
                        </button>
                      )}
                      
                      {['IN_PROGRESS', 'REJECTED'].includes(selectedTask.status) && (
                        <form onSubmit={handleSubmissionSubmit} className="space-y-2">
                          <h4 className="text-xs font-bold">Submit Completed Work</h4>
                          <textarea 
                            rows={2} 
                            placeholder="Submission notes/details..."
                            className="w-full text-xs p-2 bg-muted/30 border rounded"
                            value={submitNotes} 
                            onChange={(e) => setSubmitNotes(e.target.value)}
                          />
                          <input 
                            type="file" 
                            multiple 
                            id="submit-files-input" 
                            className="hidden" 
                            onChange={(e) => setSubmitFiles(Array.from(e.target.files))} 
                          />
                          <label 
                            htmlFor="submit-files-input" 
                            className="flex items-center justify-center gap-2 border border-dashed rounded py-2 text-[10px] cursor-pointer text-muted-foreground hover:bg-muted/40"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>{submitFiles.length > 0 ? `${submitFiles.length} files selected` : 'Select work files'}</span>
                          </label>
                          <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs py-2 rounded-lg font-semibold">
                            Submit Work
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {['ADMIN', 'TEAM_LEADER'].includes(user.role) && selectedTask.status === 'WAITING_FOR_REVIEW' && (
                    <div className="border-t border-border/30 pt-3 space-y-2">
                      <h4 className="text-xs font-bold">Review Submission</h4>
                      <button 
                        onClick={() => handleReviewDecision('APPROVED')}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs py-2 rounded-lg font-semibold"
                      >
                        Approve Work
                      </button>
                      <button 
                        onClick={() => handleReviewDecision('REJECTED')}
                        className="w-full bg-red-500 hover:bg-red-600 text-white text-xs py-2 rounded-lg font-semibold"
                      >
                        Reject Submission
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            <h3 className="text-base font-bold text-foreground">{confirmModal.title}</h3>
            <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">{confirmModal.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="rounded-xl px-4 py-2 text-xs font-semibold hover:bg-muted border border-border/30 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (confirmModal.onConfirm) {
                    await confirmModal.onConfirm();
                  }
                  setConfirmModal({ ...confirmModal, isOpen: false });
                }}
                className="rounded-xl bg-danger px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-danger-hover active:scale-95 transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Prompt Modal */}
      {promptModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            <h3 className="text-base font-bold text-foreground">{promptModal.title}</h3>
            <div className="mt-4 flex flex-col gap-1.5">
              <input 
                type="text" 
                placeholder={promptModal.placeholder}
                value={promptModal.value}
                onChange={(e) => setPromptModal({ ...promptModal, value: e.target.value })}
                className="w-full text-xs border border-border/40 bg-background px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                autoFocus
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setPromptModal({ ...promptModal, isOpen: false })}
                className="rounded-xl px-4 py-2 text-xs font-semibold hover:bg-muted border border-border/30 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (promptModal.onConfirm && promptModal.value.trim()) {
                    await promptModal.onConfirm(promptModal.value.trim());
                  }
                  setPromptModal({ ...promptModal, isOpen: false });
                }}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-primary-hover active:scale-95 transition-all"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
