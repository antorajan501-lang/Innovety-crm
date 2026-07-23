import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { getUploadUrl } from '../services/api';
import {
  Megaphone,
  Plus,
  X,
  User,
  Calendar,
  Globe,
  Users
} from 'lucide-react';

const Announcements = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [teams, setTeams] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  
  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetType: user.role === 'TEAM_LEADER' ? 'TEAM' : 'ALL',
    targetTeamId: '',
    targetUserId: ''
  });

  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [annRes, teamsRes, usersRes] = await Promise.all([
        api.get('/announcements'),
        api.get('/teams').catch(() => ({ data: [] })),
        api.get('/users?limit=1000&status=ACTIVE').catch(() => ({ data: { users: [] } }))
      ]);
      setAnnouncements(annRes.data || []);
      
      const allTeams = teamsRes.data || [];
      if (user.role === 'ADMIN') {
        setTeams(allTeams);
      } else if (user.role === 'TEAM_LEADER') {
        const ledTeams = allTeams.filter(t => t.leaderId === user.id);
        setTeams(ledTeams);
      }

      const allUsers = usersRes.data?.users || [];
      setUsersList(allUsers);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/announcements', {
        title: formData.title,
        content: formData.content,
        targetType: formData.targetType,
        targetTeamId: formData.targetType === 'TEAM' ? formData.targetTeamId : null,
        targetUserId: formData.targetType === 'INDIVIDUAL' ? formData.targetUserId : null
      });
      setCreateModalOpen(false);
      setFormData({
        title: '',
        content: '',
        targetType: user.role === 'TEAM_LEADER' ? 'TEAM' : 'ALL',
        targetTeamId: '',
        targetUserId: ''
      });
      setUserSearch('');
      setAlert('Announcement posted and broadcast live.');
      fetchData();
    } catch (err) {
      setAlert(err.response?.data?.message || 'Failed to post announcement.');
      setLoading(false);
    }
  };

  const filteredUsers = usersList.filter(u => {
    if (u.id === user.id) return false;
    const query = userSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      u.name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.employeeId?.toLowerCase().includes(query) ||
      u.role?.toLowerCase().includes(query)
    );
  });

  const renderAudienceBadge = (announce) => {
    if (announce.targetType === 'INDIVIDUAL' || announce.targetUser) {
      const recipientName = announce.targetUser?.name || 'Individual User';
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400">
          <User className="h-2.5 w-2.5" />
          <span>{recipientName}</span>
        </span>
      );
    }
    if (announce.targetType === 'TEAM' || announce.targetTeamId) {
      const teamName = announce.targetTeam?.name || 'Team Channel';
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-500/10 text-indigo-500">
          <Users className="h-2.5 w-2.5" />
          <span>{teamName}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <Globe className="h-2.5 w-2.5" />
        <span>Public Broadcast</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {alert && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
          <span>{alert}</span>
          <button onClick={() => setAlert('')}>✕</button>
        </div>
      )}

      {/* Control Header */}
      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border/40 shadow-premium">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h2 className="text-base font-bold">CRM Bulletin Board</h2>
            <p className="text-xs text-muted-foreground">General broadcasts, targeted team updates, and direct individual announcements.</p>
          </div>
        </div>
        
        {['ADMIN', 'TEAM_LEADER'].includes(user.role) && (
          <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary-hover">
            <Plus className="h-3.5 w-3.5" />
            <span>Publish Announcement</span>
          </button>
        )}
      </div>

      {/* Announcements Feed list */}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border/40 text-muted-foreground text-sm">
            No active announcements found.
          </div>
        ) : (
          announcements.map((announce) => (
            <div 
              key={announce.id} 
              className="rounded-2xl border border-border/40 bg-card p-5 shadow-premium hover-premium text-left"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-sm font-bold text-foreground">{announce.title}</h3>
                {renderAudienceBadge(announce)}
              </div>

              <p className="mt-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{announce.content}</p>

              <div className="mt-5 flex items-center justify-between border-t border-border/30 pt-3 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <img 
                    src={announce.creator?.profilePic ? getUploadUrl(announce.creator.profilePic) : `https://api.dicebear.com/7.x/initials/svg?seed=${announce.creator?.name}`}
                    className="h-5 w-5 rounded-full object-cover"
                    alt="profile"
                  />
                  <span className="font-semibold">{announce.creator?.name} ({announce.creator?.role?.replace('_', ' ')})</span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{new Date(announce.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Announcement Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold">Publish Targeted Announcement</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => setCreateModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-muted-foreground">Title *</label>
                <input 
                  type="text" 
                  name="title"
                  required 
                  placeholder="e.g. Server Maintenance Window" 
                  value={formData.title} 
                  onChange={handleInputChange} 
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-muted-foreground">Message Content *</label>
                <textarea 
                  name="content"
                  rows={4} 
                  required 
                  placeholder="Draft details of the announcement here..." 
                  className="w-full border border-border bg-card px-4 py-2 text-sm rounded-lg"
                  value={formData.content} 
                  onChange={handleInputChange} 
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-muted-foreground">Recipient Type *</label>
                <select name="targetType" value={formData.targetType} onChange={handleInputChange}>
                  {user.role === 'ADMIN' && <option value="ALL">Public Broadcast (Everyone)</option>}
                  <option value="TEAM">Team</option>
                  <option value="INDIVIDUAL">Individual User</option>
                </select>
              </div>

              {formData.targetType === 'TEAM' && (
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-semibold text-muted-foreground">Target Team *</label>
                  <select name="targetTeamId" required value={formData.targetTeamId} onChange={handleInputChange}>
                    <option value="">Select a team...</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.targetType === 'INDIVIDUAL' && (
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-semibold text-muted-foreground">Search Target User *</label>
                  <input
                    type="text"
                    placeholder="Search by name, ID, or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="mb-1"
                  />
                  <select name="targetUserId" required value={formData.targetUserId} onChange={handleInputChange}>
                    <option value="">Select user...</option>
                    {filteredUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.employeeId || u.role}) - {u.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50">
                Publish Announcement
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;
