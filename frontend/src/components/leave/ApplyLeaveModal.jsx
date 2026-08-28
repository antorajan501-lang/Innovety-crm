import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarPlus,
  Calendar,
  Clock,
  FileText,
  Phone,
  Paperclip,
  X,
  AlertCircle,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import api from '../../services/api';

const LEAVE_TYPES = [
  { id: 'CASUAL', label: 'Casual Leave (CL)', desc: 'For planned personal matters or short breaks' },
  { id: 'SICK', label: 'Sick Leave (SL)', desc: 'For medical appointments or health recovery' },
  { id: 'EMERGENCY', label: 'Emergency Leave (EL)', desc: 'For unforeseen family or personal emergencies' },
  { id: 'WFH', label: 'Work From Home (WFH)', desc: 'Remote working arrangement request' },
  { id: 'UNPAID', label: 'Loss of Pay / Unpaid Leave (LOP)', desc: 'Leave taken without pay' }
];

const calculateDays = (startStr, endStr, isHalfDay) => {
  if (isHalfDay) return 0.5;
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

const formatDateForInput = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const ApplyLeaveModal = ({
  isOpen,
  onClose,
  onSuccess,
  leaveToEdit = null,
  userRole = 'EMPLOYEE'
}) => {
  const isEditing = Boolean(leaveToEdit);

  const [formData, setFormData] = useState({
    leaveType: 'CASUAL',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    reason: '',
    contactPhone: '',
    attachmentNote: ''
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  // Initialize or reset form state
  useEffect(() => {
    if (leaveToEdit) {
      const isHalf = leaveToEdit.totalDays === 0.5;
      setFormData({
        leaveType: leaveToEdit.leaveType || leaveToEdit.type || 'CASUAL',
        startDate: formatDateForInput(leaveToEdit.startDate),
        endDate: formatDateForInput(leaveToEdit.endDate || leaveToEdit.startDate),
        isHalfDay: isHalf,
        reason: leaveToEdit.reason || '',
        contactPhone: leaveToEdit.contactPhone || '',
        attachmentNote: ''
      });
    } else {
      const todayStr = formatDateForInput(new Date());
      setFormData({
        leaveType: 'CASUAL',
        startDate: todayStr,
        endDate: todayStr,
        isHalfDay: false,
        reason: '',
        contactPhone: '',
        attachmentNote: ''
      });
    }
    setErrors({});
    setServerError(null);
  }, [leaveToEdit, isOpen]);

  // Handle Input Changes
  const handleChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'startDate' && next.isHalfDay) {
        next.endDate = value;
      }
      if (field === 'isHalfDay' && value === true) {
        next.endDate = next.startDate;
      }
      return next;
    });

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
    if (serverError) {
      setServerError(null);
    }
  };

  const totalCalculatedDays = calculateDays(formData.startDate, formData.endDate, formData.isHalfDay);

  // Validate form
  const validate = () => {
    const errs = {};
    if (!formData.leaveType) errs.leaveType = 'Please select a leave type.';
    if (!formData.startDate) errs.startDate = 'Start date is required.';
    if (!formData.endDate) errs.endDate = 'End date is required.';
    if (formData.startDate && formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      errs.endDate = 'End date cannot be before start date.';
    }
    if (!formData.reason.trim()) {
      errs.reason = 'Please provide a clear reason for your leave request.';
    } else if (formData.reason.trim().length < 5) {
      errs.reason = 'Reason must be at least 5 characters long.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    const payload = {
      leaveType: formData.leaveType,
      startDate: formData.startDate,
      endDate: formData.isHalfDay ? formData.startDate : formData.endDate,
      isHalfDay: formData.isHalfDay,
      reason: formData.reason.trim(),
      contactPhone: formData.contactPhone.trim() || undefined,
      letterContent: formData.reason.trim()
    };

    try {
      if (isEditing) {
        await api.put(`/leaves/${leaveToEdit.id}`, payload);
      } else {
        await api.post('/leaves', payload);
      }

      onSuccess?.(isEditing ? 'Leave request updated successfully.' : 'Leave request submitted successfully.');
      onClose();
    } catch (err) {
      console.error('Leave submission error:', err);
      setServerError(err.response?.data?.message || 'Failed to submit leave request. Please check your inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-xl rounded-3xl border border-border/70 bg-card p-6 sm:p-7 shadow-2xl text-left space-y-5 font-sans my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CalendarPlus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight text-foreground">
                  {isEditing ? 'Edit Leave Application' : 'Apply for Leave'}
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  {isEditing
                    ? 'Modify your pending leave request details before sanction review'
                    : 'Submit a new leave or work-from-home request for approval'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Leave Type Selector */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-foreground mb-1.5">
                Leave Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.leaveType}
                onChange={(e) => handleChange('leaveType', e.target.value)}
                className={`w-full h-11 bg-muted/30 border ${
                  errors.leaveType ? 'border-rose-500/80 focus:ring-rose-500/20' : 'border-border/70 focus:ring-primary/20'
                } rounded-xl px-3.5 py-2 text-xs font-bold text-foreground cursor-pointer focus:outline-none focus:ring-2`}
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              {errors.leaveType && <p className="text-[11px] font-semibold text-rose-500 mt-1">{errors.leaveType}</p>}
            </div>

            {/* 2. Half Day Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border/50">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-primary" />
                <div>
                  <span className="text-xs font-bold text-foreground block">Half Day Leave</span>
                  <span className="text-[10px] text-muted-foreground block">Count as 0.5 working day</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isHalfDay}
                  onChange={(e) => handleChange('isHalfDay', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* 3. Dates Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-foreground mb-1.5">
                  Start Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleChange('startDate', e.target.value)}
                    className={`w-full h-11 bg-muted/30 border ${
                      errors.startDate ? 'border-rose-500/80 focus:ring-rose-500/20' : 'border-border/70 focus:ring-primary/20'
                    } rounded-xl px-3.5 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2`}
                  />
                </div>
                {errors.startDate && <p className="text-[11px] font-semibold text-rose-500 mt-1">{errors.startDate}</p>}
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-foreground mb-1.5">
                  End Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.isHalfDay ? formData.startDate : formData.endDate}
                    disabled={formData.isHalfDay}
                    onChange={(e) => handleChange('endDate', e.target.value)}
                    className={`w-full h-11 bg-muted/30 border ${
                      errors.endDate ? 'border-rose-500/80 focus:ring-rose-500/20' : 'border-border/70 focus:ring-primary/20'
                    } rounded-xl px-3.5 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                </div>
                {errors.endDate && <p className="text-[11px] font-semibold text-rose-500 mt-1">{errors.endDate}</p>}
              </div>
            </div>

            {/* 4. Live Duration Banner */}
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Calculated Duration:</span>
              </span>
              <span className="text-xs font-extrabold font-mono px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                {totalCalculatedDays === 0.5 ? '0.5 Day (Half Day)' : totalCalculatedDays === 1 ? '1 Working Day' : `${totalCalculatedDays} Working Days`}
              </span>
            </div>

            {/* 5. Reason Textarea */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-foreground mb-1.5">
                Reason / Purpose <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Explain the reason for taking leave (e.g. Medical emergency, family function, personal work)..."
                value={formData.reason}
                onChange={(e) => handleChange('reason', e.target.value)}
                className={`w-full bg-muted/30 border ${
                  errors.reason ? 'border-rose-500/80 focus:ring-rose-500/20' : 'border-border/70 focus:ring-primary/20'
                } rounded-xl p-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 resize-none`}
              />
              {errors.reason && <p className="text-[11px] font-semibold text-rose-500 mt-1">{errors.reason}</p>}
            </div>

            {/* 6. Emergency Contact Phone (Optional) */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-foreground mb-1.5">
                Emergency Contact Phone <span className="text-muted-foreground font-normal text-[10px] lowercase">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  className="w-full h-11 bg-muted/30 border border-border/70 rounded-xl pl-9 pr-3.5 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl border border-border/70 bg-card hover:bg-muted text-foreground text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{isEditing ? 'Save Changes' : 'Submit Leave'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ApplyLeaveModal;
