import React, { useState, useEffect } from 'react';
import {
  Briefcase, Search, Filter, ShieldCheck, Users, Building2,
  FolderOpen, Eye, X, RefreshCw, Lock
} from 'lucide-react';
import api from '../../../services/api';
import UserAvatar from '../../../components/common/UserAvatar';

const TeamDirectory = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selected Team for Read-Only Details Modal
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const res = await api.get(`/super-admin/teams?${params.toString()}`);
      setTeams(res.data || []);
    } catch (err) {
      console.error('Failed to fetch teams directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTeams();
  };

  const handleOpenDetails = (t) => {
    setSelectedTeam(t);
    setShowDetailsModal(true);
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/30 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
            <Lock className="h-3.5 w-3.5" />
            <span>Platform Team Directory • Read-Only View</span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Enterprise Team Directory
          </h1>
          <p className="text-xs text-muted-foreground">
            Overview of all organization teams, team leaders, member counts, and active projects.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams by name, code, or department..."
            className="w-full rounded-xl border border-border/60 bg-background pl-10 pr-4 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </form>
      </div>

      {/* Read-Only Notice Banner */}
      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Read-Only Access:</strong> Super Admin has inspection access to team organization. Team creation, editing, and leader assignments remain managed by operational administration in Team Hub.
          </span>
        </div>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <span>Loading team directory...</span>
          </div>
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
          No teams found matching search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">
                      {team.code || 'TEAM'}
                    </span>
                    <h3 className="text-base font-bold text-foreground mt-1">{team.name}</h3>
                    <p className="text-xs text-muted-foreground">{team.department || 'General Department'}</p>
                  </div>

                  <button
                    onClick={() => handleOpenDetails(team)}
                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                    title="View Team Details & Roster"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>

                {/* Team Leader Banner */}
                <div className="p-3 rounded-xl bg-muted/30 border border-border/30 flex items-center gap-3">
                  <UserAvatar user={team.leader} name={team.leader?.name || 'Unassigned'} className="h-8 w-8 shrink-0" />
                  <div className="truncate">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase block">Team Leader</span>
                    <p className="text-xs font-bold text-foreground truncate">{team.leader?.name || 'Unassigned'}</p>
                  </div>
                </div>
              </div>

              {/* Stats Footer */}
              <div className="flex items-center justify-between border-t border-border/20 pt-3 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                  <Users className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{team.memberCount} Members</span>
                </div>

                <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                  <FolderOpen className="h-3.5 w-3.5 text-primary" />
                  <span>{team.activeProjectCount} Active Projects</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team Details Roster Modal */}
      {showDetailsModal && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border/40 bg-card p-6 shadow-2xl space-y-5 text-left max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">
                  {selectedTeam.code}
                </span>
                <h3 className="text-base font-bold text-foreground mt-1">{selectedTeam.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedTeam.department}</p>
              </div>

              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Team Leader Details */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">Assigned Team Leader</span>
              <p className="text-sm font-extrabold text-foreground">{selectedTeam.leader?.name || 'Unassigned'}</p>
              <p className="text-xs text-muted-foreground font-mono">{selectedTeam.leader?.email} • {selectedTeam.leader?.employeeId}</p>
            </div>

            {/* Team Member Roster */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Team Roster ({selectedTeam.members.length} Members)
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedTeam.members.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No members assigned to this team.</p>
                ) : (
                  selectedTeam.members.map((m) => (
                    <div key={m.id} className="p-3 rounded-xl bg-muted/20 border border-border/30 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-foreground">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{m.email} • {m.employeeId}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary-hover text-[10px] font-bold">
                        {m.role}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamDirectory;
