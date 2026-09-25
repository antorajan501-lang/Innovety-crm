import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Printer, X, Calendar, RefreshCw, Layers } from 'lucide-react';
import api from '../../services/api';

const REPORTS = [
  { id: 'SHIFT_UTILIZATION', label: 'Shift Utilization Report', description: 'Assigned headcount, total logged hours, and shift utilization percentage.' },
  { id: 'DEPARTMENT_COVERAGE', label: 'Department Coverage Report', description: 'Department staffing matrix, shift distribution, and coverage status.' },
  { id: 'ATTENDANCE_EXCEPTIONS', label: 'Attendance Exceptions Report', description: 'Late arrivals, missed check-ins/outs, and unauthorized overtime logs.' },
  { id: 'OVERTIME_SUMMARY', label: 'Overtime Summary Report', description: 'Detailed overtime hours distribution across members and shifts.' },
  { id: 'SHIFT_CHANGE_HISTORY', label: 'Shift Change History Audit', description: 'Chronological timeline of shift edits, overrides, swaps, and reversions.' }
];

const ShiftReportsModal = ({
  isOpen,
  onClose,
  organizationId
}) => {
  const [selectedReport, setSelectedReport] = useState('SHIFT_UTILIZATION');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  if (!isOpen) return null;

  const handleDownloadCsv = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      const res = await api.get('/workforce/reports', {
        params: {
          organizationId,
          reportType: selectedReport,
          format: 'csv',
          startDate: startDate || undefined,
          endDate: endDate || undefined
        },
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport.toLowerCase()}_report.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('[ShiftReports] Download error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchPreview = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      const res = await api.get('/workforce/reports', {
        params: {
          organizationId,
          reportType: selectedReport,
          format: 'json',
          startDate: startDate || undefined,
          endDate: endDate || undefined
        }
      });
      if (res.data?.success) {
        setPreviewData(res.data.data || []);
      }
    } catch (err) {
      console.error('[ShiftReports] Preview error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl rounded-3xl border border-border/70 bg-card p-6 sm:p-7 shadow-2xl space-y-5 text-left my-8 print:shadow-none print:border-none print:p-2"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3.5 print:border-b-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center shadow-inner print:hidden">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                Workforce & Shift Reports
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Generate and export shift analytics, department coverage, and audit history.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted print:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden text-xs">
          <div className="space-y-1">
            <label className="font-bold text-foreground">Report Type</label>
            <select
              value={selectedReport}
              onChange={(e) => {
                setSelectedReport(e.target.value);
                setPreviewData(null);
              }}
              className="w-full p-2.5 rounded-xl border border-border bg-card font-bold"
            >
              {REPORTS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-foreground">From Date (Optional)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 rounded-xl border border-border bg-card font-mono text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-foreground">To Date (Optional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 rounded-xl border border-border bg-card font-mono text-xs"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 print:hidden flex-wrap pt-1">
          <button
            onClick={handleFetchPreview}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5 text-primary" />}
            <span>Generate Preview</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={!previewData || previewData.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border hover:bg-muted text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
            >
              <Printer className="h-3.5 w-3.5 text-blue-600" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Data Preview Table */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden max-h-96 overflow-y-auto print:max-h-none print:border-none print:shadow-none">
          {previewData === null ? (
            <div className="p-12 text-center text-xs text-muted-foreground print:hidden">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-bold text-foreground">No preview generated yet</p>
              <p className="mt-0.5">Click "Generate Preview" to review rows before printing or exporting.</p>
            </div>
          ) : previewData.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No records found for the selected report filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-black text-[10px] uppercase tracking-wider border-b border-border/50">
                  <tr>
                    {Object.keys(previewData[0]).map((header) => (
                      <th key={header} className="p-3 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                      {Object.keys(row).map((header) => (
                        <td key={header} className="p-3 text-foreground whitespace-nowrap">
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ShiftReportsModal;
