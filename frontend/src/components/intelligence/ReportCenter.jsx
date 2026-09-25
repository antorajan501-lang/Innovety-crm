import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileSpreadsheet, Download, Printer, Filter, RefreshCw,
  Search, FileText, Calendar, Building2, CheckCircle2
} from 'lucide-react';
import api from '../../services/api';

const REPORT_OPTIONS = [
  { id: 'ATTENDANCE_SUMMARY', label: 'Attendance Summary Report', desc: 'Daily punch logs, shift hours, late minutes & status' },
  { id: 'SHIFT_UTILIZATION', label: 'Shift Utilization Report', desc: 'Shift capacity, roster assignments & actual turnouts' },
  { id: 'DEPARTMENT_PERFORMANCE', label: 'Department Performance Report', desc: 'Cross-department benchmark across overtime, leaves & WFH' },
  { id: 'OVERTIME_SUMMARY', label: 'Overtime Summary Report', desc: 'Extra hours breakdown beyond scheduled 8-hour shift' },
  { id: 'LEAVE_ANALYTICS', label: 'Leave Analytics Report', desc: 'Approved employee leave requests, reasons & days consumed' },
  { id: 'WORKFORCE_TRENDS', label: 'Workforce Trends Report', desc: 'Daily rolling headcount, turnouts & remote ratios' }
];

const ReportCenter = ({ organizationId }) => {
  const [reportType, setReportType] = useState('ATTENDANCE_SUMMARY');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Load department list
  useEffect(() => {
    if (!organizationId) return;
    api.get('/users', { params: { organizationId, limit: 1000 } })
      .then(res => {
        if (res.data?.users) {
          const depts = Array.from(new Set(res.data.users.map(u => u.department).filter(Boolean)));
          setDepartments(depts);
        }
      })
      .catch(() => {});
  }, [organizationId]);

  const handleGenerate = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await api.get('/intelligence/reports', {
        params: {
          organizationId,
          reportType,
          startDate,
          endDate,
          ...(department ? { department } : {})
        }
      });
      if (res.data?.success) {
        setReportData(res.data.report);
      }
    } catch (err) {
      console.warn('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleGenerate();
  }, [organizationId, reportType]);

  const handleExport = (format) => {
    if (!organizationId) return;
    const url = `/intelligence/reports/export?organizationId=${organizationId}&reportType=${reportType}&startDate=${startDate}&endDate=${endDate}${department ? `&department=${department}` : ''}&format=${format}`;

    // Trigger authenticated download
    api.get(url, { responseType: 'blob' })
      .then(response => {
        const blob = new Blob([response.data], {
          type: format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv'
        });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `${reportType.toLowerCase()}_${startDate}_${endDate}.${format === 'excel' ? 'xls' : 'csv'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch(err => console.error('Export download failed:', err));
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredRows = (reportData?.rows || []).filter(row => {
    if (!search.trim()) return true;
    return Object.values(row).some(v =>
      String(v).toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 text-left">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-border/40">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-teal-500" />
            <span>Advanced Workforce Report Center</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate, filter, and export granular operational, shift utilization, and compliance audits.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-bold transition-all shadow-xs cursor-pointer text-foreground"
          >
            <Download className="h-3.5 w-3.5 text-emerald-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => handleExport('excel')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-bold transition-all shadow-xs cursor-pointer text-foreground"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-teal-500" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-bold transition-all shadow-xs cursor-pointer text-foreground"
          >
            <Printer className="h-3.5 w-3.5 text-indigo-500" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Parameters Bar */}
      <div className="p-5 rounded-3xl border border-border/60 bg-card shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Report Type Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground">Select Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border/60 bg-muted/20 font-bold text-foreground outline-none focus:border-primary transition-all"
            >
              {REPORT_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 2. Start Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border/60 bg-muted/20 font-bold text-foreground outline-none focus:border-primary transition-all"
            />
          </div>

          {/* 3. End Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border/60 bg-muted/20 font-bold text-foreground outline-none focus:border-primary transition-all"
            />
          </div>

          {/* 4. Department Filter & Run */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted-foreground">Department (Optional)</label>
            <div className="flex items-center gap-2">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border/60 bg-muted/20 font-bold text-foreground outline-none focus:border-primary transition-all"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-black shadow-xs cursor-pointer shrink-0 transition-all"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Run'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Table Card */}
      <div className="rounded-3xl border border-border/60 bg-card shadow-xs overflow-hidden space-y-3">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
              {reportData?.title || 'Report Output Preview'}
            </h3>
            <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
              Period: {reportData?.period} • {reportData?.recordCount || 0} Total Records
            </p>
          </div>

          {/* Search within preview */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search in preview..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border/60 bg-muted/20 text-xs font-semibold text-foreground outline-none focus:bg-background transition-all"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground font-black text-[10px] uppercase tracking-wider sticky top-0 bg-card">
                {reportData?.columns?.map((col, idx) => (
                  <th key={idx} className="py-2.5 px-3.5 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={reportData?.columns?.length || 5} className="py-12 text-center text-muted-foreground font-bold">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>Compiling report rows...</span>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={reportData?.columns?.length || 5} className="py-12 text-center text-muted-foreground font-bold italic">
                    No matching records found for the selected parameters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, rIdx) => {
                  const values = Object.values(row);
                  return (
                    <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                      {values.map((v, cIdx) => (
                        <td key={cIdx} className="py-2.5 px-3.5 whitespace-nowrap text-foreground">
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportCenter;
