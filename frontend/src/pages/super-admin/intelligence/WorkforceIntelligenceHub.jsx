import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Calendar, Sparkles, Building2, FileSpreadsheet,
  Activity, ShieldCheck, ChevronRight
} from 'lucide-react';
import { useCompanyScope } from '../../../context/CompanyScopeContext';
import CompanyScopeSelector from '../../../components/common/CompanyScopeSelector';

import ExecutiveDashboard from '../../../components/intelligence/ExecutiveDashboard';
import AttendanceHeatmap from '../../../components/intelligence/AttendanceHeatmap';
import WorkforceInsights from '../../../components/intelligence/WorkforceInsights';
import PredictiveAlerts from '../../../components/intelligence/PredictiveAlerts';
import DepartmentAnalytics from '../../../components/intelligence/DepartmentAnalytics';
import ProductivityCards from '../../../components/intelligence/ProductivityCards';
import ReportCenter from '../../../components/intelligence/ReportCenter';

const TABS = [
  { id: 'overview', label: 'Executive Overview', icon: BarChart3 },
  { id: 'heatmap', label: 'Attendance Heatmap', icon: Calendar },
  { id: 'insights', label: 'AI Insights & Alerts', icon: Sparkles },
  { id: 'departments', label: 'Department Analytics', icon: Building2 },
  { id: 'reports', label: 'Report Center', icon: FileSpreadsheet }
];

const WorkforceIntelligenceHub = () => {
  const { selectedOrgId } = useCompanyScope();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto pb-12">
      {/* Top Banner & Scope Selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              Phase 8 Intelligence
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground font-semibold">HRMS Workforce Engine</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground mt-1 flex items-center gap-2.5">
            <Activity className="h-7 w-7 text-primary" />
            <span>Workforce Intelligence & Self-Service</span>
          </h1>
        </div>

        <CompanyScopeSelector />
      </div>

      {/* Navigation Sub-Tabs Bar */}
      <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-2xl border border-border/50 overflow-x-auto dash-scroll">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <ExecutiveDashboard organizationId={selectedOrgId} />
              <div className="pt-2">
                <ProductivityCards organizationId={selectedOrgId} />
              </div>
            </div>
          )}

          {activeTab === 'heatmap' && (
            <AttendanceHeatmap organizationId={selectedOrgId} />
          )}

          {activeTab === 'insights' && (
            <div className="space-y-8">
              <WorkforceInsights organizationId={selectedOrgId} />
              <PredictiveAlerts organizationId={selectedOrgId} />
            </div>
          )}

          {activeTab === 'departments' && (
            <DepartmentAnalytics organizationId={selectedOrgId} />
          )}

          {activeTab === 'reports' && (
            <ReportCenter organizationId={selectedOrgId} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default WorkforceIntelligenceHub;
