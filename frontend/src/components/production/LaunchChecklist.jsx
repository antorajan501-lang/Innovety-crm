import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardCheck, CheckCircle2, AlertCircle, RefreshCw,
  Server, Shield, Cpu, Layers, Sparkles
} from 'lucide-react';
import api from '../../services/api';

const CATEGORY_ICONS = {
  Infrastructure: Server,
  Security: Shield,
  Features: Layers,
  Operations: Cpu
};

const LaunchChecklist = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const fetchChecklist = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/launch-checklist');
      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load launch checklist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, []);

  const items = data?.checklist || [];
  const filtered = selectedCategory === 'ALL'
    ? items
    : items.filter((i) => i.category === selectedCategory);

  const passCount = items.filter((i) => i.status === 'PASS').length;
  const percentage = items.length > 0 ? Math.round((passCount / items.length) * 100) : 100;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20 text-white">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Production Launch Checklist</h1>
              <p className="text-sm text-slate-400">20-point comprehensive verification gate across Infrastructure, Security, Features & Operations</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchChecklist}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Run Re-Verification
          </button>
        </div>
      </div>

      {/* Progress Card */}
      <div className="p-6 bg-slate-900/60 border border-emerald-500/30 rounded-2xl backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <span className="text-lg font-bold text-white">Launch Readiness: {percentage}%</span>
          </div>
          <p className="text-xs text-slate-400">
            {passCount} of {items.length} checks successfully verified. All systems green for production launch.
          </p>
        </div>

        <div className="w-full md:w-72 space-y-2">
          <div className="flex justify-between text-xs font-mono text-slate-400">
            <span>Progress</span>
            <span className="text-emerald-400 font-bold">{passCount} / {items.length}</span>
          </div>
          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {['ALL', 'Infrastructure', 'Security', 'Features', 'Operations'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              selectedCategory === cat
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {cat} {cat !== 'ALL' && `(${items.filter(i => i.category === cat).length})`}
          </button>
        ))}
      </div>

      {/* Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item) => {
          const Icon = CATEGORY_ICONS[item.category] || CheckCircle2;
          const isPass = item.status === 'PASS';

          return (
            <motion.div
              layout
              key={item.id}
              className="p-4 bg-slate-900/60 border border-slate-800 hover:border-emerald-500/30 rounded-2xl flex items-start justify-between gap-4 transition"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-500">{item.id}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {item.category}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-200">{item.title}</h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{item.notes}</p>
                </div>
              </div>

              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                {item.status}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default LaunchChecklist;
