import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api, { getUploadUrl, downloadFile, getSocket } from '../services/api';
import confetti from 'canvas-confetti';
import {
  Download,
  Plus,
  Calendar,
  Layers,
  ChevronRight,
  ChevronLeft,
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
  Trash2,
  ArrowRight,
  Check,
  RefreshCw,
  AlertTriangle,
  History
} from 'lucide-react';
import UserAvatar from '../components/common/UserAvatar';
import RejectModal from '../components/RejectModal';
import RetryModal from '../components/RetryModal';
import TaskDiscussionPanel from '../components/TaskDiscussionPanel';
import AudioPlayer from '../components/AudioPlayer';
import ConfirmModal from '../components/ConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [approvalConfirmModalOpen, setApprovalConfirmModalOpen] = useState(false);
  const [selectedRejectTask, setSelectedRejectTask] = useState(null);
  const [selectedRetryTask, setSelectedRetryTask] = useState(null);
  const [pendingStageMove, setPendingStageMove] = useState(null); // { task, targetStage }

  const executeStageMove = async (taskToMove, targetStage) => {
    if (!taskToMove || !targetStage) return;
    try {
      const payload = {};
      if (['todo', 'in_progress', 'in_review', 'done'].includes(targetStage.id)) {
        if (targetStage.id === 'todo') payload.status = 'PENDING';
        if (targetStage.id === 'in_progress') payload.status = 'IN_PROGRESS';
        if (targetStage.id === 'in_review') payload.status = 'WAITING_FOR_REVIEW';
        if (targetStage.id === 'done') payload.status = 'COMPLETED';
      } else {
        payload.stageId = targetStage.id;
      }

      const res = await api.put(`/tasks/${taskToMove.id}/status`, payload);
      setTasks(prev => prev.map(t => t.id === taskToMove.id ? res.data : t));
      await fetchTasks();
      await fetchProjects();
    } catch (err) {
      console.error('Execute stage move error:', err);
      setAlertMsg(err.response?.data?.message || 'Failed to move task stage.');
    }
  };

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
    sprintName: '',
    projectId: ''
  });
  const [taskFiles, setTaskFiles] = useState([]);
  const [projectsList, setProjectsList] = useState([]);

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
    sprintName: '',
    projectId: ''
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
  const [selectedProject, setSelectedProject] = useState('ALL');

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

  const subTabs = ['Summary', 'Board', 'Docs', 'Forms'];

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
        const res = await api.get('/users?limit=1000&status=ACTIVE');
        const assignable = (res.data.users || []).filter(u => u.role === 'TEAM_LEADER' || u.role === 'INTERN' || u.role === 'EMPLOYEE');
        setTeamMembers(assignable);
      } else {
        const res = await api.get('/users?role=INTERN&limit=1000&status=ACTIVE');
        const internMembers = (res.data.users || []);
        const empRes = await api.get('/users?role=EMPLOYEE&limit=1000&status=ACTIVE');
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

  // Reset tasks and projects on user change
  useEffect(() => {
    setTasks([]);
    setProjectsList([]);
  }, [user?.id]);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      const list = res.data.projects || res.data || [];
      setProjectsList(list);
      console.log('Projects from API:', list.map(p => p.name));
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchRepositories();
    fetchProjects();
    if (user.role === 'ADMIN' || user.role === 'TEAM_LEADER') {
      fetchTeamMembers();
      fetchTeams();
    }

    try {
      const socket = getSocket();
      if (socket) {
        const handleProjectChange = () => fetchProjects();
        const handleTaskChange = () => fetchTasks();

        socket.on('project_created', handleProjectChange);
        socket.on('project_updated', handleProjectChange);
        socket.on('project_deleted', handleProjectChange);

        socket.on('task_created', handleTaskChange);
        socket.on('task_updated', handleTaskChange);
        socket.on('task_deleted', handleTaskChange);

        return () => {
          socket.off('project_created', handleProjectChange);
          socket.off('project_updated', handleProjectChange);
          socket.off('project_deleted', handleProjectChange);

          socket.off('task_created', handleTaskChange);
          socket.off('task_updated', handleTaskChange);
          socket.off('task_deleted', handleTaskChange);
        };
      }
    } catch (e) {
      console.error('Socket setup error in Tasks:', e);
    }
  }, [user]);

  // Synchronize active tab from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      const validTabs = ['Summary', 'Board', 'Code', 'Timeline', 'Docs', 'Forms', 'Development'];
      const match = validTabs.find(t => t.toLowerCase() === tabParam.toLowerCase());
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

  const openCreateTaskForProject = (proj) => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
    setCreateFormData({
      title: '',
      description: '',
      priority: 'MEDIUM',
      deadline: nextWeek,
      assigneeId: '',
      teamId: proj?.teamId || '',
      type: 'TASK',
      storyPoints: 0,
      sprintName: '',
      projectId: proj?.id || ''
    });
    setTaskFiles([]);
    setCreateModalOpen(true);
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

      if (createFormData.projectId) {
        formData.append('projectId', createFormData.projectId);
      }
      
      formData.append('type', createFormData.type);
      formData.append('storyPoints', createFormData.storyPoints);
      formData.append('sprintName', createFormData.sprintName);
      
      for (let file of taskFiles) {
        formData.append('attachments', file);
      }

      const res = await api.post('/tasks', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const createdTask = res.data?.task || (res.data?.id ? res.data : null);
      const createdTasksList = res.data?.tasks || (createdTask ? [createdTask] : []);

      if (createdTasksList.length > 0) {
        setTasks(prev => [...createdTasksList, ...prev]);
      }

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
        sprintName: '',
        projectId: ''
      });
      setTaskFiles([]);
      setAlertMsg(res.data?.message || 'Task created successfully.');
      await fetchTasks();
      await fetchProjects();
    } catch (err) {
      setAlertMsg(err.response?.data?.message || 'Failed to assign task.');
    } finally {
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

  // Set of accessible project IDs from projectsList (single source of truth)
  const accessibleProjectIds = useMemo(
    () => new Set(projectsList.map(p => p.id)),
    [projectsList]
  );

  // Visible tasks: only tasks linked to an active, accessible project
  const visibleTasks = useMemo(() => {
    return tasks.filter(
      task =>
        task.projectId &&
        accessibleProjectIds.has(task.projectId)
    );
  }, [tasks, accessibleProjectIds]);

  // Filtered tasks: filter visibleTasks by search, sprint, priority, type, and selected project
  const filteredTasks = useMemo(() => {
    return visibleTasks.filter(t => {
      const matchesSearch = !searchQuery ||
                            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesSprint = selectedSprint === 'ALL' || t.sprintName === selectedSprint;
      const matchesPriority = selectedPriority === 'ALL' || t.priority === selectedPriority;
      const matchesType = selectedType === 'ALL' || t.type === selectedType;
      const matchesProject = selectedProject === 'ALL' || t.projectId === selectedProject;
      return matchesSearch && matchesSprint && matchesPriority && matchesType && matchesProject;
    });
  }, [visibleTasks, searchQuery, selectedSprint, selectedPriority, selectedType, selectedProject]);

  // Roadmap projects: active projects from projectsList
  const roadmapProjects = useMemo(() => {
    let result = projectsList.filter(p => accessibleProjectIds.has(p.id));
    if (selectedProject !== 'ALL') {
      result = result.filter(p => p.id === selectedProject);
    }
    return result;
  }, [projectsList, accessibleProjectIds, selectedProject]);

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

  const handleApproveTask = async (taskToApprove) => {
    try {
      const res = await api.post(`/tasks/${taskToApprove.id}/approve`, {
        message: 'Task approved by reviewer.'
      });
      setTasks(prev => prev.map(t => t.id === taskToApprove.id ? res.data : t));
      if (selectedTask && selectedTask.id === taskToApprove.id) {
        setSelectedTask(res.data);
      }
      await fetchTasks();
      await fetchProjects();
    } catch (err) {
      setAlertMsg(err.response?.data?.message || 'Failed to approve task.');
    }
  };

  const canDragTask = (task, proj) => {
    if (!user) return false;
    if (['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return true;

    const isAssignee = task.assigneeId === user.id;
    const isCreator = task.creatorId === user.id;
    const isProjectLeader = proj?.leaderId === user.id;
    const isProjectTeamLeader = proj?.team?.leaderId === user.id;
    const isProjectMember = proj?.members?.some(m => (m.userId || m.user?.id) === user.id);

    return isAssignee || isCreator || isProjectLeader || isProjectTeamLeader || isProjectMember;
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'BUG':
        return <Bug className="h-3.5 w-3.5 text-red-500" />;
      case 'STORY':
        return <Bookmark className="h-3.5 w-3.5 text-primary" fill="currentColor" />;
      default:
        return <CheckSquare className="h-3.5 w-3.5 text-sky-500" fill="currentColor" />;
    }
  };

  const getAvailableAssignees = (targetProjectId) => {
    if (!targetProjectId) return teamMembers;
    const project = projectsList.find(p => p.id === targetProjectId);
    if (!project) return teamMembers;

    const projectMemberUserIds = new Set();
    if (project.creatorId) projectMemberUserIds.add(project.creatorId);
    if (project.leaderId) projectMemberUserIds.add(project.leaderId);
    if (project.members) {
      project.members.forEach(m => projectMemberUserIds.add(m.userId));
    }

    const projectAssignees = teamMembers.filter(m => projectMemberUserIds.has(m.id));

    const projTeamObj = teams.find(t => t.id === project.teamId);
    const projTeamUserIds = new Set();
    if (projTeamObj) {
      if (projTeamObj.leaderId) projTeamUserIds.add(projTeamObj.leaderId);
      if (projTeamObj.members) projTeamObj.members.forEach(tm => projTeamUserIds.add(tm.userId || tm.user?.id));
    }

    return projectAssignees.map(m => {
      let badge = '';
      if (m.id === project.leaderId) {
        badge = ' (Team Leader)';
      } else if (project.teamId && !projTeamUserIds.has(m.id)) {
        badge = ' (External)';
      }
      return {
        ...m,
        displayName: `${m.name}${badge}`
      };
    });
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
          <div className="glass-card p-4 border border-white/70 dark:border-white/10 shadow-lg flex flex-col justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Work Completion</span>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xl font-black text-foreground">{rate}%</span>
              <div className="flex-1 bg-muted/60 h-2 rounded-full overflow-hidden border border-border/30">
                <div className="bg-primary h-full rounded-full" style={{ width: `${rate}%` }} />
              </div>
            </div>
          </div>

          <div className="glass-card p-4 border border-white/70 dark:border-white/10 shadow-lg">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Active Work items</span>
            <span className="text-xl font-black mt-2 block text-primary">{inProgress + review + pending} Open</span>
          </div>

          <div className="glass-card p-4 border border-white/70 dark:border-white/10 shadow-lg">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Total Sprints Weight</span>
            <span className="text-xl font-black mt-2 block text-primary">
              {filteredTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0)} Story Points
            </span>
          </div>

          <div className="glass-card p-4 border border-white/70 dark:border-white/10 shadow-lg">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block">Bugs Density</span>
            <span className="text-xl font-black mt-2 block text-rose-500">{bugs} Active Bugs</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Task Type Breakdown */}
          <div className="glass-card p-5 border border-white/70 dark:border-white/10 shadow-lg text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-3">Task Type Breakdown</h4>
            <div className="space-y-3">
              {[
                { type: 'User Stories', count: stories, pct: total > 0 ? Math.round((stories/total)*100) : 0, color: 'bg-primary' },
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



  const renderTimelineTab = () => {
    if (projectsList.length === 0) {
      return (
        <div className="bg-card border border-border/40 p-12 rounded-2xl shadow-sm text-center animate-in fade-in duration-300 space-y-2">
          <h3 className="text-sm font-bold text-foreground">No projects assigned</h3>
          <p className="text-xs text-muted-foreground">You do not have access to any projects yet.</p>
        </div>
      );
    }

    return (
      <div className="bg-card border border-border/40 p-6 rounded-2xl shadow-sm text-left animate-in fade-in duration-300 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-foreground">Workspace Roadmap</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Timeline schedule of active and future sprint deliverables.</p>
        </div>

        <div className="space-y-4">
          {roadmapProjects.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No roadmap projects found.</p>
          ) : (
            roadmapProjects.map((project, i) => {
              const colors = [
                'bg-indigo-500/20 border-indigo-500/40 text-indigo-500',
                'bg-violet-500/20 border-violet-500/40 text-violet-500',
                'bg-emerald-500/20 border-emerald-500/40 text-emerald-500',
                'bg-amber-500/20 border-amber-500/40 text-amber-500',
                'bg-sky-500/20 border-sky-500/40 text-sky-500'
              ];
              const color = colors[i % colors.length];
              const startDate = project.estimatedStartDate ? new Date(project.estimatedStartDate) : new Date();
              const endDate = project.estimatedEndDate ? new Date(project.estimatedEndDate) : new Date();
              const formattedStart = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const formattedEnd = endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

              const offset = (i * 10) % 35;
              const length = 40 + (i * 15) % 45;

              return (
                <div key={project.id} className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs">
                  <div className="w-52 shrink-0 font-bold truncate flex items-center justify-between gap-2 pr-2 border-r border-border/30">
                    <div className="truncate flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-bold">{project.projectCode || 'PRJ'}</span>
                      <span className="truncate text-foreground font-extrabold">{project.name}</span>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">{project.progress || 0}%</span>
                  </div>

                  <div className="flex-1 bg-muted/30 border border-border/20 rounded-lg h-8 relative flex items-center p-0.5 overflow-hidden">
                    <div
                      className={`absolute border rounded-md h-6 flex items-center justify-between px-2 text-[9px] font-bold ${color}`}
                      style={{ left: `${offset}%`, width: `${length}%` }}
                    >
                      <span className="truncate">{formattedStart} - {formattedEnd}</span>
                      <span className="text-[8px] uppercase tracking-wider font-extrabold ml-1">{project.health || 'On Track'}</span>
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
      { title: 'Innoveity Intern Onboarding Guide', desc: 'Step-by-step checklist for system configurations and access setup.', author: 'Admin', date: 'Jul 15, 2026' },
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
                <UserAvatar
                  key={i}
                  user={member}
                  className="h-6 w-6 rounded-full border border-card"
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

        {/* Sub Tab Navigation — visible only on Board */}
        {activeSubTab === 'Board' && (
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
        )}

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

          {/* Project Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Project:</span>
            <select
              className="text-[11px] py-1 px-2 rounded border bg-card max-w-[180px] truncate"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="ALL">All Projects ({projectsList.length})</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>
              ))}
            </select>
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
      </div>

      {/* Switch Render according to Sub Tab selected */}
      {activeSubTab === 'Board' ? (
        <div className="space-y-8 w-full max-w-full min-w-0 flex-1">
          {(() => {
            const activeProjects = (projectsList || []).filter(p => {
              if (p.isDeleted) return false;
              if (selectedProject !== 'ALL' && p.id !== selectedProject) return false;
              return true;
            });

            if (activeProjects.length === 0) {
              return (
                <div className="bg-[#FCFCFC] dark:bg-card border border-dashed border-[#E5E7EB] dark:border-border/60 rounded-3xl p-12 text-center space-y-3 shadow-xs">
                  <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto" />
                  <h3 className="text-sm font-bold text-foreground">No Projects Found</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    There are no active projects matching your selected filter parameters. Create a new project to start managing tasks.
                  </p>
                </div>
              );
            }

            return activeProjects.map(proj => {
              // Extract all tasks for this project
              const projTasks = filteredTasks.filter(t => t.projectId === proj.id);

              // Apply Role-Based Visibility
              let roleTasks = projTasks;
              if (user.role === 'INTERN' || user.role === 'EMPLOYEE') {
                roleTasks = projTasks.filter(t => t.assigneeId === user.id);
              }

              // Compute dynamic project progress %
              const totalTasksCount = roleTasks.length;
              const completedTasksCount = roleTasks.filter(t => {
                const stage = t.stage || (proj.workflowStages || []).find(s => s.id === t.stageId);
                if (!stage?.isCompletedStage) return false;
                if (stage.requiresApproval) return t.reviewStatus === 'APPROVED';
                return true;
              }).length;
              const progressPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

              return (
                <div key={proj.id} className="rounded-3xl border border-[#E5E7EB] bg-white dark:bg-card dark:border-border/50 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] space-y-4 text-left transition-all duration-250 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                  {/* Project Workspace Header Banner */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                          {proj.projectCode}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          proj.priority === 'URGENT' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                          proj.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                          'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        }`}>
                          {proj.priority || 'MEDIUM'} Priority
                        </span>
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase">
                          {proj.status}
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-foreground flex items-center gap-2 pt-0.5">
                        {proj.name}
                      </h3>
                      {proj.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{proj.description}</p>
                      )}
                    </div>

                    {/* Right side: Leader, Team & Progress Bar */}
                    <div className="flex flex-wrap items-center gap-5 shrink-0">
                      {/* Project Leader & Team info */}
                      <div className="flex items-center gap-2 bg-white dark:bg-muted/30 border border-[#E5E7EB] dark:border-border/40 px-3 py-1.5 rounded-2xl shadow-sm">
                        <div className="text-left text-[11px]">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase block leading-none">Leader & Team</span>
                          <span className="font-extrabold text-foreground block">{proj.leader?.name || 'Unassigned Leader'}</span>
                          <span className="text-[10px] text-muted-foreground font-semibold block">{proj.team?.name || 'General Workspace'}</span>
                        </div>
                      </div>

                      {/* Dynamic Progress Ring / Bar */}
                      <div className="w-44 bg-white dark:bg-muted/30 border border-[#E5E7EB] dark:border-border/40 p-2.5 rounded-2xl space-y-1 shadow-sm">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-muted-foreground uppercase">Completion</span>
                          <span className="text-primary font-black">{progressPct}% ({completedTasksCount}/{totalTasksCount})</span>
                        </div>
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden border border-border/20">
                          <div className="bg-gradient-primary h-full rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>

                      {['ADMIN', 'TEAM_LEADER'].includes(user.role) && (
                        <button
                          onClick={() => openCreateTaskForProject(proj)}
                          className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add Task</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Kanban Columns OR Empty State */}
                  {roleTasks.length === 0 ? (
                    <div className="border border-dashed border-[#E5E7EB] dark:border-border/60 bg-[#FCFCFC] dark:bg-muted/15 rounded-2xl p-8 text-center space-y-3">
                      <FolderOpen className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-foreground">This project is active but no tasks have been created yet.</p>
                        <p className="text-[11px] text-muted-foreground">
                          {user.role === 'INTERN' || user.role === 'EMPLOYEE'
                            ? 'No tasks are assigned to you in this project space.'
                            : 'Create the first task to start assigning tickets to team members.'}
                        </p>
                      </div>
                      {['ADMIN', 'TEAM_LEADER'].includes(user.role) && (
                        <button
                          onClick={() => openCreateTaskForProject(proj)}
                          className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Create First Task</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="w-full max-w-full min-w-0 flex overflow-x-auto gap-4 pb-2 scrollbar-thin">
                      {(() => {
                        const projStages = (proj.workflowStages && proj.workflowStages.length > 0)
                          ? proj.workflowStages
                          : [
                              { id: 'todo', name: 'To Do', color: '#64748B', isCompletedStage: false, requiresApproval: false, statuses: ['PENDING', 'REJECTED'] },
                              { id: 'in_progress', name: 'In Progress', color: '#EAB308', isCompletedStage: false, requiresApproval: false, statuses: ['IN_PROGRESS'] },
                              { id: 'in_review', name: 'In Review', color: '#8B5CF6', isCompletedStage: false, requiresApproval: true, statuses: ['WAITING_FOR_REVIEW'] },
                              { id: 'done', name: 'Done', color: '#10B981', isCompletedStage: true, requiresApproval: true, statuses: ['APPROVED', 'COMPLETED'] }
                            ];

                        return projStages.map((col) => {
                          const colTasks = roleTasks.filter(t => {
                            if (t.stageId && col.id && col.id !== 'todo' && col.id !== 'in_progress' && col.id !== 'in_review' && col.id !== 'done') {
                              return t.stageId === col.id;
                            }
                            if (col.statuses) {
                              return col.statuses.includes(t.status);
                            }
                            return false;
                          });

                          return (
                            <motion.div
                              layout
                              key={col.id || col.name}
                              className="flex flex-col shrink-0 min-w-[275px] max-w-[315px] bg-card/65 border border-border/30 rounded-xl p-3 h-full overflow-hidden transition-all duration-200"
                            >
                              {/* Column Header */}
                              <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/20">
                                <div className="flex items-center gap-2 truncate">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color || '#6366F1' }} />
                                  <span className="text-xs font-bold text-foreground tracking-wider uppercase truncate">{col.name}</span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {col.requiresApproval && (
                                    <span className="text-[9px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-md" title="Approval Required">
                                      Approval
                                    </span>
                                  )}
                                  {col.isCompletedStage && (
                                    <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md" title="Completed Stage">
                                      Done
                                    </span>
                                  )}
                                  <span className="text-[10px] bg-muted font-bold text-muted-foreground px-2 py-0.5 rounded-full">
                                    {colTasks.length}
                                  </span>
                                </div>
                              </div>

                              {/* Task Tickets list with AnimatePresence */}
                              <div className="space-y-3 overflow-visible max-h-none pr-1">
                                <AnimatePresence mode="popLayout">
                                  {colTasks.length === 0 ? (
                                    <motion.div
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="border border-dashed rounded-xl p-5 text-center text-[10px] text-muted-foreground"
                                    >
                                      No tickets
                                    </motion.div>
                                  ) : (
                                    colTasks.map((task) => {
                                      const isCanMove = canDragTask(task, proj);
                                      const isAdminRole = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);
                                      const canReview = ['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER'].includes(user?.role) ||
                                        (proj && (proj.leaderId === user?.id || proj.teamLeaderId === user?.id || proj.team?.leaderId === user?.id));

                                      const currentStageIdx = projStages.findIndex(s => s.id === task.stageId || s.name === col.name);
                                      const stageIndex = currentStageIdx >= 0 ? currentStageIdx : projStages.findIndex(s => col.statuses && col.statuses.includes(task.status));
                                      const effectiveIdx = stageIndex >= 0 ? stageIndex : 0;
                                      const currentStage = task.stage || projStages[effectiveIdx] || col;

                                      const isApprovalStage = Boolean(currentStage?.requiresApproval);
                                      const isPendingApproval = isApprovalStage && ['PENDING', 'RESUBMITTED'].includes(task.reviewStatus);
                                      const isRejected = isApprovalStage && task.reviewStatus === 'REJECTED';
                                      const isApproved = isApprovalStage && task.reviewStatus === 'APPROVED';
                                      const isCompleted = (currentStage?.isCompletedStage && isApproved) || task.status === 'COMPLETED';

                                      const canMoveForward = !isPendingApproval && !isRejected;
                                      const showArrows = !isAdminRole && isCanMove && canMoveForward;

                                      const isFirst = effectiveIdx === 0;
                                      const isLast = effectiveIdx === projStages.length - 1;
                                      
                                      const prevStage = !isFirst ? projStages[effectiveIdx - 1] : null;
                                      const nextStage = !isLast ? projStages[effectiveIdx + 1] : null;

                                      const handleStageMove = async (targetStage, direction) => {
                                         if (!targetStage) return;

                                         if (direction === 'forward' && targetStage.requiresApproval) {
                                           setPendingStageMove({ task, targetStage });
                                           setApprovalConfirmModalOpen(true);
                                           return;
                                         }

                                         await executeStageMove(task, targetStage);
                                       };

                                      let cardClassNames = "flex-1 min-w-0 p-3.5 space-y-2.5 text-left cursor-pointer transition-all bg-[linear-gradient(135deg,#F7FFF9_0%,#EEFDF5_30%,#E5F9EE_65%,#F4FFF8_100%)] dark:bg-card";
                                      if (isApprovalStage) {
                                        if (isRejected) {
                                          cardClassNames = "flex-1 min-w-0 p-3.5 space-y-2.5 text-left cursor-pointer transition-all bg-[linear-gradient(135deg,#FFF5F5_0%,#FFEBEB_40%,#FED7D7_100%)] dark:bg-red-950/30 border-l-4 border-l-red-500";
                                        } else if (isPendingApproval) {
                                          cardClassNames = "flex-1 min-w-0 p-3.5 space-y-2.5 text-left cursor-pointer transition-all bg-[linear-gradient(135deg,#FFFDF0_0%,#FEFCE8_40%,#FEF9C3_100%)] dark:bg-amber-950/30";
                                        }
                                      }

                                      return (
                                        <motion.div
                                          key={task.id}
                                          layout
                                          initial={{ opacity: 0, x: 12 }}
                                          animate={isPendingApproval ? { scale: [1, 1.02, 1], opacity: 1, x: 0 } : { opacity: 1, x: 0 }}
                                          exit={{ opacity: 0, x: -12 }}
                                          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                                          className="relative flex items-stretch w-full overflow-hidden rounded-[28px] border border-[#D9E7DF] dark:border-border/60 bg-white dark:bg-card shadow-xs hover:shadow-md hover:scale-[1.015] transition-all duration-150 ease-in-out group/wrapper"
                                        >
                                          {/* Left Arrow Handle: 92% height, -4px icon slide on hover, active scale(0.96) */}
                                          {showArrows && !isFirst && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleStageMove(prevStage, 'backward');
                                              }}
                                              className="w-[20px] sm:w-[22px] md:w-[24px] self-center my-auto h-[92%] bg-transparent hover:bg-transparent border-r border-[#E5EFE9] dark:border-border/40 flex items-center justify-center transition-all duration-150 ease-in-out active:scale-[0.96] cursor-pointer shrink-0 group/handle"
                                              title={`Move back to ${prevStage?.name}`}
                                            >
                                              <ChevronLeft className="w-[22px] h-[22px] text-[#111827] dark:text-foreground transition-transform duration-[180ms] ease-out group-hover/handle:-translate-x-1 shrink-0" />
                                            </button>
                                          )}

                                          {/* Task Card Main Content: Occupies 80-85% width */}
                                          <div
                                            onClick={() => openDetailModal(task)}
                                            className={cardClassNames}
                                          >
                                            {/* Title & Admin Review Buttons */}
                                            <div className="flex items-start justify-between gap-2">
                                              <h4 className="text-xs font-bold text-[#0F172A] dark:text-foreground group-hover/wrapper:text-primary leading-tight line-clamp-2">
                                                {task.title}
                                              </h4>

                                              {canReview && isApprovalStage && isPendingApproval && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                  <motion.button
                                                    type="button"
                                                    whileHover={{ scale: 1.15 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleApproveTask(task);
                                                    }}
                                                    className="w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-xs transition-transform cursor-pointer shrink-0"
                                                    title="Approve Task"
                                                  >
                                                    <Check className="w-3.5 h-3.5" />
                                                  </motion.button>
                                                  <motion.button
                                                    type="button"
                                                    whileHover={{ rotate: [0, -6, 6, -3, 3, 0], transition: { duration: 0.3 } }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setSelectedRejectTask(task);
                                                      setRejectModalOpen(true);
                                                    }}
                                                    className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-xs transition-transform cursor-pointer shrink-0"
                                                    title="Reject Task & Request Correction"
                                                  >
                                                    <X className="w-3.5 h-3.5" />
                                                  </motion.button>
                                                </div>
                                              )}
                                            </div>

                                            {/* Middle: Deadline & Type info */}
                                            <div className="flex flex-wrap items-center gap-2">
                                              <div className="flex items-center gap-1 rounded bg-white/70 dark:bg-muted/65 border border-emerald-500/10 px-1.5 py-0.5 text-[9px] text-[#64748B] dark:text-muted-foreground font-semibold">
                                                <Calendar className="h-2.5 w-2.5" />
                                                <span>{new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                              </div>

                                              {task.sprintName && (
                                                <span className="text-[8px] bg-emerald-100/60 dark:bg-slate-800 text-emerald-800 dark:text-muted-foreground px-1.5 py-0.5 rounded font-mono font-bold">
                                                  {task.sprintName}
                                                </span>
                                              )}
                                            </div>

                                            {/* Correction Preview for Rejected Cards */}
                                            {isApprovalStage && isRejected && (
                                              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] text-red-700 dark:text-red-300 space-y-0.5">
                                                <div className="flex items-center justify-between font-bold">
                                                  <span className="flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3 text-red-500" /> Correction Needed:
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      openDetailModal(task);
                                                    }}
                                                    className="text-red-600 dark:text-red-400 underline font-extrabold cursor-pointer hover:opacity-80"
                                                  >
                                                    More
                                                  </button>
                                                </div>
                                                <p className="line-clamp-2 leading-tight opacity-90">{task.correctionText || 'Voice correction clip provided by reviewer.'}</p>
                                              </div>
                                            )}

                                            {/* Bottom Bar: Key & Avatar left, Badges & Retry Button right */}
                                            <div className="flex items-center justify-between pt-2 border-t border-emerald-500/10 dark:border-border/20 gap-2">
                                              <div className="flex items-center gap-1.5">
                                                {getTypeIcon(task.type)}
                                                <span className="text-[9px] text-[#0EA5E9] font-mono font-bold">
                                                  MRF-{task.id.slice(0, 4).toUpperCase()}
                                                </span>
                                                <UserAvatar
                                                  user={task.assignee}
                                                  className="h-5 w-5 rounded-full border-2 border-white shadow-[0_2px_8px_rgba(16,185,129,0.20)] object-cover"
                                                />
                                              </div>

                                              <div className="shrink-0 flex items-center gap-1.5">
                                                {isApprovalStage && isRejected ? (
                                                  <>
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 text-[10px] font-extrabold border border-red-500/20">
                                                      <X className="w-3 h-3" /> Rejected ✕
                                                    </span>
                                                    {!isAdminRole && isCanMove && (
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setSelectedRetryTask(task);
                                                          setRetryModalOpen(true);
                                                        }}
                                                        className="group/retry px-2.5 py-0.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-extrabold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                                                        title="Retry task after corrections"
                                                      >
                                                        <RefreshCw className="w-3 h-3 group-hover/retry:rotate-180 transition-transform duration-500 ease-in-out" />
                                                        <span>Retry</span>
                                                      </button>
                                                    )}
                                                  </>
                                                ) : isApprovalStage && isPendingApproval ? (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold border border-amber-500/20" title="Waiting for reviewer approval">
                                                    <Clock className="w-3 h-3 animate-pulse" /> Pending Approval
                                                  </span>
                                                ) : (currentStage?.isCompletedStage && isApproved) || task.status === 'COMPLETED' ? (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-500/20">
                                                    <CheckCircle2 className="w-3 h-3" /> Completed ✓
                                                  </span>
                                                ) : isApprovalStage && isApproved ? (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-500/20">
                                                    <CheckCircle2 className="w-3 h-3" /> Approved ✓
                                                  </span>
                                                ) : null}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Right Arrow Handle: 92% height, +4px icon slide on hover, active scale(0.96) */}
                                          {showArrows && !isLast && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleStageMove(nextStage, 'forward');
                                              }}
                                              className="w-[20px] sm:w-[22px] md:w-[24px] self-center my-auto h-[92%] bg-transparent hover:bg-transparent border-l border-[#E5EFE9] dark:border-border/40 flex items-center justify-center transition-all duration-150 ease-in-out active:scale-[0.96] cursor-pointer shrink-0 group/handle"
                                              title={`Move forward to ${nextStage?.name}`}
                                            >
                                              <ChevronRight className="w-[22px] h-[22px] text-[#111827] dark:text-foreground transition-transform duration-[180ms] ease-out group-hover/handle:translate-x-1 shrink-0" />
                                            </button>
                                          )}
                                        </motion.div>
                                      );
                                    })
                                  )}
                                </AnimatePresence>
                              </div>
                            </motion.div>
                          );
                        });
                      })()}
                  </div>
                )}
                </div>
              );
            });
          })()}
        </div>
      ) : activeSubTab === 'Summary' ? (
        renderSummaryTab()
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

      {/* Create Task Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-3xl border border-border/40 bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 text-left space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-foreground">Create New Task Ticket</h3>
                <p className="text-xs text-muted-foreground">Assign work to a team member or entire team.</p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="rounded-full p-1.5 hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Task Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement OAuth login integration"
                  className="w-full text-xs p-2.5 bg-muted/20 border border-border/40 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                  value={createFormData.title}
                  onChange={(e) => setCreateFormData({ ...createFormData, title: e.target.value })}
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Description</label>
                <textarea
                  rows={3}
                  placeholder="Detailed task description and requirements..."
                  className="w-full text-xs p-2.5 bg-muted/20 border border-border/40 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                />
              </div>

              {/* Row 1: Project & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Project *</label>
                  <select
                    required
                    className="w-full text-xs p-2.5 bg-muted/20 border border-border/40 rounded-xl font-medium"
                    value={createFormData.projectId}
                    onChange={(e) => setCreateFormData({ ...createFormData, projectId: e.target.value })}
                  >
                    <option value="">Select Project...</option>
                    {projectsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Issue Type</label>
                  <select
                    className="w-full text-xs p-2.5 bg-muted/20 border border-border/40 rounded-xl font-medium"
                    value={createFormData.type}
                    onChange={(e) => setCreateFormData({ ...createFormData, type: e.target.value })}
                  >
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                    <option value="STORY">Story</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Priority & Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Priority</label>
                  <select
                    className="w-full text-xs p-2.5 bg-muted/20 border border-border/40 rounded-xl font-medium"
                    value={createFormData.priority}
                    onChange={(e) => setCreateFormData({ ...createFormData, priority: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Due Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full text-xs p-2.5 bg-muted/20 border border-border/40 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                    value={createFormData.deadline}
                    onChange={(e) => setCreateFormData({ ...createFormData, deadline: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 3: Assign Type & Assignee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Assign Target</label>
                  <select
                    className="w-full text-xs p-2.5 bg-muted/20 border border-border/40 rounded-xl font-medium"
                    value={assignType}
                    onChange={(e) => setAssignType(e.target.value)}
                  >
                    <option value="INDIVIDUAL">Individual Member</option>
                    <option value="TEAM">Entire Team</option>
                  </select>
                </div>

                {assignType === 'INDIVIDUAL' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground">Assignee *</label>
                    <select
                      required
                      className="w-full text-xs p-2.5 bg-muted/20 border border-border/40 rounded-xl font-medium"
                      value={createFormData.assigneeId}
                      onChange={(e) => setCreateFormData({ ...createFormData, assigneeId: e.target.value })}
                    >
                      <option value="">Select Assignee...</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground">Assignee Team *</label>
                    <select
                      required
                      className="w-full text-xs p-2.5 bg-muted/20 border border-border/40 rounded-xl font-medium"
                      value={createFormData.teamId}
                      onChange={(e) => setCreateFormData({ ...createFormData, teamId: e.target.value })}
                    >
                      <option value="">Select Team...</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Row 4: Sprint & Story Points */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Sprint Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sprint 1"
                    className="w-full text-xs p-2.5 bg-muted/20 border border-border/40 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                    value={createFormData.sprintName}
                    onChange={(e) => setCreateFormData({ ...createFormData, sprintName: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Story Points</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full text-xs p-2.5 bg-muted/20 border border-border/40 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                    value={createFormData.storyPoints}
                    onChange={(e) => setCreateFormData({ ...createFormData, storyPoints: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-border/30">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold border border-border/40 rounded-xl hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-xs font-bold bg-primary text-white rounded-xl shadow-md hover:bg-primary-hover transition-all disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Task Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details Dialog Modal (Independent Scroll Panels) */}
      {detailModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-6xl max-w-[95vw] rounded-3xl border border-border/40 bg-card p-6 shadow-2xl h-[90vh] max-h-[920px] flex flex-col overflow-hidden text-left space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary-hover rounded-full uppercase tracking-wider">
                    MRF-{selectedTask.id.slice(0, 4).toUpperCase()}
                  </span>
                  {selectedTask.type && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase bg-sky-500/15 text-sky-600 border border-sky-500/20">
                      {selectedTask.type}
                    </span>
                  )}
                  {selectedTask.reviewStatus && (
                    <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 border ${
                      selectedTask.reviewStatus === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' :
                      selectedTask.reviewStatus === 'REJECTED' ? 'bg-red-500/15 text-red-600 border-red-500/30' :
                      'bg-amber-500/15 text-amber-600 border-amber-500/30'
                    }`}>
                      {selectedTask.reviewStatus === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                      {selectedTask.reviewStatus === 'REJECTED' && <X className="w-3 h-3" />}
                      {selectedTask.reviewStatus === 'PENDING' && <Clock className="w-3 h-3 animate-pulse" />}
                      <span>Review: {selectedTask.reviewStatus}</span>
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-extrabold text-foreground leading-snug">{selectedTask.title}</h3>
              </div>

              <div className="flex items-center gap-2">
                {['ADMIN', 'TEAM_LEADER'].includes(user.role) && !isEditing && (
                  <button onClick={startEditing} className="rounded-xl px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-all cursor-pointer">
                    Edit Task
                  </button>
                )}
                <button className="rounded-full p-2 hover:bg-muted text-muted-foreground transition-colors cursor-pointer" onClick={() => { setDetailModalOpen(false); setIsEditing(false); }}>
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
              /* 2-Column Responsive Layout with Independent Scrolling */
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">
                {/* Left Panel (70% / 2 cols on Desktop - Independent Scroll) */}
                <div className="lg:col-span-2 h-full overflow-y-auto scrollbar-thin pr-3 space-y-6">
                  {/* Rejected Task Correction Banner */}
                  {selectedTask.reviewStatus === 'REJECTED' && (
                    <div className="p-4 bg-red-500/10 border-2 border-red-500/40 rounded-2xl space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-extrabold text-xs">
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                          <span>Correction Requested by Reviewer</span>
                        </div>
                        {!['ADMIN', 'SUPER_ADMIN'].includes(user?.role) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRetryTask(selectedTask);
                              setRetryModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Retry & Resubmit</span>
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-red-700 dark:text-red-300 font-semibold leading-relaxed">
                        {selectedTask.correctionText || 'Reviewer requested corrections before task approval.'}
                      </p>

                      {selectedTask.correctionAudioUrl && (
                        <AudioPlayer audioUrl={selectedTask.correctionAudioUrl} className="mt-2" />
                      )}
                    </div>
                  )}

                  {/* Assigned To Profile Card */}
                  <div className="p-3.5 bg-muted/20 border border-border/40 rounded-2xl shadow-xs">
                    <div className="flex items-center gap-3">
                      {selectedTask.assignee ? (
                        <UserAvatar
                          user={selectedTask.assignee}
                          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border-2 border-white dark:border-slate-800 shadow-sm object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assigned To</span>
                        <h5 className="text-sm font-semibold text-foreground truncate leading-tight mt-0.5">
                          {selectedTask.assignee?.name || 'Unassigned'}
                        </h5>
                        <span className="text-xs text-muted-foreground font-mono font-medium truncate">
                          {selectedTask.assignee
                            ? (selectedTask.assignee.employeeId || selectedTask.assignee.internId || selectedTask.assignee.employeeCode || 'ID: N/A')
                            : 'No assignee selected'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Task Description */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</h4>
                    <div className="p-4 bg-muted/20 border border-border/30 rounded-2xl text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedTask.description || 'No detailed description provided.'}
                    </div>
                  </div>

                  {/* Checklist Subtasks */}
                  <div className="space-y-2 border-t border-border/30 pt-4 text-left">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subtask Checklist</h4>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {selectedTask.subtasks?.filter(s => s.isDone).length || 0} of {selectedTask.subtasks?.length || 0} completed
                      </span>
                    </div>

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

                    <div className="space-y-1.5 mt-2">
                      {selectedTask.subtasks?.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between bg-muted/20 border border-border/30 rounded-xl p-2.5 text-xs hover:bg-muted/40 transition-all">
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input 
                              type="checkbox" 
                              checked={sub.isDone} 
                              onChange={(e) => handleToggleSubtask(sub.id, e.target.checked)} 
                            />
                            <span className={sub.isDone ? 'line-through text-muted-foreground' : 'text-foreground font-semibold'}>
                              {sub.title}
                            </span>
                          </label>
                          <button 
                            type="button"
                            onClick={() => handleDeleteSubtask(sub.id)}
                            className="text-muted-foreground hover:text-red-500 rounded p-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}

                      {selectedTask.subtasks?.length === 0 && (
                        <p className="text-[10px] text-muted-foreground py-2 text-center">No checklist items added.</p>
                      )}
                    </div>

                    <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2">
                      <input 
                        type="text" 
                        placeholder="Add subtask checklist item..." 
                        className="flex-1 text-xs p-2 bg-muted/20 border border-border/40 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      />
                      <button 
                        type="submit" 
                        className="bg-primary hover:bg-primary-hover text-white rounded-xl px-3 py-2 text-xs font-bold shadow-xs cursor-pointer transition-all"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                  {/* Task Reference Attachments */}
                  {selectedTask.attachments?.length > 0 && (
                    <div className="border-t border-border/30 pt-4 space-y-2">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Task Reference Attachments</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedTask.attachments.map((file, i) => (
                          <button
                            key={i} 
                            type="button"
                            onClick={() => downloadFile(file)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/40 text-[11px] font-semibold bg-muted/20 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer"
                            title="Download Attachment"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            <span>Attachment #{i + 1}</span>
                            <Download className="h-3.5 w-3.5 ml-1 opacity-70" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Task Review Audit History Timeline */}
                  {selectedTask.reviewHistory && selectedTask.reviewHistory.length > 0 && (
                    <div className="space-y-3 border-t border-border/30 pt-4">
                      <div className="flex items-center gap-2 text-foreground">
                        <History className="w-4 h-4 text-primary" />
                        <h4 className="text-xs font-extrabold uppercase tracking-wider">Review Audit History</h4>
                      </div>

                      <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                        {selectedTask.reviewHistory.map(item => (
                          <div key={item.id} className="p-3.5 bg-muted/20 border border-border/30 rounded-2xl text-xs space-y-2 shadow-xs">
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                                item.action === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' :
                                item.action === 'REJECTED' ? 'bg-red-500/15 text-red-600 border-red-500/20' :
                                'bg-amber-500/15 text-amber-600 border-amber-500/20'
                              }`}>
                                {item.action}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {new Date(item.createdAt).toLocaleString()}
                              </span>
                            </div>

                            <p className="text-xs text-foreground font-semibold leading-relaxed">{item.message}</p>

                            {item.audioUrl && (
                              <AudioPlayer audioUrl={item.audioUrl} className="mt-1" />
                            )}

                            <div className="text-[10px] text-muted-foreground">
                              By: <span className="font-bold text-foreground">{item.createdBy?.name || 'Reviewer'}</span> ({item.createdBy?.role})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Panel (30% / 1 col on Desktop - Fixed Chat Panel) */}
                <div className="lg:col-span-1 h-full overflow-hidden flex flex-col">
                  <TaskDiscussionPanel
                    taskId={selectedTask.id}
                    currentUser={user}
                    initialComments={selectedTask.comments || []}
                    className="h-full"
                  />
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
      {/* Reject Task Modal */}
      <RejectModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        task={selectedRejectTask}
        onTaskRejected={async (updated) => {
          setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
          if (selectedTask && selectedTask.id === updated.id) {
            setSelectedTask(updated);
          }
          await fetchTasks();
          await fetchProjects();
        }}
      />

      {/* Retry Task Modal */}
      <RetryModal
        isOpen={retryModalOpen}
        onClose={() => setRetryModalOpen(false)}
        task={selectedRetryTask}
        onTaskRetried={async (updated) => {
          setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
          if (selectedTask && selectedTask.id === updated.id) {
            setSelectedTask(updated);
          }
          await fetchTasks();
          await fetchProjects();
        }}
      />

      {/* Approval Confirmation Modal */}
      <ConfirmModal
        isOpen={approvalConfirmModalOpen}
        onClose={() => {
          setApprovalConfirmModalOpen(false);
          setPendingStageMove(null);
        }}
        onConfirm={async () => {
          if (pendingStageMove) {
            const { task: taskToMove, targetStage } = pendingStageMove;
            setApprovalConfirmModalOpen(false);
            setPendingStageMove(null);
            await executeStageMove(taskToMove, targetStage);
          }
        }}
        title="Are you sure?"
        message="This task will be submitted for approval and cannot be moved until it is approved."
        confirmText="Yes"
        cancelText="No"
      />
    </div>
  );
};

export default Tasks;
