import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { getUploadUrl } from '../services/api';
import {
  Plus,
  Users,
  Briefcase,
  Trash2,
  X,
  Edit2,
  CheckCircle2,
  TrendingUp,
  LayoutGrid
} from 'lucide-react';

const Teams = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [availableLeaders, setAvailableLeaders] = useState([]);
  const [availableInterns, setAvailableInterns] = useState([]);
  
  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamDetails, setTeamDetails] = useState(null);
  
  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('members'); // members or tasks

  // Form inputs
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leaderId: ''
  });
  
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (user.role === 'INTERN' || user.role === 'EMPLOYEE' || user.role === 'TEAM_LEADER') {
        const teamsRes = await api.get('/teams');
        setTeams(teamsRes.data);
      } else {
        const [teamsRes, usersRes] = await Promise.all([
          api.get('/teams'),
          api.get('/users?limit=1000')
        ]);
        setTeams(teamsRes.data);
        
        const allUsers = usersRes.data.users || [];
        setAvailableLeaders(allUsers.filter(u => u.role === 'TEAM_LEADER' && u.status === 'ACTIVE'));
        setAvailableInterns(allUsers.filter(u => (u.role === 'INTERN' || u.role === 'EMPLOYEE') && u.status === 'ACTIVE'));
      }
      setLoading(false);
    } catch (error) {
      console.error(error);
      setAlert('Failed to load team data.');
      setLoading(false);
    }
  };

  const handleViewTeamDetails = async (team) => {
    try {
      setDetailsLoading(true);
      setDetailsModalOpen(true);
      setSelectedTeam(team);
      const res = await api.get(`/teams/${team.id}`);
      setTeamDetails(res.data);
      setDetailsLoading(false);
    } catch (err) {
      console.error(err);
      setAlert('Failed to load team details.');
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/teams', formData);
      setCreateModalOpen(false);
      setFormData({ name: '', description: '', leaderId: '' });
      setAlert('Team created successfully.');
      fetchData();
    } catch (err) {
      setAlert(err.response?.data?.message || 'Failed to create team.');
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.put(`/teams/${selectedTeam.id}`, formData);
      setEditModalOpen(false);
      setSelectedTeam(null);
      setAlert('Team updated successfully.');
      fetchData();
    } catch (err) {
      setAlert(err.response?.data?.message || 'Failed to update team.');
      setLoading(false);
    }
  };

  const handleDeleteTeam = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Team',
      message: 'Delete this team? Members will be unassigned.',
      onConfirm: async () => {
        try {
          await api.delete(`/teams/${id}`);
          setAlert('Team deleted.');
          fetchData();
        } catch (err) {
          setAlert('Failed to delete team.');
        }
      }
    });
  };

  const openAssignModal = (team) => {
    setSelectedTeam(team);
    // Find current member IDs
    const currentIds = team.members.map(m => m.user.id);
    setSelectedMemberIds(currentIds);
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.put(`/teams/${selectedTeam.id}/members`, { memberIds: selectedMemberIds });
      setAssignModalOpen(false);
      setSelectedTeam(null);
      setAlert('Team members assigned successfully.');
      fetchData();
    } catch (err) {
      setAlert('Failed to assign team members.');
      setLoading(false);
    }
  };

  const handleMemberToggle = (id) => {
    if (selectedMemberIds.includes(id)) {
      setSelectedMemberIds(selectedMemberIds.filter(mId => mId !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const openEditModal = (team) => {
    setSelectedTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      leaderId: team.leaderId || ''
    });
    setEditModalOpen(true);
  };

  const displayTeams = (user.role === 'INTERN' || user.role === 'EMPLOYEE')
    ? teams.filter(t => t.members.some(m => m.user?.id === user.id))
    : teams;

  if (loading && teams.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-64 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {alert && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
          <span>{alert}</span>
          <button onClick={() => setAlert('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border/40 shadow-premium">
        <div>
          <h2 className="text-base font-bold">CRM Teams Hub</h2>
          <p className="text-xs text-muted-foreground">Manage workspaces, leaders, and members allocation.</p>
        </div>
        {user.role === 'ADMIN' && (
          <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary-hover">
            <Plus className="h-3.5 w-3.5" />
            <span>Create Team</span>
          </button>
        )}
      </div>

      {/* Teams Grid Cards */}
      {displayTeams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-12 text-center shadow-premium animate-in fade-in duration-300">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Not Assigned to a Team</h3>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-sm mx-auto">
            {(user.role === 'INTERN' || user.role === 'EMPLOYEE')
              ? "You have not been assigned to any workspace team yet. Please contact your administrator or team leader to get allocated." 
              : "No workspace teams found. Click 'Create Team' to register a new team."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayTeams.map((team) => (
            <div key={team.id} className="flex flex-col rounded-2xl border border-border/40 bg-card p-5 shadow-premium hover-premium">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold">{team.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{team.description || 'No description provided.'}</p>
                </div>
                {user.role === 'ADMIN' && (
                  <div className="flex gap-1.5">
                    <button onClick={() => openEditModal(team)} className="rounded-lg p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDeleteTeam(team.id)} className="rounded-lg p-1 hover:bg-muted text-muted-foreground hover:text-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Team Leader details */}
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/40 p-2.5">
                <Users className="h-4 w-4 text-primary" />
                <div className="text-left">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Leader</p>
                  <p className="text-xs font-semibold">{team.leader?.name || 'Unassigned'}</p>
                </div>
              </div>

              {/* Metrics */}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/30 pt-3 text-center">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Members</span>
                  <p className="text-sm font-bold mt-0.5">{team.members.length}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Active Tasks</span>
                  <p className="text-sm font-bold mt-0.5">{team.activeTasks || 0}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Efficiency</span>
                  <p className="text-sm font-bold mt-0.5 text-success">{team.performance || 0}%</p>
                </div>
              </div>

              {/* View Workspace details button */}
              <button 
                onClick={() => handleViewTeamDetails(team)}
                className="mt-4 w-full rounded-xl bg-primary/10 py-2.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20"
              >
                View Team Workspace
              </button>

              {/* Members selection assignment buttons */}
              {user.role === 'ADMIN' && (
                <button 
                  onClick={() => openAssignModal(team)} 
                  className="mt-2 w-full rounded-xl border border-primary/20 bg-primary/5 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary/10"
                >
                  Manage Members
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold">Create Workspace Team</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => setCreateModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Team Name *</label>
                <input type="text" name="name" required placeholder="e.g. Frontend Team" value={formData.name} onChange={handleInputChange} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <input type="text" name="description" placeholder="Brief workflow summary" value={formData.description} onChange={handleInputChange} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Assign Team Leader</label>
                <select name="leaderId" value={formData.leaderId} onChange={handleInputChange}>
                  <option value="">Select Team Leader</option>
                  {availableLeaders.map(leader => (
                    <option key={leader.id} value={leader.id}>{leader.name} ({leader.employeeId})</option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50">
                Create Team
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold">Edit Team Details</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => {
                setEditModalOpen(false);
                setSelectedTeam(null);
              }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Team Name *</label>
                <input type="text" name="name" required value={formData.name} onChange={handleInputChange} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <input type="text" name="description" value={formData.description} onChange={handleInputChange} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Assign Team Leader</label>
                <select name="leaderId" value={formData.leaderId} onChange={handleInputChange}>
                  <option value="">Select Team Leader</option>
                  {availableLeaders.map(leader => (
                    <option key={leader.id} value={leader.id}>{leader.name} ({leader.employeeId})</option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50">
                Save Team Updates
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assign Members Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold">Manage Members: {selectedTeam?.name}</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => {
                setAssignModalOpen(false);
                setSelectedTeam(null);
              }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="mt-4 space-y-4">
              <div className="max-h-60 overflow-y-auto space-y-2 border border-border/30 rounded-lg p-3">
                {availableInterns.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No active interns available.</p>
                ) : (
                  availableInterns.map(intern => (
                    <label key={intern.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted cursor-pointer transition-all">
                      <input 
                        type="checkbox"
                        checked={selectedMemberIds.includes(intern.id)}
                        onChange={() => handleMemberToggle(intern.id)}
                      />
                      <div className="text-left text-xs">
                        <p className="font-semibold">{intern.name}</p>
                        <p className="text-[10px] text-muted-foreground">{intern.employeeId} • {intern.department || 'General'}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50">
                Save Members Mapping
              </button>
            </form>
          </div>
        </div>
      )}
      {/* View Workspace Details Modal */}
      {detailsModalOpen && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-left flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-border/40 pb-3 flex-shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-foreground">{selectedTeam.name} Workspace</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedTeam.description || 'No description provided.'}</p>
              </div>
              <button className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground" onClick={() => {
                setDetailsModalOpen(false);
                setTeamDetails(null);
                setSelectedTeam(null);
              }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailsLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-2" />
                <p className="text-xs text-muted-foreground font-semibold">Loading team workspace details...</p>
              </div>
            ) : teamDetails ? (
              <div className="flex-1 overflow-y-auto mt-4 space-y-6">
                {/* Team Details Header Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-border/30 bg-muted/20 p-3.5">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Team Leader</p>
                    <div className="flex items-center gap-2.5 mt-2">
                      <img 
                        src={teamDetails.leader?.profilePic ? getUploadUrl(teamDetails.leader.profilePic) : `https://api.dicebear.com/7.x/initials/svg?seed=${teamDetails.leader?.name}`}
                        className="h-8 w-8 rounded-full border object-cover" 
                        alt="avatar"
                      />
                      <div>
                        <p className="text-xs font-bold">{teamDetails.leader?.name || 'Unassigned'}</p>
                        <p className="text-[10px] text-muted-foreground">{teamDetails.leader?.email || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/30 bg-muted/20 p-3.5 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Workspace Health</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Tasks Completion Rate</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden border">
                        <div 
                          className="bg-success h-full transition-all duration-500" 
                          style={{ width: `${teamDetails.performance || 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-success">{teamDetails.performance || 0}%</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/30 bg-muted/20 p-3.5 grid grid-cols-2 gap-2 text-center">
                    <div className="flex flex-col justify-center border-r border-border/20">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">Teammates</span>
                      <span className="text-lg font-black mt-0.5 text-foreground">{teamDetails.members?.length || 0}</span>
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">Active Tasks</span>
                      <span className="text-lg font-black mt-0.5 text-primary">{teamDetails.activeTasksCount || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Navigation tabs inside details */}
                <div className="flex border-b border-border/40 gap-4">
                  <button 
                    onClick={() => setActiveTab('members')}
                    className={`pb-2.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'members' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  >
                    Teammates Registry
                  </button>
                  <button 
                    onClick={() => setActiveTab('tasks')}
                    className={`pb-2.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'tasks' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  >
                    Team Workspace Tasks
                  </button>
                </div>

                {/* Tab contents */}
                {activeTab === 'members' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teamDetails.members?.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-6 text-center col-span-2">No teammates assigned to this workspace team yet.</p>
                    ) : (
                      teamDetails.members.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 rounded-xl border border-border/30 bg-card p-3 shadow-sm">
                          <img 
                            src={member.user?.profilePic ? getUploadUrl(member.user.profilePic) : `https://api.dicebear.com/7.x/initials/svg?seed=${member.user?.name}`}
                            className="h-10 w-10 rounded-xl border object-cover shrink-0" 
                            alt="avatar"
                          />
                          <div className="text-left min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-foreground truncate">{member.user?.name}</h4>
                            <p className="text-[10px] text-muted-foreground truncate">{member.user?.employeeId} • {member.user?.email}</p>
                            {member.user?.college && (
                              <p className="text-[9px] text-muted-foreground/80 font-semibold truncate mt-0.5">🎓 {member.user.college}</p>
                            )}
                          </div>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold uppercase shrink-0 ${member.user?.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
                            {member.user?.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teamDetails.tasks?.length === 0 ? (
                      <div className="border border-dashed rounded-xl p-8 text-center text-xs text-muted-foreground">
                        No tasks assigned to this workspace team yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-border/30 rounded-xl bg-card">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-muted/30 text-muted-foreground font-bold border-b border-border/30 uppercase text-[9px] tracking-wider">
                              <th className="px-4 py-3">Task ID</th>
                              <th className="px-4 py-3">Task Name</th>
                              <th className="px-4 py-3">Priority</th>
                              <th className="px-4 py-3">Assignee</th>
                              <th className="px-4 py-3">Deadline</th>
                              <th className="px-4 py-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20 font-medium">
                            {teamDetails.tasks.map((task) => (
                              <tr key={task.id} className="hover:bg-muted/10 transition-all">
                                <td className="px-4 py-3 font-mono font-bold text-[10px] text-muted-foreground">
                                  MRF-{task.id.slice(0, 4).toUpperCase()}
                                </td>
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="font-bold text-foreground leading-snug">{task.title}</p>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${
                                    task.priority === 'URGENT' ? 'bg-red-500/15 text-red-600' :
                                    task.priority === 'HIGH' ? 'bg-orange-500/15 text-orange-600' :
                                    task.priority === 'MEDIUM' ? 'bg-sky-500/15 text-sky-600' :
                                    'bg-slate-500/15 text-slate-600'
                                  }`}>
                                    {task.priority}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs text-foreground font-semibold">{task.assignee?.name || 'Unassigned'}</span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-muted-foreground">
                                  {new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase ${
                                    task.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600' :
                                    task.status === 'WAITING_FOR_REVIEW' ? 'bg-purple-500/10 text-purple-600' :
                                    task.status === 'IN_PROGRESS' ? 'bg-yellow-500/10 text-yellow-600' :
                                    task.status === 'REJECTED' ? 'bg-red-500/10 text-red-600' :
                                    'bg-slate-500/10 text-slate-600'
                                  }`}>
                                    {task.status.replace(/_/g, ' ')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">Could not load details.</p>
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
    </div>
  );
};

export default Teams;
