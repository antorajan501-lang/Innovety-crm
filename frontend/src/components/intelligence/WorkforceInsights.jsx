import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, TrendingUp, AlertTriangle, CheckCircle2, Zap,
  X, RefreshCw, ShieldAlert, Award, Clock
} from 'lucide-react';
import api from '../../services/api';

const CATEGORY_COLORS = {
  PRODUCTIVITY: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  ATTENDANCE: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  COMPLIANCE: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  GENERAL: 'bg-blue-500/10 text-blue-600 border-blue-500/20'
};

const SEVERITY_BADGES = {
  SUCCESS: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  WARNING: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  INFO: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  CRITICAL: 'bg-rose-500/15 text-rose-600 border-rose-500/30'
};

const WorkforceInsights = ({ organizationId }) => {
  const [insights, setInsights] = useState([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const fetchInsights = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await api.get('/intelligence/insights', { params: { organizationId } });
      if (res.data?.success) {
        setInsights(res.data.insights || []);
      }
    } catch (err) {
      console.warn('Error fetching insights:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [organizationId]);

  const handleDismiss = async (id) => {
    try {
      await api.patch(`/intelligence/insights/${id}/dismiss`, null, { params: { organizationId } });
      setInsights(prev => prev.filter(ins => ins.id !== id));
    } catch (err) {
      console.error('Error dismissing insight:', err);
    }
  };

  const filteredInsights = activeCategory === 'ALL'
    ? insights
    : insights.filter(i => (i.category || 'GENERAL') === activeCategory);

  return (
    <div className="space-y-5 text-left">
      {/* Header and Filter Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-border/40">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            <span>AI Workforce Insights & Signals</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated CRM intelligence detecting workload spikes, punctuality stars, and fatigue patterns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl text-xs font-bold">
            {['ALL', 'PRODUCTIVITY', 'ATTENDANCE', 'COMPLIANCE'].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-lg transition-all capitalize ${
                  activeCategory === cat
                    ? 'bg-card text-foreground shadow-xs font-black'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat.toLowerCase()}
              </button>
            ))}
          </div>

          <button
            onClick={fetchInsights}
            disabled={loading}
            className="p-2 rounded-xl border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-xs cursor-pointer"
            title="Refresh Insights"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Insights Cards Grid */}
      {loading && insights.length === 0 ? (
        <div className="p-12 text-center text-xs font-bold text-muted-foreground flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
          <span>Synthesizing CRM workforce signals...</span>
        </div>
      ) : filteredInsights.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-border/60 bg-card/40 space-y-2">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm font-bold text-foreground">No Active Insights</p>
          <p className="text-xs text-muted-foreground">Workforce patterns are balanced across selected categories.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {filteredInsights.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-5 rounded-3xl border border-border/60 bg-card hover:border-border transition-all shadow-xs space-y-3 relative group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.GENERAL}`}>
                      {item.category || 'GENERAL'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${SEVERITY_BADGES[item.severity] || SEVERITY_BADGES.INFO}`}>
                      {item.severity}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDismiss(item.id)}
                    className="p-1 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title="Dismiss Insight"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-black text-foreground leading-snug">{item.title}</h3>
                  <p className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed">{item.message}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1 font-semibold">
                    <Clock className="h-3 w-3" />
                    <span>Signal generated from 30-day CRM telemetry</span>
                  </span>
                  <span className="font-mono">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default WorkforceInsights;
