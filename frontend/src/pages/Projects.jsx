import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getUploadUrl, downloadFile } from '../services/api';
import {
  FolderOpen,
  Plus,
  Search,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PauseCircle,
  Archive,
  FileText,
  Users,
  UserCheck,
  Briefcase,
  ChevronRight,
  Upload,
  Download,
  Trash2,
  Edit3,
  MessageSquare,
  History,
  Activity,
  Layers,
  ArrowRight,
  X,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import UserAvatar from '../components/common/UserAvatar';
import {
  ProjectCard,
  ProjectStatusBadge,
  PriorityBadge,
  ProgressRing,
  MemberAvatarGroup,
  TaskCard,
  KanbanColumn,
  MilestoneCard,
  ActivityItem
} from '../components/project';

const Projects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    overdue: 0,
    completed: 0,
    onHold: 0,
    cancelled: 0,
    draft: 0,
    scheduled: 0,
    archived: 0
  });

  const [activeTab, setActiveTab] = useState('ALL');
  const urlSearch = new URLSearchParams(location.search).get('search') || '';
  const [searchQuery, setSearchQuery] = useState(urlSearch);

  useEffect(() => {
    const sParam = new URLSearchParams(location.search).get('search') || '';
    setSearchQuery(sParam);
  }, [location.search]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [drawerTab, setDrawerTab] = useState('Overview'); // Overview, Kanban Board, Milestones, Project Calendar, Documents, Audit History

  // Users & Teams for dropdown selectors
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  // Milestone creation modal
  const [createMilestoneModal, setCreateMilestoneModal] = useState(false);
  const [milestoneFormData, setMilestoneFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    status: 'PENDING'
  });

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'CLIENT',
    priority: 'MEDIUM',
    status: 'DRAFT',
    estimatedStartDate: '',
    estimatedEndDate: '',
    teamId: '',
    leaderId: '',
    memberIds: []
  });

  const [fileUpload, setFileUpload] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await api.get('/projects');
      setProjects(res.data.projects || []);
      setMetrics(res.data.metrics || {});
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setAlertMsg('Failed to load projects.');
      setLoading(false);
    }
  };

  const fetchUsersAndTeams = async () => {
    try {
      const userRes = await api.get('/users?limit=1000&status=ACTIVE');
      const usersList = userRes.data.users || [];
      setAllUsers(usersList);
      setTeamLeaders(usersList.filter(u => u.role === 'ADMIN' || u.role === 'TEAM_LEADER'));

      const teamRes = await api.get('/teams');
      setTeams(teamRes.data || []);
    } catch (err) {
      console.error('Failed to fetch dropdown data:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchUsersAndTeams();
  }, []);

  const handleTeamSelect = (newTeamId) => {
    if (newTeamId === formData.teamId) {
      // Re-selecting exact same team preserves existing manual choices
      return;
    }

    if (!newTeamId) {
      setFormData(prev => ({
        ...prev,
        teamId: '',
        memberIds: prev.leaderId ? [prev.leaderId] : []
      }));
      return;
    }

    const selectedTeam = teams.find(t => t.id === newTeamId);
    const activeMembers = [];

    if (selectedTeam) {
      if (selectedTeam.leaderId) {
        const leaderUser = allUsers.find(u => u.id === selectedTeam.leaderId);
        if (leaderUser && leaderUser.status !== 'INACTIVE') {
          activeMembers.push(selectedTeam.leaderId);
        }
      }
      if (selectedTeam.members) {
        selectedTeam.members.forEach(m => {
          const uId = m.userId || m.user?.id;
          const memberUser = allUsers.find(u => u.id === uId);
          if (memberUser && memberUser.status !== 'INACTIVE') {
            activeMembers.push(uId);
          }
        });
      }
    }

    if (formData.leaderId && !activeMembers.includes(formData.leaderId)) {
      activeMembers.push(formData.leaderId);
    }

    const finalMemberIds = Array.from(new Set(activeMembers.filter(Boolean)));
    setFormData(prev => ({
      ...prev,
      teamId: newTeamId,
      memberIds: finalMemberIds
    }));
  };

  const handleLeaderSelect = (newLeaderId) => {
    setFormData(prev => {
      let updatedMembers = [...prev.memberIds];
      if (newLeaderId && !updatedMembers.includes(newLeaderId)) {
        updatedMembers.push(newLeaderId);
      }
      return {
        ...prev,
        leaderId: newLeaderId,
        memberIds: Array.from(new Set(updatedMembers.filter(Boolean)))
      };
    });
  };

  const openCreateModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const defaultLeaderId = user?.id || '';

    setFormData({
      name: '',
      description: '',
      type: 'CLIENT',
      priority: 'MEDIUM',
      status: 'ACTIVE',
      estimatedStartDate: today,
      estimatedEndDate: nextMonth,
      teamId: '',
      leaderId: defaultLeaderId,
      memberIds: defaultLeaderId ? [defaultLeaderId] : []
    });
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (new Date(formData.estimatedEndDate) <= new Date(formData.estimatedStartDate)) {
      setAlertMsg('Estimated End Date must be after Estimated Start Date.');
      return;
    }
    if (formData.teamId && formData.memberIds.length === 0) {
      setAlertMsg('Please select at least one project member.');
      return;
    }

    try {
      const res = await api.post('/projects', formData);
      setAlertMsg(`Project "${res.data.project.name}" (${res.data.project.projectCode}) created successfully.`);
      setCreateModalOpen(false);
      fetchProjects();
    } catch (err) {
      setAlertMsg(err.response?.data?.message || 'Failed to create project.');
    }
  };

  const openEditModal = (proj) => {
    setSelectedProject(proj);
    const existingMemberIds = proj.members?.map(m => m.userId) || [];
    if (proj.leaderId && !existingMemberIds.includes(proj.leaderId)) {
      existingMemberIds.push(proj.leaderId);
    }
    setFormData({
      name: proj.name,
      description: proj.description || '',
      type: proj.type,
      priority: proj.priority,
      status: proj.status,
      estimatedStartDate: new Date(proj.estimatedStartDate).toISOString().split('T')[0],
      estimatedEndDate: new Date(proj.estimatedEndDate).toISOString().split('T')[0],
      teamId: proj.teamId || '',
      leaderId: proj.leaderId || '',
      memberIds: Array.from(new Set(existingMemberIds))
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (new Date(formData.estimatedEndDate) <= new Date(formData.estimatedStartDate)) {
      setAlertMsg('Estimated End Date must be after Estimated Start Date.');
      return;
    }
    if (formData.teamId && formData.memberIds.length === 0) {
      setAlertMsg('Please select at least one project member.');
      return;
    }

    try {
      const res = await api.put(`/projects/${selectedProject.id}`, formData);
      setAlertMsg(`Project "${res.data.project.name}" updated successfully.`);
      setEditModalOpen(false);
      fetchProjects();
      if (detailDrawerOpen && selectedProject?.id === res.data.project.id) {
        setSelectedProject(res.data.project);
      }
    } catch (err) {
      setAlertMsg(err.response?.data?.message || 'Failed to update project.');
    }
  };

  const openDetailDrawer = async (proj) => {
    try {
      const res = await api.get(`/projects/${proj.id}`);
      setSelectedProject(res.data);
      setDetailDrawerOpen(true);
    } catch (err) {
      setAlertMsg('Failed to load project details.');
    }
  };

  const handleDeleteProject = async (projId) => {
    if (!window.confirm('Are you sure you want to delete this project? The chat group will be archived and saved.')) return;
    try {
      await api.delete(`/projects/${projId}`);
      setAlertMsg('Project deleted and archived successfully.');
      setDetailDrawerOpen(false);
      fetchProjects();
    } catch (err) {
      setAlertMsg(err.response?.data?.message || 'Failed to delete project.');
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!fileUpload || !selectedProject) return;
    try {
      setUploadingDoc(true);
      const data = new FormData();
      data.append('file', fileUpload);

      const res = await api.post(`/projects/${selectedProject.id}/documents`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSelectedProject({
        ...selectedProject,
        documents: [res.data.document, ...(selectedProject.documents || [])]
      });

      setFileUpload(null);
      setUploadingDoc(false);
      setAlertMsg('Document uploaded successfully.');
    } catch (err) {
      setUploadingDoc(false);
      setAlertMsg(err.response?.data?.message || 'Failed to upload document.');
    }
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await api.delete(`/projects/${selectedProject.id}/documents/${docId}`);
      setSelectedProject({
        ...selectedProject,
        documents: selectedProject.documents.filter(d => d.id !== docId)
      });
      setAlertMsg('Document removed successfully.');
    } catch (err) {
      setAlertMsg('Failed to delete document.');
    }
  };

  const handleCreateMilestone = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      const res = await api.post('/milestones', {
        projectId: selectedProject.id,
        ...milestoneFormData
      });
      setSelectedProject({
        ...selectedProject,
        milestones: [...(selectedProject.milestones || []), res.data]
      });
      setCreateMilestoneModal(false);
      setMilestoneFormData({ title: '', description: '', dueDate: '', status: 'PENDING' });
      setAlertMsg(`Milestone "${res.data.title}" created successfully.`);
    } catch (err) {
      setAlertMsg(err.response?.data?.message || 'Failed to create milestone.');
    }
  };

  const handleTaskDrop = async (e, targetStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    try {
      const res = await api.put(`/tasks/${taskId}/status`, { status: targetStatus });
      setSelectedProject({
        ...selectedProject,
        tasks: selectedProject.tasks.map(t => t.id === taskId ? res.data : t)
      });
      fetchProjects();
    } catch (err) {
      setAlertMsg('Failed to update task status.');
    }
  };

  // Filter projects by active tab and search query
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === 'ALL') return !p.isDeleted;
    if (activeTab === 'ACTIVE') return p.status === 'ACTIVE';
    if (activeTab === 'OVERDUE') return p.isOverdue;
    if (activeTab === 'DRAFT') return p.status === 'DRAFT';
    if (activeTab === 'SCHEDULED') return p.status === 'SCHEDULED';
    if (activeTab === 'ON_HOLD') return p.status === 'ON_HOLD';
    if (activeTab === 'COMPLETED') return p.status === 'COMPLETED';
    if (activeTab === 'CANCELLED') return p.status === 'CANCELLED';
    if (activeTab === 'ARCHIVED') return p.status === 'ARCHIVED';

    return true;
  });

  return (
    <div className="flex-1 flex flex-col space-y-6 text-left">
      {/* Alert Banner */}
      {alertMsg && (
        <div className="bg-primary/10 border border-primary/30 text-primary px-4 py-3 rounded-2xl flex items-center justify-between animate-in fade-in duration-300">
          <span className="text-xs font-bold">{alertMsg}</span>
          <button onClick={() => setAlertMsg('')} className="text-primary hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <FolderOpen className="w-7 h-7 text-primary" /> Enterprise Projects
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Manage project lifecycles, 1:1 project chat groups, milestones, and Kanban workflows.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search Box near Create New Project button */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by code or title..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
            />
          </div>

          {(user?.role === 'ADMIN' || user?.role === 'TEAM_LEADER') && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-md shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 text-white" /> Create New Project
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Projects</div>
          <div className="text-2xl font-black text-foreground">{metrics.total}</div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-primary">Active</div>
          <div className="text-2xl font-black text-primary">{metrics.active}</div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-amber-500">Overdue</div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{metrics.overdue}</div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-blue-500">Completed</div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{metrics.completed}</div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-orange-500">On Hold</div>
          <div className="text-2xl font-black text-orange-600 dark:text-orange-400">{metrics.onHold}</div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-gray-500">Archived</div>
          <div className="text-2xl font-black text-gray-600 dark:text-gray-400">{metrics.archived}</div>
        </div>
      </div>

      {/* Centered Filter Tabs */}
      <div className="flex items-center justify-center border-b border-border/40 pb-4">
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'All Projects' },
            { id: 'ACTIVE', label: 'Active' },
            { id: 'OVERDUE', label: 'Overdue' },
            { id: 'DRAFT', label: 'Draft' },
            { id: 'SCHEDULED', label: 'Scheduled' },
            { id: 'ON_HOLD', label: 'On Hold' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'ARCHIVED', label: 'Archived' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards Grid */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm font-bold animate-pulse">
          Loading project workspace...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-2xl border border-border/40 p-8 space-y-3">
          <FolderOpen className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h3 className="text-base font-bold text-foreground">No projects found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            No projects match the selected filter criteria. Click "Create New Project" to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map(proj => (
            <ProjectCard
              key={proj.id}
              project={proj}
              onSelect={() => openDetailDrawer(proj)}
              onOpenChat={() => navigate('/chat')}
            />
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-2xl rounded-3xl border border-white/80 dark:border-white/10 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/15 border border-primary/20 text-primary">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-foreground">Create New Project</h2>
                  <p className="text-xs text-muted-foreground">Setup project schedule, priority, team leader & member permissions</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateSubmit} className="p-6 overflow-y-auto space-y-5 text-left flex-1">
              {/* Project Name */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5 flex items-center justify-between">
                  <span>Project Name <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Website Redesign"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-muted/30 border border-border/80 text-sm text-foreground placeholder:text-muted-foreground/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">Description</label>
                <textarea
                  rows={3}
                  placeholder="Brief summary of goals, scope, and target deliverables..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-muted/30 border border-border/80 text-sm text-foreground placeholder:text-muted-foreground/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                />
              </div>

              {/* Type, Priority, Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">Project Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/30 border border-border/80 text-xs font-semibold text-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="CLIENT">Client Project</option>
                    <option value="INTERNAL">Internal Improvement</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="RND">R&D / Research</option>
                    <option value="TRAINING">Intern Training</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/30 border border-border/80 text-xs font-semibold text-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="LOW">🟢 Low</option>
                    <option value="MEDIUM">🟡 Medium</option>
                    <option value="HIGH">🟠 High</option>
                    <option value="CRITICAL">🔴 Critical</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">Initial Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/30 border border-border/80 text-xs font-bold text-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="DRAFT">Draft (No Chat)</option>
                    <option value="SCHEDULED">Scheduled (No Chat)</option>
                    <option value="ACTIVE">Active (Creates Chat)</option>
                  </select>
                </div>
              </div>

              {/* Timeline Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/20 border border-border/40">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">Estimated Start Date <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={formData.estimatedStartDate}
                    onChange={e => setFormData({ ...formData, estimatedStartDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-border/80 text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">Estimated End Date <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={formData.estimatedEndDate}
                    onChange={e => setFormData({ ...formData, estimatedEndDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-border/80 text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Leader & Team Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">Project Leader</label>
                  <select
                    value={formData.leaderId}
                    onChange={e => handleLeaderSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/30 border border-border/80 text-xs font-medium text-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="">-- Unassigned --</option>
                    {teamLeaders.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">Assigned Team (Optional)</label>
                  <select
                    value={formData.teamId}
                    onChange={e => handleTeamSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/30 border border-border/80 text-xs font-medium text-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="">-- No Team --</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Member Selection */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Select Project Members ({formData.memberIds.length} selected)
                </label>
                
                {(() => {
                  const selectedTeamObj = teams.find(t => t.id === formData.teamId);
                  const teamMemberUserIds = new Set();
                  if (selectedTeamObj) {
                    if (selectedTeamObj.leaderId) teamMemberUserIds.add(selectedTeamObj.leaderId);
                    if (selectedTeamObj.members) {
                      selectedTeamObj.members.forEach(m => teamMemberUserIds.add(m.userId || m.user?.id));
                    }
                  }
                  const activeUsers = allUsers.filter(u => u.status !== 'INACTIVE');

                  return (
                    <div className="max-h-48 overflow-y-auto p-3 rounded-2xl bg-muted/30 border border-border/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeUsers.map(u => {
                        const isSelected = formData.memberIds.includes(u.id);
                        const isLeader = formData.leaderId && u.id === formData.leaderId;
                        const isExternal = formData.teamId && isSelected && !teamMemberUserIds.has(u.id);

                        return (
                          <label
                            key={u.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs cursor-pointer border transition-all ${
                              isSelected
                                ? 'bg-primary/10 border-primary/40 text-foreground font-bold shadow-2xs'
                                : 'bg-background/60 border-border/40 text-muted-foreground hover:text-foreground hover:bg-background'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected || isLeader}
                              disabled={isLeader}
                              onChange={e => {
                                if (isLeader) return;
                                if (e.target.checked) {
                                  setFormData(prev => ({ ...prev, memberIds: Array.from(new Set([...prev.memberIds, u.id])) }));
                                } else {
                                  setFormData(prev => ({ ...prev, memberIds: prev.memberIds.filter(id => id !== u.id) }));
                                }
                              }}
                              className="rounded border-border text-primary focus:ring-primary/20 h-4 w-4 disabled:opacity-70"
                            />
                            <div className="flex-1 truncate">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="truncate block font-semibold">{u.name}</span>
                                {isLeader && (
                                  <span className="bg-primary/15 text-primary text-[9px] px-1.5 py-0.2 rounded-md font-bold shrink-0">
                                    Project Leader
                                  </span>
                                )}
                                {isExternal && !isLeader && (
                                  <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] px-1.5 py-0.2 rounded-md font-bold shrink-0">
                                    External
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono uppercase block">{u.role}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  );
                })()}
                
                <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">
                  Team members are automatically selected. Uncheck members who should not participate in this project.
                </p>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border/80 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" /> Create Project & Initialize Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {detailDrawerOpen && selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="bg-card w-full max-w-3xl max-w-[95vw] min-w-0 h-full shadow-2xl flex flex-col justify-between border-l border-border/80 text-left">
            {/* Drawer Header */}
            <div className="p-6 border-b border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-md bg-muted text-primary text-xs font-mono font-black tracking-wider border">
                  {selectedProject.projectCode}
                </span>
                <div className="flex items-center gap-2">
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => handleDeleteProject(selectedProject.id)}
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10"
                      title="Soft Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setDetailDrawerOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-black text-foreground">{selectedProject.name}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <ProjectStatusBadge status={selectedProject.status} isOverdue={selectedProject.isOverdue} health={selectedProject.health} />
                  <PriorityBadge priority={selectedProject.priority} />
                </div>
              </div>
            </div>

            {/* Drawer Sub Navigation Tabs */}
            <div className="px-6 pt-4 border-b border-border/40">
              <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none">
                {['Overview', 'Team Members', 'Kanban Board', 'Milestones', 'Documents', 'Audit History'].map(t => (
                  <button
                    key={t}
                    onClick={() => setDrawerTab(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      drawerTab === t
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Drawer Content */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {drawerTab === 'Overview' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/30">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Project Progress</span>
                      <div className="text-lg font-black text-foreground">{selectedProject.progressPercent || 0}% Completed</div>
                      <p className="text-xs text-muted-foreground">{selectedProject.tasks?.filter(t => t.status === 'APPROVED' || t.status === 'COMPLETED').length || 0} of {selectedProject.tasks?.length || 0} tasks finished</p>
                    </div>
                    <ProgressRing progress={selectedProject.progressPercent || 0} size={64} strokeWidth={6} />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</h4>
                    <p className="text-sm text-foreground bg-muted/30 p-4 rounded-2xl border border-border/40">
                      {selectedProject.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Est. Start Date</span>
                      <div className="text-sm font-bold text-foreground">
                        {new Date(selectedProject.estimatedStartDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Est. End Date</span>
                      <div className={`text-sm font-bold ${selectedProject.isOverdue ? 'text-rose-500 font-black' : 'text-foreground'}`}>
                        {new Date(selectedProject.estimatedEndDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Team Members Tab */}
              {drawerTab === 'Team Members' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Assigned Members ({selectedProject.members?.length || 0})
                  </h4>

                  {(() => {
                    const projTeamObj = teams.find(t => t.id === selectedProject.teamId);
                    const projTeamMembers = new Set();
                    if (projTeamObj) {
                      if (projTeamObj.leaderId) projTeamMembers.add(projTeamObj.leaderId);
                      if (projTeamObj.members) projTeamObj.members.forEach(tm => projTeamMembers.add(tm.userId || tm.user?.id));
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedProject.members?.map(m => {
                          const isLeader = selectedProject.leaderId === m.userId;
                          const isExternal = selectedProject.teamId && !projTeamMembers.has(m.userId);

                          return (
                            <div key={m.userId} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border border-border/40">
                              <UserAvatar user={m.user} size="sm" />
                              <div className="truncate flex-1">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="text-xs font-bold text-foreground truncate">{m.user?.name}</span>
                                  {isLeader && (
                                    <span className="bg-primary/15 text-primary text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0">
                                      Leader
                                    </span>
                                  )}
                                  {isExternal && !isLeader && (
                                    <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0">
                                      External
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground">{m.role || m.user?.role}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Kanban Board Tab */}
              {drawerTab === 'Kanban Board' && (
                <div className="flex overflow-x-auto gap-3 pb-2 w-full max-w-full min-w-0 scrollbar-thin">
                  {[
                    { title: 'TO DO', status: 'PENDING', color: 'bg-slate-500' },
                    { title: 'IN PROGRESS', status: 'IN_PROGRESS', color: 'bg-sky-500' },
                    { title: 'UNDER REVIEW', status: 'WAITING_FOR_REVIEW', color: 'bg-amber-500' },
                    { title: 'DONE', status: 'APPROVED', color: 'bg-primary' }
                  ].map(col => {
                    const colTasks = selectedProject.tasks?.filter(t => t.status === col.status) || [];
                    return (
                      <KanbanColumn
                        key={col.title}
                        title={col.title}
                        count={colTasks.length}
                        color={col.color}
                        onDrop={(e) => handleTaskDrop(e, col.status)}
                      >
                        {colTasks.length === 0 ? (
                          <div className="text-[10px] text-muted-foreground py-8 text-center italic border border-dashed rounded-xl">
                            No tasks
                          </div>
                        ) : (
                          colTasks.map(t => (
                            <TaskCard key={t.id} task={t} />
                          ))
                        )}
                      </KanbanColumn>
                    );
                  })}
                </div>
              )}

              {/* Milestones Tab */}
              {drawerTab === 'Milestones' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Milestones ({selectedProject.milestones?.length || 0})
                    </h4>
                    {(user?.role === 'ADMIN' || user?.role === 'TEAM_LEADER') && (
                      <button
                        onClick={() => setCreateMilestoneModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary-hover flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Milestone
                      </button>
                    )}
                  </div>

                  {selectedProject.milestones?.length === 0 ? (
                    <div className="text-center py-10 border border-dashed rounded-2xl p-6 text-muted-foreground text-xs italic">
                      No milestones set for this project.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedProject.milestones?.map(m => (
                        <MilestoneCard key={m.id} milestone={m} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Project Calendar Tab */}
              {drawerTab === 'Project Calendar' && (
                <div className="space-y-4 p-4 rounded-2xl bg-card border border-border/40">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" /> Key Project Dates & Deadlines
                  </h4>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30 text-xs">
                      <span className="font-bold">Project Start Date</span>
                      <span className="font-mono text-muted-foreground">{new Date(selectedProject.estimatedStartDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30 text-xs">
                      <span className="font-bold">Project End Date</span>
                      <span className="font-mono text-muted-foreground">{new Date(selectedProject.estimatedEndDate).toLocaleDateString()}</span>
                    </div>
                    {selectedProject.milestones?.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs">
                        <span className="font-bold text-primary">Milestone: {m.title}</span>
                        <span className="font-mono text-muted-foreground">{new Date(m.dueDate).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents Tab */}
              {drawerTab === 'Documents' && (
                <div className="space-y-4">
                  <form onSubmit={handleUploadDocument} className="p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Upload Project Document</h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        onChange={e => setFileUpload(e.target.files[0])}
                        className="text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary file:text-primary-foreground hover:file:bg-primary-hover"
                      />
                      <button
                        type="submit"
                        disabled={!fileUpload || uploadingDoc}
                        className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
                      >
                        {uploadingDoc ? 'Uploading...' : 'Upload'}
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2">
                    {selectedProject.documents?.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/40">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-primary" />
                          <div>
                            <div className="text-xs font-bold text-foreground">{doc.name}</div>
                            <div className="text-[10px] text-muted-foreground">Uploaded by {doc.uploader?.name}</div>
                          </div>
                        </div>
                        <button onClick={() => downloadFile(doc.fileUrl)} className="p-2 rounded-xl text-primary hover:bg-primary/10">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit History Tab */}
              {drawerTab === 'Audit History' && (
                <div className="space-y-3">
                  {selectedProject.history?.map(item => (
                    <ActivityItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Milestone Modal */}
      {createMilestoneModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-3xl border border-white/80 dark:border-white/10 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/15 border border-primary/20 text-primary">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Create Project Milestone</h3>
                  <p className="text-[11px] text-muted-foreground">Define major deliverable target dates</p>
                </div>
              </div>
              <button
                onClick={() => setCreateMilestoneModal(false)}
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateMilestone} className="p-6 space-y-4 text-left">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Milestone Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Authentication Module & Role Assignment"
                  value={milestoneFormData.title}
                  onChange={e => setMilestoneFormData({ ...milestoneFormData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/30 border border-border/80 text-xs font-medium text-foreground placeholder:text-muted-foreground/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">Description</label>
                <textarea
                  rows={2}
                  placeholder="Milestone scope and key acceptance criteria..."
                  value={milestoneFormData.description}
                  onChange={e => setMilestoneFormData({ ...milestoneFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/30 border border-border/80 text-xs font-medium text-foreground placeholder:text-muted-foreground/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Target Due Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={milestoneFormData.dueDate}
                  onChange={e => setMilestoneFormData({ ...milestoneFormData, dueDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/30 border border-border/80 text-xs font-medium text-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setCreateMilestoneModal(false)}
                  className="px-4 py-2 rounded-xl border border-border/80 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                >
                  Save Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
