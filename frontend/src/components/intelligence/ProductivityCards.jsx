import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, LogIn, LogOut, Zap, Home, RefreshCw, BarChart2, Activity
} from 'lucide-react';
import api from '../../services/api';

const ProductivityCards = ({ organizationId }) => {
  const [period, setPeriod] = useState('MONTHLY');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await api.get('/intelligence/productivity', {
        params: { organizationId, period }
      });
      if (res.data?.success) {
        setMetrics(res.data.metrics);
      }
    } catch (err) {
      console.warn('Error fetching productivity metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [organizationId, period]);

  const cards = [
    {
      label: 'Avg Daily Working Hours',
      value: `${metrics?.avgWorkingHours || 0} hrs`,
      sub: 'Standard target: 8.0 hrs/day',
      icon: Clock,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/20'
    },
    {
      label: 'Avg Clock-In Time',
      value: metrics?.avgClockInTime || '--:--',
      sub: 'Workforce morning arrival average',
      icon: LogIn,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 border-blue-500/20'
    },
    {
      label: 'Avg Clock-Out Time',
      value: metrics?.avgClockOutTime || '--:--',
      sub: 'Evening departure benchmark',
      icon: LogOut,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10 border-indigo-500/20'
    },
    {
      label: 'Overtime Frequency',
      value: `${metrics?.overtimeFrequency || 0}%`,
      sub: 'Sessions exceeding 8 scheduled hours',
      icon: Zap,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 border-purple-500/20'
    },
    {
      label: 'Remote (WFH) Ratio',
      value: `${metrics?.wfhDistribution || 0}%`,
      sub: 'Total shifts logged remotely',
      icon: Home,
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10 border-cyan-500/20'
    }
  ];

  return (
    <div className="space-y-4 text-left">
      {/* Header & Period Switcher */}
      <div className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-border/40">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            <span>Productivity & Operational Efficiency</span>
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Key work duration and departure metrics across {metrics?.totalSessions || 0} attendance sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl text-[11px] font-bold">
            {['WEEKLY', 'MONTHLY', 'QUARTERLY'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg transition-all capitalize ${
                  period === p
                    ? 'bg-card text-foreground shadow-xs font-black'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.toLowerCase()}
              </button>
            ))}
          </div>

          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="p-1.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`p-4 rounded-3xl border ${card.bg} bg-card/60 backdrop-blur-xs shadow-xs space-y-2`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate pr-1">
                  {card.label}
                </span>
                <div className={`p-1 rounded-lg ${card.color} bg-background/80 shadow-xs shrink-0`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-foreground tracking-tight">{card.value}</p>
                <p className="text-[10px] text-muted-foreground font-semibold truncate mt-0.5">{card.sub}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductivityCards;
