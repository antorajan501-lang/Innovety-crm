import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw, Plus, X, Calendar, Clock, Sparkles, Check,
  AlertCircle, RefreshCw, Trash2, Users, Layers
} from 'lucide-react';
import api from '../../services/api';

const PATTERNS = [
  { id: 'WEEKLY', label: 'Weekly Specific Days (e.g. Every Monday)' },
  { id: 'EVERY_WEEKEND', label: 'Every Weekend (Saturday & Sunday)' },
  { id: 'ALTERNATE_SATURDAYS', label: 'Alternate Saturdays (2nd & 4th Sat)' },
  { id: 'CUSTOM_ROTATION', label: 'Custom Day Rotation (Every N Days)' }
];

const RecurringShiftTemplatesModal = ({
  isOpen,
  onClose,
  organizationId,
  shifts = [],
  onSuccess
}) => {
  const [templates, setTemplates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(null);

  // Create Form State
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    shiftId: '',
    recurrencePattern: 'WEEKLY',
    daysOfWeek: ['MONDAY']
  });

  // Apply Form State
  const [applyRangeType, setApplyRangeType] = useState('NEXT_MONTH'); // NEXT_MONTH, NEXT_QUARTER, CUSTOM
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchTemplates = async () => {
    if (!isOpen || !organizationId) return;
    try {
      setLoading(true);
      const res = await api.get('/workforce/templates', { params: { organizationId } });
      if (res.data?.success) {
        setTemplates(res.data.templates || []);
      }
    } catch (err) {
      console.error('[RecurringTemplates] Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    if (!isOpen || !organizationId) return;
    try {
      const res = await api.get('/users', { params: { organizationId } });
      const list = Array.isArray(res.data) ? res.data : res.data?.users || [];
      setEmployees(list.filter(u => u.status === 'ACTIVE'));
    } catch (err) {
      console.error('[RecurringTemplates] Error fetching employees:', err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchEmployees();
  }, [isOpen, organizationId]);

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await api.post('/workforce/templates', {
        organizationId,
        name: newTemplate.name,
        shiftId: newTemplate.shiftId || shifts[0]?.id,
        recurrencePattern: newTemplate.recurrencePattern,
        config: { daysOfWeek: newTemplate.daysOfWeek }
      });
      if (res.data?.success) {
        setIsCreating(false);
        setNewTemplate({
          name: '',
          shiftId: '',
          recurrencePattern: 'WEEKLY',
          daysOfWeek: ['MONDAY']
        });
        fetchTemplates();
      }
    } catch (err) {
      console.error('[RecurringTemplates] Create error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this recurring template?')) return;
    try {
      await api.delete(`/workforce/templates/${id}`, { params: { organizationId } });
      fetchTemplates();
    } catch (err) {
      console.error('[RecurringTemplates] Delete error:', err);
    }
  };

  const handleApplySubmit = async () => {
    if (!applyingTemplate || !selectedUserIds.length) return;

    let startDate, endDate;
    const now = new Date();

    if (applyRangeType === 'NEXT_MONTH') {
      const nextMonthFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextMonthLast = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      startDate = nextMonthFirst.toISOString().split('T')[0];
      endDate = nextMonthLast.toISOString().split('T')[0];
    } else if (applyRangeType === 'NEXT_QUARTER') {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3 + 1) * 3, 1);
      const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3 + 2) * 3, 0);
      startDate = quarterStart.toISOString().split('T')[0];
      endDate = quarterEnd.toISOString().split('T')[0];
    } else {
      startDate = customStart;
      endDate = customEnd;
    }

    if (!startDate || !endDate) {
      alert('Please specify a valid date range.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/workforce/templates/${applyingTemplate.id}/apply`, {
        organizationId,
        userIds: selectedUserIds,
        startDate,
        endDate
      });

      if (res.data?.success) {
        setApplyingTemplate(null);
        if (onSuccess) {
          onSuccess(`Template applied: generated ${res.data.createdCount} shift schedules.`);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to apply recurring template.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl rounded-3xl border border-border/70 bg-card p-6 shadow-2xl space-y-5 text-left my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center justify-center shadow-inner">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                Recurring Shift Templates
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Create and mass-apply automated schedule cycles (Mondays, Weekends, Rotations).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Template</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Create Form Mode */}
        {isCreating ? (
          <form onSubmit={handleCreateTemplate} className="space-y-4 p-4 rounded-2xl bg-muted/20 border border-border/50 text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-foreground">Create Recurring Template</h4>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground underline"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Template Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Every Monday Morning, Alternate Weekend Rotation"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-border bg-card font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-foreground">Assign To Shift *</label>
                <select
                  value={newTemplate.shiftId || (shifts[0]?.id || '')}
                  onChange={(e) => setNewTemplate({ ...newTemplate, shiftId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-border bg-card font-bold"
                >
                  {shifts.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.startTime} – {s.endTime})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Recurrence Pattern *</label>
                <select
                  value={newTemplate.recurrencePattern}
                  onChange={(e) => setNewTemplate({ ...newTemplate, recurrencePattern: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-border bg-card font-bold"
                >
                  {PATTERNS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 rounded-xl text-muted-foreground font-bold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-sm flex items-center gap-1.5"
              >
                {submitting && <RefreshCw className="h-3 w-3 animate-spin" />}
                <span>Save Template</span>
              </button>
            </div>
          </form>
        ) : null}

        {/* Templates List */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-500" />
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-2xl">
              <RotateCcw className="h-6 w-6 text-indigo-500 mx-auto mb-2 opacity-80" />
              <p className="font-bold text-foreground">No recurring templates yet</p>
              <p className="mt-0.5">Create templates to avoid manually planning recurring shifts month after month.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {templates.map(tmpl => (
                <div key={tmpl.id} className="p-3.5 rounded-2xl border border-border/60 bg-card hover:bg-muted/10 transition-all flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-foreground">{tmpl.name}</span>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                        {tmpl.recurrencePattern.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                      <span>{tmpl.shift?.name} ({tmpl.shift?.startTime} – {tmpl.shift?.endTime})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setApplyingTemplate(tmpl);
                        setSelectedUserIds(employees.map(u => u.id));
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      Apply To Range
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition-colors"
                      title="Delete Template"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Apply Dialog */}
        <AnimatePresence>
          {applyingTemplate && (
            <div className="fixed inset-0 z-60 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 text-left"
              >
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-foreground">
                    Apply: {applyingTemplate.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Generate recurring shifts automatically for selected employees.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="font-bold text-foreground block">Target Date Range</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'NEXT_MONTH', label: 'Next Month' },
                      { id: 'NEXT_QUARTER', label: 'Next Quarter' },
                      { id: 'CUSTOM', label: 'Custom Range' }
                    ].map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setApplyRangeType(r.id)}
                        className={`py-2 rounded-xl text-center font-bold border transition-all cursor-pointer ${
                          applyRangeType === r.id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  {applyRangeType === 'CUSTOM' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold">Start Date</span>
                        <input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="w-full p-2 rounded-lg border border-border bg-muted/20 font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold">End Date</span>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="w-full p-2 rounded-lg border border-border bg-muted/20 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Member selection */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-foreground">Target Employees ({selectedUserIds.length})</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedUserIds.length === employees.length) setSelectedUserIds([]);
                        else setSelectedUserIds(employees.map(u => u.id));
                      }}
                      className="text-[11px] text-indigo-600 font-bold hover:underline cursor-pointer"
                    >
                      {selectedUserIds.length === employees.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-border rounded-xl p-2 bg-muted/10 divide-y divide-border/40">
                    {employees.map(emp => {
                      const isSelected = selectedUserIds.includes(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => {
                            if (isSelected) setSelectedUserIds(selectedUserIds.filter(id => id !== emp.id));
                            else setSelectedUserIds([...selectedUserIds, emp.id]);
                          }}
                          className="p-1.5 flex items-center justify-between hover:bg-muted/30 rounded cursor-pointer"
                        >
                          <span className="font-bold text-foreground truncate">{emp.name}</span>
                          <span className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-border'
                          }`}>
                            {isSelected && <Check className="h-3 w-3" />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setApplyingTemplate(null)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted border border-border cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submitting || selectedUserIds.length === 0}
                    onClick={handleApplySubmit}
                    className="flex-1 py-2 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {submitting && <RefreshCw className="h-3 w-3 animate-spin" />}
                    <span>Generate Schedules</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default RecurringShiftTemplatesModal;
