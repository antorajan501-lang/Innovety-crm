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
  
  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetTeamId: ''
  });

  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [annRes, teamsRes] = await Promise.all([
        api.get('/announcements'),
        user.role === 'ADMIN' ? api.get('/teams') : api.get('/teams').catch(() => ({ data: [] }))
      ]);
      setAnnouncements(annRes.data);
      if (user.role === 'ADMIN') {
        setTeams(teamsRes.data || []);
      } else if (user.role === 'TEAM_LEADER') {
        // Filter teams led by this team leader
        const ledTeams = (teamsRes.data || []).filter(t => t.leaderId === user.id);
        setTeams(ledTeams);
      }
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
        targetTeamId: formData.targetTeamId || null
      });
      setCreateModalOpen(false);
      setFormData({ title: '', content: '', targetTeamId: '' });
      setAlert('Announcement posted and broadcast live.');
      fetchData();
    } catch (err) {
      setAlert(err.response?.data?.message || 'Failed to post announcement.');
      setLoading(false);
    }
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
            <p className="text-xs text-muted-foreground">General broadcasts, HR operations notifications, and team assignments announcements.</p>
          </div>
        </div>
        
        {['ADMIN', 'TEAM_LEADER'].includes(user.role) && (
          <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary-hover">
            <Plus className="h-3.5 w-3.5" />
            <span>Publish Broadcast</span>
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
                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${announce.targetTeamId ? 'bg-indigo-500/10 text-indigo-500' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                  {announce.targetTeamId ? <Users className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                  <span>{announce.targetTeamId ? 'Team Channel' : 'Global Broadcast'}</span>
                </span>
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
              <h3 className="text-base font-bold">Publish Broadcast Bulletin</h3>
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
                  rows={5} 
                  required 
                  placeholder="Draft details of the announcement here..." 
                  className="w-full border border-border bg-card px-4 py-2 text-sm rounded-lg"
                  value={formData.content} 
                  onChange={handleInputChange} 
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-muted-foreground">Target Scope *</label>
                <select name="targetTeamId" value={formData.targetTeamId} onChange={handleInputChange}>
                  {user.role === 'ADMIN' && <option value="">Global Broadcast (Everyone)</option>}
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>Team Channel: {team.name}</option>
                  ))}
                </select>
              </div>

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
