import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Users, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import api, { getSocket } from '../../services/api';

// ── Medal helper ──────────────────────────────────────────────────────────────
const RankMedal = ({ rank }) => {
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  if (medals[rank]) {
    return <span className="text-xl leading-none">{medals[rank]}</span>;
  }
  return (
    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-muted border border-border text-xs font-black text-muted-foreground">
      {rank}
    </span>
  );
};

// ── Progress bar colour based on % ───────────────────────────────────────────
const getBarColor = (pct) => {
  if (pct <= 30) return { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', glow: 'shadow-rose-500/20' };
  if (pct <= 60) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', glow: 'shadow-amber-500/20' };
  if (pct <= 80) return { bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', glow: 'shadow-blue-500/20' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', glow: 'shadow-emerald-500/20' };
};

// ── Team avatar (initial letter) ─────────────────────────────────────────────
const TeamAvatar = ({ name, rank }) => {
  const palettes = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500'
  ];
  const color = palettes[(name.charCodeAt(0) || 0) % palettes.length];
  return (
    <div className={`w-10 h-10 rounded-2xl ${color} text-white flex items-center justify-center text-sm font-black shrink-0 shadow-sm`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

// ── Animated progress bar ─────────────────────────────────────────────────────
const ProgressBar = ({ progress, animate }) => {
  const { bar, glow } = getBarColor(progress);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.max(progress, progress === 0 ? 0 : 2)), 100);
    return () => clearTimeout(t);
  }, [progress, animate]);
  return (
    <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${bar} shadow-sm ${glow}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
};

// ── Team Row Card ─────────────────────────────────────────────────────────────
const TeamRow = ({ team, animate }) => {
  const { text } = getBarColor(team.progress);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="p-3.5 rounded-2xl bg-card border border-border/40 hover:border-primary/30 hover:shadow-sm transition-all space-y-2.5"
    >
      {/* Row header */}
      <div className="flex items-center gap-3">
        <RankMedal rank={team.rank} />
        <TeamAvatar name={team.teamName} rank={team.rank} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-foreground truncate">{team.teamName}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-semibold">
              {team.members} {team.members === 1 ? 'Member' : 'Members'}
            </span>
            {team.leader && (
              <span className="text-[10px] text-muted-foreground/60 font-medium ml-1 truncate">
                · {team.leader}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-base font-black ${text}`}>{team.progress}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar progress={team.progress} animate={animate} />

      {/* Stats row */}
      {team.totalTasks === 0 ? (
        <p className="text-[10px] text-muted-foreground/60 font-medium italic">No tasks assigned yet.</p>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              {team.completedTasks} / {team.totalTasks} Done
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
            {team.inProgressTasks > 0 && <span className="text-blue-500">{team.inProgressTasks} active</span>}
            {team.reviewTasks > 0 && <span className="text-amber-500">{team.reviewTasks} review</span>}
            {team.pendingTasks > 0 && <span className="text-rose-500">{team.pendingTasks} pending</span>}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ── Main Widget ───────────────────────────────────────────────────────────────
const TeamPerformanceRankings = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [animateKey, setAnimateKey] = useState(0);

  const fetchRankings = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/team-performance');
      setTeams(res.data || []);
      setLastUpdated(new Date());
      setAnimateKey(k => k + 1);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch team performance:', err);
      setError('Failed to load rankings.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  // Real-time Socket.IO updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => fetchRankings();
    socket.on('team_performance_updated', handler);
    return () => socket.off('team_performance_updated', handler);
  }, [fetchRankings]);

  return (
    <div className="clean-card text-left flex flex-col" style={{ minHeight: '340px', maxHeight: '460px' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Award className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Team Performance Rankings</h3>
            {lastUpdated && (
              <p className="text-[10px] text-muted-foreground/60 font-medium">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={fetchRankings}
          disabled={loading}
          title="Refresh rankings"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Body */}
      <div className="dash-scroll flex-1 overflow-y-auto space-y-2.5 pr-0.5">
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl skeleton" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <AlertCircle className="h-8 w-8 text-rose-400" />
            <p className="text-xs text-muted-foreground font-semibold">{error}</p>
            <button onClick={fetchRankings} className="text-[11px] text-primary font-bold hover:underline">Retry</button>
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div className="p-4 rounded-2xl bg-muted/30 border border-dashed border-border">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">No teams available</p>
              <p className="text-xs text-muted-foreground mt-1">Create a team to start tracking performance.</p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {teams.map((team) => (
              <TeamRow key={team.teamId} team={team} animate={animateKey} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default TeamPerformanceRankings;
