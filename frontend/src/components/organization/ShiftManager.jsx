import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Plus, Search, Edit2, Trash2, Copy, Users, RefreshCw,
  CheckCircle2, AlertCircle, Info, Lock, X, Check, Building2,
  Calendar, ShieldCheck, Sparkles, HelpCircle, Download, CheckSquare,
  Square, Filter, Layers, FileSpreadsheet, Eye, AlertTriangle,
  Zap, ArrowRightLeft
} from 'lucide-react';
import api from '../../services/api';
import { useCompanyScope } from '../../context/CompanyScopeContext';
import { useAuth } from '../../context/AuthContext';
import AssignMembersModal from './AssignMembersModal';
import ShiftDetailsDrawer from './ShiftDetailsDrawer';
import ShiftAnalyticsBar from './ShiftAnalyticsBar';
import ShiftCalendar from './ShiftCalendar';
import ShiftPlannerModal from './ShiftPlannerModal';
import ShiftOverrideModal from './ShiftOverrideModal';
import ShiftSwapModal from './ShiftSwapModal';
import DepartmentScheduleView from './DepartmentScheduleView';
import AttendanceExceptionCenter from './AttendanceExceptionCenter';
import ShiftComplianceDashboard from './ShiftComplianceDashboard';
import ShiftApprovalsModal from './ShiftApprovalsModal';
import RecurringShiftTemplatesModal from './RecurringShiftTemplatesModal';
import ShiftAutomationSettingsModal from './ShiftAutomationSettingsModal';
import ShiftReportsModal from './ShiftReportsModal';
import ShiftCard from './ShiftCard';

const DAYS_OF_WEEK = [
  { key: 'MONDAY', label: 'Monday', short: 'Mon' },
  { key: 'TUESDAY', label: 'Tuesday', short: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wednesday', short: 'Wed' },
  { key: 'THURSDAY', label: 'Thursday', short: 'Thu' },
  { key: 'FRIDAY', label: 'Friday', short: 'Fri' },
  { key: 'SATURDAY', label: 'Saturday', short: 'Sat' },
  { key: 'SUNDAY', label: 'Sunday', short: 'Sun', locked: true }
];

const DEFAULT_DAYS_STATE = {
  MONDAY: 'Working',
  TUESDAY: 'Working',
  WEDNESDAY: 'Working',
  THURSDAY: 'Working',
  FRIDAY: 'Working',
  SATURDAY: 'Working',
  SUNDAY: 'Holiday'
};

export const DEFAULT_SATURDAY_PATTERN = {
  '1': 'Working',
  '2': 'Working',
  '3': 'Working',
  '4': 'Working',
  '5': 'Working'
};

export const formatSaturdayPattern = (workingDays) => {
  if (!workingDays) return null;
  let satConfig = null;
  if (Array.isArray(workingDays)) {
    satConfig = workingDays.find(d => String(d.day).toUpperCase() === 'SATURDAY');
  } else if (typeof workingDays === 'object') {
    satConfig = workingDays.SATURDAY || workingDays.Saturday;
  }

  if (!satConfig || typeof satConfig !== 'object' || !satConfig.pattern) {
    return null;
  }

  const satStatus = String(satConfig.status || 'WORKING').toUpperCase();
  if (satStatus === 'HOLIDAY') return null;

  const pattern = satConfig.pattern;
  const p1 = String(pattern['1'] || pattern[1] || satStatus).toUpperCase();
  const p2 = String(pattern['2'] || pattern[2] || satStatus).toUpperCase();
  const p3 = String(pattern['3'] || pattern[3] || satStatus).toUpperCase();
  const p4 = String(pattern['4'] || pattern[4] || satStatus).toUpperCase();
  const p5 = String(pattern['5'] || pattern[5] || satStatus).toUpperCase();

  const toLabel = (val) => {
    if (val === 'LEAVE' || val === 'HOLIDAY') return 'Leave';
    if (val === 'WFH') return 'WFH';
    return 'Working';
  };

  const l1 = toLabel(p1);
  const l2 = toLabel(p2);
  const l3 = toLabel(p3);
  const l4 = toLabel(p4);
  const l5 = toLabel(p5);

  // If all 5 are identical:
  if (l1 === l2 && l2 === l3 && l3 === l4 && l4 === l5) {
    if (l1 === 'Working') return 'All Saturdays Working';
    if (l1 === 'WFH') return 'All Saturdays WFH';
    if (l1 === 'Leave') return 'All Saturdays Leave';
  }

  // Classic company policy: 1st & 3rd / 2nd & 4th alternating pattern
  if (l1 === l3 && l2 === l4) {
    return `1st & 3rd ${l1} • 2nd & 4th ${l2} • 5th ${l5}`;
  }

  // General group formatting
  const map = { Leave: [], Working: [], WFH: [] };
  const ordinals = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th' };
  [
    { key: '1', label: l1 },
    { key: '2', label: l2 },
    { key: '3', label: l3 },
    { key: '4', label: l4 },
    { key: '5', label: l5 }
  ].forEach(item => {
    if (map[item.label]) map[item.label].push(ordinals[item.key]);
  });

  const parts = [];
  ['Leave', 'Working', 'WFH'].forEach(type => {
    const list = map[type];
    if (list && list.length > 0) {
      const listStr = list.length === 1
        ? list[0]
        : list.slice(0, -1).join(', ') + ' & ' + list[list.length - 1];
      parts.push(`${listStr} ${type}`);
    }
  });

  return parts.join(' • ');
};

const format12Hour = (timeStr) => {
  if (!timeStr) return '--:--';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${mStr || '00'} ${period}`;
};

const formatWorkingDaysSummary = (workingDays) => {
  if (!workingDays) return 'Mon–Sat';
  if (Array.isArray(workingDays)) {
    const working = workingDays.filter(d => {
      if (d.status === 'Holiday' || d.isWorking === false) return false;
      return true;
    }).map(d => String(d.day).toUpperCase());
    if (working.length === 6 && !working.includes('SUNDAY')) return 'Mon–Sat';
    if (working.length === 5 && !working.includes('SATURDAY') && !working.includes('SUNDAY')) return 'Mon–Fri';
    return `${working.length} Days/wk`;
  }
  if (typeof workingDays === 'object') {
    const working = Object.entries(workingDays).filter(([k, v]) => {
      const normK = k.toUpperCase();
      if (normK === 'SUNDAY') return false;
      if (typeof v === 'object' && v !== null) {
        const s = String(v.status || '').toUpperCase();
        return s === 'WORKING' || s === 'WFH';
      }
      return v === 'Working' || v === 'WFH' || v === true;
    });
    const workingKeys = working.map(w => w[0].toUpperCase());
    if (workingKeys.length === 6 && !workingKeys.includes('SUNDAY')) return 'Mon–Sat';
    if (workingKeys.length === 5 && !workingKeys.includes('SATURDAY') && !workingKeys.includes('SUNDAY')) return 'Mon–Fri';
    return `${workingKeys.length} Days/wk`;
  }
  return 'Mon–Sat';
};

const ShiftManager = ({ onShiftsCountChange }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { selectedOrgId, setSelectedOrgId, companies } = useCompanyScope();

  // State
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Analytics State
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // View Mode Switcher: 'shifts' | 'calendar' | 'department'
  const [currentView, setCurrentView] = useState('shifts');

  // Planning Modals State
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [isSwapOpen, setIsSwapOpen] = useState(false);

  // Phase 7 Automation & Workflow Modals State
  const [isApprovalsOpen, setIsApprovalsOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const fetchPendingApprovalsCount = async () => {
    if (!selectedOrgId) return;
    try {
      const res = await api.get('/workforce/approvals', {
        params: { organizationId: selectedOrgId, status: 'PENDING' }
      });
      if (res.data?.success) {
        setPendingApprovalsCount(res.data.approvals?.length || 0);
      }
    } catch {
      // Quiet fail
    }
  };

  useEffect(() => {
    fetchPendingApprovalsCount();
  }, [selectedOrgId]);

  // Bulk Multi-Select State
  const [selectedShiftIds, setSelectedShiftIds] = useState([]);

  // Drawer State
  const [selectedDrawerShift, setSelectedDrawerShift] = useState(null);

  // Toast Notifications
  const [toast, setToast] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [safetyModal, setSafetyModal] = useState(null);

  // Assign Members Modal State
  const [assigningShift, setAssigningShift] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    startTime: '09:00',
    endTime: '18:00',
    workingDays: { ...DEFAULT_DAYS_STATE }
  });
  const [saturdayPattern, setSaturdayPattern] = useState({ ...DEFAULT_SATURDAY_PATTERN });

  // Detect when current editing shift is Company Default
  const isDefaultShift = Boolean(
    editingShift && (
      editingShift.isDefault ||
      editingShift.name === 'Company Default' ||
      formData.name === 'Company Default'
    )
  );

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Fetch shifts for selected company
  const fetchShifts = async () => {
    if (!selectedOrgId) return;
    try {
      setLoading(true);
      const res = await api.get('/shifts', {
        params: { organizationId: selectedOrgId }
      });
      if (res.data?.success) {
        const fetchedShifts = res.data.shifts || [];
        setShifts(fetchedShifts);
        if (onShiftsCountChange) {
          onShiftsCountChange(fetchedShifts.length);
        }
      }
    } catch (err) {
      console.error('[ShiftManager] Error fetching shifts:', err);
      showToast('error', err.response?.data?.message || 'Failed to load shifts.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch live shift analytics
  const fetchAnalytics = async () => {
    if (!selectedOrgId) return;
    try {
      setLoadingAnalytics(true);
      const res = await api.get('/shifts/analytics', {
        params: { organizationId: selectedOrgId }
      });
      if (res.data?.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.warn('[ShiftManager] Error fetching analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    setSelectedShiftIds([]);
    fetchShifts();
    fetchAnalytics();
  }, [selectedOrgId]);

  // Open Create Modal
  const handleOpenAddModal = () => {
    setEditingShift(null);
    setFormData({
      name: '',
      startTime: '09:00',
      endTime: '18:00',
      workingDays: { ...DEFAULT_DAYS_STATE }
    });
    setSaturdayPattern({ ...DEFAULT_SATURDAY_PATTERN });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (shift) => {
    setEditingShift(shift);
    let daysMap = { ...DEFAULT_DAYS_STATE };
    let initialSatPattern = { ...DEFAULT_SATURDAY_PATTERN };

    if (shift.workingDays) {
      if (Array.isArray(shift.workingDays)) {
        shift.workingDays.forEach(d => {
          const normDay = String(d.day || '').toUpperCase();
          const s = d.status || (d.isWorking ? 'Working' : 'Holiday');
          daysMap[normDay] = s;
          if (normDay === 'SATURDAY' && d.pattern) {
            for (let i = 1; i <= 5; i++) {
              const pVal = String(d.pattern[String(i)] || d.pattern[i] || s).toUpperCase();
              initialSatPattern[String(i)] = (pVal === 'LEAVE' || pVal === 'HOLIDAY') ? 'Leave' : pVal === 'WFH' ? 'WFH' : 'Working';
            }
          }
        });
      } else if (typeof shift.workingDays === 'object') {
        Object.entries(shift.workingDays).forEach(([k, v]) => {
          const normK = k.toUpperCase();
          if (normK === 'SATURDAY' && typeof v === 'object' && v !== null) {
            const s = String(v.status || 'Working').toUpperCase();
            daysMap.SATURDAY = s === 'WFH' ? 'WFH' : s === 'HOLIDAY' ? 'Holiday' : 'Working';
            if (v.pattern) {
              for (let i = 1; i <= 5; i++) {
                const pVal = String(v.pattern[String(i)] || v.pattern[i] || s).toUpperCase();
                initialSatPattern[String(i)] = (pVal === 'LEAVE' || pVal === 'HOLIDAY') ? 'Leave' : pVal === 'WFH' ? 'WFH' : 'Working';
              }
            } else {
              for (let i = 1; i <= 5; i++) {
                initialSatPattern[String(i)] = daysMap.SATURDAY === 'WFH' ? 'WFH' : 'Working';
              }
            }
          } else {
            daysMap[normK] = v;
          }
        });
      }
    }

    setFormData({
      name: shift.name,
      startTime: shift.startTime || '09:00',
      endTime: shift.endTime || '18:00',
      workingDays: daysMap
    });
    setSaturdayPattern(initialSatPattern);
    setIsModalOpen(true);
  };

  // Duplicate single shift
  const handleDuplicate = async (shift) => {
    try {
      const res = await api.post(`/shifts/${shift.id}/duplicate`, {
        organizationId: selectedOrgId
      });
      if (res.data?.success) {
        showToast('success', res.data.message || `Shift duplicated as "${res.data.shift?.name}".`);
        window.dispatchEvent(new CustomEvent('shift_updated', { detail: { shiftId: res.data.shift?.id, organizationId: selectedOrgId } }));
        await fetchShifts();
        await fetchAnalytics();
      }
    } catch (err) {
      console.error('[ShiftManager] Error duplicating shift:', err);
      showToast('error', err.response?.data?.message || 'Failed to duplicate shift.');
    }
  };

  // Toggle day status
  const handleToggleDay = (dayKey, state) => {
    if (dayKey === 'SUNDAY') return;
    setFormData(prev => ({
      ...prev,
      workingDays: {
        ...prev.workingDays,
        [dayKey]: state
      }
    }));

    // When Saturday status changes, sync pattern options appropriately
    if (dayKey === 'SATURDAY') {
      if (state === 'WFH') {
        setSaturdayPattern(prev => {
          const next = { ...prev };
          for (let i = 1; i <= 5; i++) {
            if (next[String(i)] === 'Working') next[String(i)] = 'WFH';
          }
          return next;
        });
      } else if (state === 'Working') {
        setSaturdayPattern(prev => {
          const next = { ...prev };
          for (let i = 1; i <= 5; i++) {
            if (next[String(i)] === 'WFH') next[String(i)] = 'Working';
          }
          return next;
        });
      }
    }
  };

  // Toggle individual Saturday in pattern (1st - 5th)
  const handleToggleSaturdayPattern = (indexStr, option) => {
    setSaturdayPattern(prev => ({
      ...prev,
      [indexStr]: option
    }));
  };

  // Request Confirmation before creating / updating
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('error', 'Shift name is required.');
      return;
    }

    setConfirmModal({
      action: editingShift ? 'UPDATE' : 'CREATE',
      shiftName: formData.name.trim()
    });
  };

  // Confirm and Execute Save
  const handleConfirmSave = async () => {
    const isEditing = Boolean(editingShift);
    setSubmitting(true);
    try {
      // Build workingDays payload with extended Saturday configuration if Working or WFH
      const satStatus = formData.workingDays.SATURDAY || 'Working';
      const workingDaysPayload = { ...formData.workingDays };

      if (satStatus === 'Working' || satStatus === 'WFH') {
        const primaryOption = satStatus === 'WFH' ? 'WFH' : 'WORKING';
        workingDaysPayload.SATURDAY = {
          status: primaryOption,
          pattern: {
            '1': saturdayPattern['1'] === 'Leave' ? 'LEAVE' : primaryOption,
            '2': saturdayPattern['2'] === 'Leave' ? 'LEAVE' : primaryOption,
            '3': saturdayPattern['3'] === 'Leave' ? 'LEAVE' : primaryOption,
            '4': saturdayPattern['4'] === 'Leave' ? 'LEAVE' : primaryOption,
            '5': saturdayPattern['5'] === 'Leave' ? 'LEAVE' : primaryOption
          }
        };
      } else {
        workingDaysPayload.SATURDAY = 'Holiday';
      }

      if (isEditing) {
        const res = await api.put(`/shifts/${editingShift.id}`, {
          name: formData.name.trim(),
          startTime: formData.startTime,
          endTime: formData.endTime,
          workingDays: workingDaysPayload,
          organizationId: selectedOrgId
        });
        if (res.data?.success) {
          showToast('success', `Shift "${formData.name.trim()}" updated successfully.`);
          setIsModalOpen(false);
          setConfirmModal(null);
          window.dispatchEvent(new CustomEvent('shift_updated', { detail: { shiftId: editingShift.id, organizationId: selectedOrgId } }));
          await fetchShifts();
          await fetchAnalytics();
        }
      } else {
        const res = await api.post('/shifts', {
          name: formData.name.trim(),
          startTime: formData.startTime,
          endTime: formData.endTime,
          workingDays: workingDaysPayload,
          organizationId: selectedOrgId
        });
        if (res.data?.success) {
          showToast('success', `Shift "${formData.name.trim()}" created successfully.`);
          setIsModalOpen(false);
          setConfirmModal(null);
          window.dispatchEvent(new CustomEvent('shift_updated', { detail: { shiftId: res.data.shift?.id, organizationId: selectedOrgId } }));
          await fetchShifts();
          await fetchAnalytics();
        }
      }
    } catch (err) {
      console.error('[ShiftManager] Error saving shift:', err);
      showToast('error', err.response?.data?.message || 'Failed to save shift.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Shift with Safety Guard
  const handleDeleteShift = (shift) => {
    if (shift.name === 'Company Default') {
      showToast('error', 'The Company Default shift is protected and cannot be deleted.');
      return;
    }

    const memberCount = shift._count?.members ?? (shift.members?.length || 0);

    setSafetyModal({
      title: `Delete Shift "${shift.name}"?`,
      message: memberCount > 0
        ? `This shift is currently assigned to ${memberCount} member(s). Deleting it will safely return all ${memberCount} member(s) to the Company Default shift.`
        : `Are you sure you want to delete "${shift.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete Shift',
      confirmColor: 'bg-rose-600 hover:bg-rose-700 text-white',
      onConfirm: async () => {
        try {
          const res = await api.delete(`/shifts/${shift.id}`, {
            params: { organizationId: selectedOrgId }
          });
          if (res.data?.success) {
            showToast('success', res.data.message || `Shift "${shift.name}" deleted successfully.`);
            setSafetyModal(null);
            if (selectedDrawerShift?.id === shift.id) setSelectedDrawerShift(null);
            window.dispatchEvent(new CustomEvent('shift_updated', { detail: { shiftId: shift.id, organizationId: selectedOrgId } }));
            await fetchShifts();
            await fetchAnalytics();
          }
        } catch (err) {
          console.error('[ShiftManager] Error deleting shift:', err);
          showToast('error', err.response?.data?.message || 'Failed to delete shift.');
        }
      }
    });
  };

  // Multi-Select Handlers
  const handleToggleSelectShift = (shiftId, e) => {
    if (e) e.stopPropagation();
    setSelectedShiftIds(prev =>
      prev.includes(shiftId) ? prev.filter(id => id !== shiftId) : [...prev, shiftId]
    );
  };

  const handleSelectAll = () => {
    if (selectedShiftIds.length === filteredShifts.length) {
      setSelectedShiftIds([]);
    } else {
      setSelectedShiftIds(filteredShifts.map(s => s.id));
    }
  };

  // Bulk Actions
  const handleBulkAction = async (action) => {
    if (selectedShiftIds.length === 0) return;

    // Safety checks for bulk deactivate
    if (action === 'DEACTIVATE') {
      const selectedShifts = shifts.filter(s => selectedShiftIds.includes(s.id));
      const hasDefault = selectedShifts.some(s => s.name === 'Company Default');
      const totalAssigned = selectedShifts.reduce((acc, s) => acc + (s.members?.length || 0), 0);

      if (hasDefault && selectedShifts.length === 1) {
        showToast('error', 'The Company Default shift cannot be deactivated.');
        return;
      }

      setSafetyModal({
        title: 'Bulk Deactivate Shifts?',
        message: `${selectedShifts.length} shift(s) will be deactivated.${
          hasDefault ? ' (Company Default will be skipped automatically).' : ''
        } ${totalAssigned > 0 ? `Notice: These shifts currently have ${totalAssigned} assigned member(s).` : ''}`,
        confirmLabel: 'Confirm Deactivate',
        confirmColor: 'bg-amber-600 hover:bg-amber-700 text-white',
        onConfirm: async () => {
          try {
            const res = await api.post('/shifts/bulk', {
              shiftIds: selectedShiftIds,
              action: 'DEACTIVATE',
              organizationId: selectedOrgId
            });
            if (res.data?.success) {
              showToast('success', `Successfully deactivated ${res.data.modifiedCount} shift(s).`);
              setSafetyModal(null);
              setSelectedShiftIds([]);
              window.dispatchEvent(new CustomEvent('shift_updated', { detail: { organizationId: selectedOrgId } }));
              await fetchShifts();
              await fetchAnalytics();
            }
          } catch (err) {
            console.error('[ShiftManager] Error in bulk deactivate:', err);
            showToast('error', err.response?.data?.message || 'Failed to bulk deactivate.');
          }
        }
      });
      return;
    }

    try {
      const res = await api.post('/shifts/bulk', {
        shiftIds: selectedShiftIds,
        action,
        organizationId: selectedOrgId
      });
      if (res.data?.success) {
        showToast('success', `Successfully updated ${res.data.modifiedCount} shift(s).`);
        setSelectedShiftIds([]);
        window.dispatchEvent(new CustomEvent('shift_updated', { detail: { organizationId: selectedOrgId } }));
        await fetchShifts();
        await fetchAnalytics();
      }
    } catch (err) {
      console.error('[ShiftManager] Error in bulk action:', err);
      showToast('error', err.response?.data?.message || 'Bulk operation failed.');
    }
  };

  // Bulk Duplicate
  const handleBulkDuplicate = async () => {
    if (selectedShiftIds.length === 0) return;
    try {
      let count = 0;
      for (const id of selectedShiftIds) {
        await api.post(`/shifts/${id}/duplicate`, { organizationId: selectedOrgId });
        count++;
      }
      showToast('success', `Duplicated ${count} shift(s) successfully.`);
      setSelectedShiftIds([]);
      window.dispatchEvent(new CustomEvent('shift_updated', { detail: { organizationId: selectedOrgId } }));
      await fetchShifts();
      await fetchAnalytics();
    } catch (err) {
      console.error('[ShiftManager] Error in bulk duplicate:', err);
      showToast('error', 'Failed to duplicate selected shifts.');
    }
  };

  // CSV Export: Shifts
  const handleExportShiftsCSV = () => {
    if (shifts.length === 0) {
      showToast('error', 'No shifts to export.');
      return;
    }

    const headers = ['Shift Name', 'Start Time', 'End Time', 'Status', 'Assigned Members', 'Working Days Summary', 'Assigned Departments'];
    const rows = shifts.map(s => {
      const depts = s.assignedDepartments?.join('; ') || 'General';
      const mCount = s._count?.members ?? (s.members?.length || 0);
      return [
        `"${s.name.replace(/"/g, '""')}"`,
        `"${s.startTime}"`,
        `"${s.endTime}"`,
        `"${s.status || 'ACTIVE'}"`,
        `"${mCount}"`,
        `"${formatWorkingDaysSummary(s.workingDays)}"`,
        `"${depts.replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `shifts_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Shifts exported to CSV successfully.');
  };

  // CSV Export: Members
  const handleExportMembersCSV = () => {
    const downloadUrl = `/api/shifts/export/members?organizationId=${selectedOrgId || ''}&format=csv`;
    window.open(downloadUrl, '_blank');
    showToast('success', 'Member shift assignments exported to CSV.');
  };

  // Today's Breakdown Map for quick lookup
  const breakdownMap = useMemo(() => {
    const map = new Map();
    if (analytics?.breakdown) {
      analytics.breakdown.forEach(b => map.set(b.shiftId, b));
    }
    return map;
  }, [analytics]);

  // Filtered shifts based on search input & active filter
  const filteredShifts = useMemo(() => {
    let list = shifts;

    // Filter pills
    if (activeFilter === 'ACTIVE') {
      list = list.filter(s => s.status === 'ACTIVE');
    } else if (activeFilter === 'INACTIVE') {
      list = list.filter(s => s.status === 'INACTIVE');
    } else if (activeFilter === 'DEFAULT') {
      list = list.filter(s => s.name === 'Company Default');
    } else if (activeFilter === 'CUSTOM') {
      list = list.filter(s => s.name !== 'Company Default');
    } else if (activeFilter === 'WORKING_TODAY') {
      list = list.filter(s => breakdownMap.get(s.id)?.todayStatus === 'Working');
    } else if (activeFilter === 'WFH_TODAY') {
      list = list.filter(s => breakdownMap.get(s.id)?.todayStatus === 'WFH');
    } else if (activeFilter === 'HOLIDAY_TODAY') {
      list = list.filter(s => breakdownMap.get(s.id)?.todayStatus === 'Holiday');
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.startTime?.includes(q) ||
        s.endTime?.includes(q) ||
        s.assignedDepartments?.some(d => d.toLowerCase().includes(q))
      );
    }

    return list;
  }, [shifts, search, activeFilter, breakdownMap]);

  // Counts for filter pills
  const filterCounts = useMemo(() => {
    return {
      ALL: shifts.length,
      ACTIVE: shifts.filter(s => s.status === 'ACTIVE').length,
      INACTIVE: shifts.filter(s => s.status === 'INACTIVE').length,
      DEFAULT: shifts.filter(s => s.name === 'Company Default').length,
      CUSTOM: shifts.filter(s => s.name !== 'Company Default').length,
      WORKING_TODAY: shifts.filter(s => breakdownMap.get(s.id)?.todayStatus === 'Working').length,
      WFH_TODAY: shifts.filter(s => breakdownMap.get(s.id)?.todayStatus === 'WFH').length,
      HOLIDAY_TODAY: shifts.filter(s => breakdownMap.get(s.id)?.todayStatus === 'Holiday').length
    };
  }, [shifts, breakdownMap]);

  const customShifts = useMemo(() => {
    return shifts.filter(s => s.name !== 'Company Default');
  }, [shifts]);

  const selectedCompany = companies.find(c => c.id === selectedOrgId);

  return (
    <div className="space-y-6">
      {/* FLOATING SUCCESS / ERROR TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-600/95 border-emerald-500/50 text-white shadow-emerald-600/25'
                : 'bg-rose-600/95 border-rose-500/50 text-white shadow-rose-600/25'
            }`}
          >
            <div className="p-1 rounded-xl bg-white/20">
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-white" />
              ) : (
                <AlertCircle className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="text-xs font-bold tracking-tight pr-1">
              {toast.message}
            </div>
            <button
              onClick={() => setToast(null)}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors cursor-pointer text-white/80 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PHASE 6 & PHASE 7: VIEW SWITCHER TABS & WORKFORCE ACTIONS */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-muted/30 p-1.5 rounded-2xl border border-border/50 flex-wrap">
          {[
            { id: 'shifts', label: 'Shifts & Operations', icon: Clock },
            { id: 'calendar', label: 'Shift Calendar', icon: Calendar },
            { id: 'department', label: 'Department Roster', icon: Building2 },
            { id: 'exceptions', label: 'Attendance Exceptions', icon: AlertCircle },
            { id: 'compliance', label: 'Compliance & Rest Days', icon: ShieldCheck }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Planning & Automation Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsPlannerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-card border border-border/70 hover:bg-muted text-foreground text-xs font-black transition-all cursor-pointer shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>Plan Shift</span>
          </button>

          <button
            onClick={() => setIsOverrideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-card border border-border/70 hover:bg-muted text-foreground text-xs font-black transition-all cursor-pointer shadow-xs"
          >
            <Zap className="h-3.5 w-3.5 text-purple-600" />
            <span>Override</span>
          </button>

          <button
            onClick={() => setIsSwapOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-card border border-border/70 hover:bg-muted text-foreground text-xs font-black transition-all cursor-pointer shadow-xs"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" />
            <span>Swap</span>
          </button>

          <button
            onClick={() => setIsApprovalsOpen(true)}
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-card border border-border/70 hover:bg-muted text-foreground text-xs font-black transition-all cursor-pointer shadow-xs"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
            <span>Approvals</span>
            {pendingApprovalsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-white font-extrabold ml-0.5 animate-pulse">
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsTemplatesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-card border border-border/70 hover:bg-muted text-foreground text-xs font-black transition-all cursor-pointer shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 text-indigo-600" />
            <span>Templates</span>
          </button>

          <button
            onClick={() => setIsReportsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-card border border-border/70 hover:bg-muted text-foreground text-xs font-black transition-all cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" />
            <span>Reports</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-card border border-border/70 hover:bg-muted text-foreground text-xs font-black transition-all cursor-pointer shadow-xs"
            title="Workforce Automation Settings"
          >
            <Filter className="h-3.5 w-3.5 text-slate-600" />
            <span>Automation</span>
          </button>
        </div>
      </div>

      {currentView === 'calendar' ? (
        <ShiftCalendar
          organizationId={selectedOrgId}
          onOpenPlanner={() => setIsPlannerOpen(true)}
          onOpenOverride={() => setIsOverrideOpen(true)}
          onOpenSwap={() => setIsSwapOpen(true)}
        />
      ) : currentView === 'department' ? (
        <DepartmentScheduleView
          organizationId={selectedOrgId}
          shifts={shifts}
          onOpenOverride={() => setIsOverrideOpen(true)}
          onOpenSwap={() => setIsSwapOpen(true)}
        />
      ) : currentView === 'exceptions' ? (
        <AttendanceExceptionCenter
          organizationId={selectedOrgId}
        />
      ) : currentView === 'compliance' ? (
        <ShiftComplianceDashboard
          organizationId={selectedOrgId}
        />
      ) : (
        <>
          {/* PHASE 5: LIVE SHIFT ANALYTICS BAR (Top KPI Cards + Collapsible Attendance Breakdown) */}
          <ShiftAnalyticsBar
            analytics={analytics}
            loading={loadingAnalytics}
            onSelectShiftForDrawer={(shiftId) => {
              const s = shifts.find(x => x.id === shiftId);
              if (s) setSelectedDrawerShift(s);
            }}
          />

      {/* DASHBOARD TOP CONTROLS */}
      <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search shift by name, time, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2 text-xs font-medium rounded-2xl border border-border/60 bg-muted/30 focus:bg-background focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Company Filter (Super Admin only) */}
          {isSuperAdmin && companies.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-border/60 bg-muted/30">
              <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <select
                value={selectedOrgId || ''}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer max-w-[170px] truncate"
                title="Filter by Company"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id} className="bg-card text-foreground">
                    {c.name} ({c.companyCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Export Shifts CSV */}
          <button
            onClick={handleExportShiftsCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-border/60 bg-muted/30 hover:bg-muted text-foreground text-xs font-bold transition-all cursor-pointer"
            title="Export Shifts as CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Export Shifts</span>
          </button>

          {/* Export Members CSV */}
          <button
            onClick={handleExportMembersCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-border/60 bg-muted/30 hover:bg-muted text-foreground text-xs font-bold transition-all cursor-pointer"
            title="Export Members CSV"
          >
            <Download className="h-3.5 w-3.5 text-blue-500" />
            <span className="hidden sm:inline">Export Members</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => {
              fetchShifts();
              fetchAnalytics();
            }}
            disabled={loading || loadingAnalytics}
            className="p-2.5 rounded-2xl border border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer disabled:opacity-50"
            title="Refresh shifts dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${loading || loadingAnalytics ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {/* + Add Shift Button */}
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>+ Add Shift</span>
          </button>
        </div>
      </div>

      {/* FILTER PILLS & SELECT ALL TOOLBAR */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {[
            { key: 'ALL', label: 'All' },
            { key: 'ACTIVE', label: 'Active' },
            { key: 'INACTIVE', label: 'Inactive' },
            { key: 'DEFAULT', label: 'Default' },
            { key: 'CUSTOM', label: 'Custom' },
            { key: 'WORKING_TODAY', label: 'Working Today' },
            { key: 'WFH_TODAY', label: 'WFH Today' },
            { key: 'HOLIDAY_TODAY', label: 'Holiday Today' }
          ].map((pill) => {
            const count = filterCounts[pill.key] ?? 0;
            const isSelected = activeFilter === pill.key;
            return (
              <button
                key={pill.key}
                onClick={() => setActiveFilter(pill.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-card border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white shadow-xs'
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-full ${
                    isSelected
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Select All Toggle */}
        {filteredShifts.length > 0 && (
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-slate-800/70 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shrink-0 border border-slate-200 dark:border-slate-800 shadow-xs"
          >
            {selectedShiftIds.length === filteredShifts.length ? (
              <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Square className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            )}
            <span>
              {selectedShiftIds.length === filteredShifts.length ? 'Deselect All' : 'Select All'}
            </span>
          </button>
        )}
      </div>

      {/* DASHBOARD CONTENT AREA */}
      {loading && shifts.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="text-xs font-bold">Loading company shifts...</span>
        </div>
      ) : filteredShifts.length === 0 ? (
        /* Empty State */
        <div className="py-16 px-4 rounded-3xl bg-card border border-dashed border-border/80 text-center space-y-4">
          <div className="h-14 w-14 rounded-3xl bg-muted/60 text-muted-foreground border border-border flex items-center justify-center mx-auto">
            <Search className="h-7 w-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h4 className="text-base font-extrabold text-foreground">No Shifts Found</h4>
            <p className="text-xs text-muted-foreground">
              {search.trim()
                ? `No shifts match "${search}". Try searching by another keyword.`
                : 'No shifts match the selected filter.'}
            </p>
          </div>
          {(search.trim() || activeFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('');
                setActiveFilter('ALL');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        /* RESPONSIVE GRID (Desktop 3-col, Tablet 2-col, Mobile 1-col) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              isSelected={selectedShiftIds.includes(shift.id)}
              analyticsItem={breakdownMap.get(shift.id)}
              onToggleSelect={handleToggleSelectShift}
              onClick={() => setSelectedDrawerShift(shift)}
              onOpenEdit={handleOpenEditModal}
              onDuplicate={handleDuplicate}
              onAssign={setAssigningShift}
              onDelete={handleDeleteShift}
              format12Hour={format12Hour}
              formatWorkingDaysSummary={formatWorkingDaysSummary}
            />
          ))}
        </div>
      )}

      {/* FLOATING BULK ACTIONS TOOLBAR */}
      <AnimatePresence>
        {selectedShiftIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-10 z-40 p-3 rounded-2xl bg-card/95 border border-border shadow-2xl backdrop-blur-md flex items-center gap-3 flex-wrap text-xs font-bold"
          >
            <div className="flex items-center gap-2 pl-2 border-r border-border/60 pr-3">
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono text-[10px]">
                {selectedShiftIds.length}
              </span>
              <span className="text-foreground">Selected</span>
            </div>

            <button
              onClick={() => handleBulkAction('ACTIVATE')}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer"
            >
              Activate
            </button>

            <button
              onClick={() => handleBulkAction('DEACTIVATE')}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-all cursor-pointer"
            >
              Deactivate
            </button>

            <button
              onClick={handleBulkDuplicate}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-all cursor-pointer"
            >
              Duplicate
            </button>

            <button
              onClick={() => setSelectedShiftIds([])}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Deselect all"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}

      {/* SHIFT DETAILS DRAWER */}
      <ShiftDetailsDrawer
        shift={selectedDrawerShift}
        isOpen={Boolean(selectedDrawerShift)}
        onClose={() => setSelectedDrawerShift(null)}
        onEdit={(shift) => handleOpenEditModal(shift)}
        onDuplicate={(shift) => handleDuplicate(shift)}
        onAssignMembers={(shift) => setAssigningShift(shift)}
        analyticsItem={selectedDrawerShift ? breakdownMap.get(selectedDrawerShift.id) : null}
      />

      {/* ADD / EDIT SHIFT MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-xl max-h-[95vh] sm:max-h-[90vh] rounded-3xl border border-border/70 bg-card shadow-2xl flex flex-col overflow-hidden text-left"
            >
              {/* 1. FIXED HEADER */}
              <div className="px-6 py-4.5 sm:px-7 sm:py-5 border-b border-border/50 shrink-0 bg-card flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center shadow-inner shrink-0">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-foreground truncate">
                      {editingShift ? `Edit Shift: ${editingShift.name}` : 'Create New Shift'}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium truncate">
                      {isDefaultShift
                        ? 'Configure weekly working day schedules and weekend patterns.'
                        : 'Configure operational hours and weekly working day schedules.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* FORM WRAPPING SCROLLABLE BODY & STICKY FOOTER */}
              <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0 text-xs">
                {/* 2. SCROLLABLE BODY */}
                <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-7 space-y-6 pb-8 pr-5 sm:pr-6">
                  {/* Basic Information Section */}
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Basic Information</span>
                    </h4>

                    <div className="space-y-1.5">
                      <label className="font-bold text-foreground block">Shift Name *</label>
                      <input
                        type="text"
                        required
                        disabled={isDefaultShift}
                        placeholder="e.g. Morning Shift, General Shift, Night Shift"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={`w-full rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 font-semibold text-foreground focus:bg-background focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all ${
                          isDefaultShift ? 'cursor-not-allowed opacity-80' : ''
                        }`}
                      />
                    </div>

                    {/* Working Hours Section */}
                    {!isDefaultShift && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-foreground block">Working Hours</label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="font-bold text-foreground">Start Time *</label>
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                {format12Hour(formData.startTime)}
                              </span>
                            </div>
                            <input
                              type="time"
                              required
                              value={formData.startTime}
                              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                              className="w-full rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2 font-bold text-foreground focus:bg-background focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="font-bold text-foreground">End Time *</label>
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                {format12Hour(formData.endTime)}
                              </span>
                            </div>
                            <input
                              type="time"
                              required
                              value={formData.endTime}
                              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                              className="w-full rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2 font-bold text-foreground focus:bg-background focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Attendance Notice Card */}
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3 text-emerald-800 dark:text-emerald-300">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-xs">
                        Uses Company Attendance Settings (Grace Period &amp; Early Clock-In).
                      </p>
                      <p className="text-[11px] opacity-85 leading-relaxed">
                        Grace period and early check-in buffers are globally standardized at the organization level.
                      </p>
                    </div>
                  </div>

                  {/* Working Days Selector Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Working Days Selector</span>
                      </h4>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        Mon–Sat Customizable • Sun Locked
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 border border-border/60 rounded-2xl p-3 sm:p-3.5 bg-muted/10">
                      {DAYS_OF_WEEK.map((d) => {
                        const currentStatus = formData.workingDays[d.key] || (d.key === 'SUNDAY' ? 'Holiday' : 'Working');
                        const isSunday = d.key === 'SUNDAY';
                        const isSaturday = d.key === 'SATURDAY';

                        return (
                          <React.Fragment key={d.key}>
                            <div
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 rounded-xl bg-card border border-border/40 text-xs gap-2"
                            >
                              <div className="flex items-center gap-2 pl-1">
                                <span className="font-extrabold text-foreground w-24">{d.label}</span>
                                {isSunday && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
                                    <Lock className="h-2.5 w-2.5 text-amber-500" /> Locked
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                {['Working', 'Holiday', 'WFH'].map((opt) => {
                                  const isSelected = currentStatus === opt;
                                  const isDisabled = isSunday;

                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      disabled={isDisabled}
                                      onClick={() => handleToggleDay(d.key, opt)}
                                      className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                                        isSelected
                                          ? opt === 'Working'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : opt === 'Holiday'
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : 'bg-blue-600 text-white shadow-xs'
                                          : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                                      } ${isDisabled && opt !== 'Holiday' ? 'opacity-30 cursor-not-allowed' : ''} ${
                                        isDisabled && opt === 'Holiday' ? 'cursor-not-allowed' : ''
                                      }`}
                                    >
                                      {isSunday && opt === 'Holiday' && (
                                        <Lock className="h-2.5 w-2.5 text-white/90" />
                                      )}
                                      <span>{opt}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* SATURDAY LEAVE PATTERN EXPANDABLE PANEL */}
                            {isSaturday && (currentStatus === 'Working' || currentStatus === 'WFH') && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="ml-1 sm:ml-3 pl-3 sm:pl-4 border-l-2 border-emerald-500/40 my-1 space-y-2.5"
                              >
                                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 space-y-3">
                                  <div>
                                    <h5 className="font-extrabold text-foreground text-xs flex items-center gap-1.5">
                                      <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                                      <span>Saturday Leave Pattern</span>
                                    </h5>
                                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                                      Choose which Saturdays are treated as leave days.
                                    </p>
                                  </div>

                                  <div className="space-y-1.5">
                                    {[
                                      { key: '1', label: '1st Saturday' },
                                      { key: '2', label: '2nd Saturday' },
                                      { key: '3', label: '3rd Saturday' },
                                      { key: '4', label: '4th Saturday' },
                                      { key: '5', label: '5th Saturday' }
                                    ].map((item) => {
                                      const isWfhMode = currentStatus === 'WFH';
                                      const primaryOption = isWfhMode ? 'WFH' : 'Working';
                                      const currentOption = saturdayPattern[item.key] || primaryOption;

                                      return (
                                        <div
                                          key={item.key}
                                          className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/40 text-xs"
                                        >
                                          <span className="font-bold text-foreground text-[11px] pl-1">
                                            {item.label}
                                          </span>

                                          <div className="flex items-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => handleToggleSaturdayPattern(item.key, primaryOption)}
                                              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                                                currentOption === primaryOption
                                                  ? primaryOption === 'Working'
                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                    : 'bg-blue-600 text-white shadow-xs'
                                                  : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                                              }`}
                                            >
                                              {primaryOption}
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => handleToggleSaturdayPattern(item.key, 'Leave')}
                                              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                                                currentOption === 'Leave'
                                                  ? 'bg-amber-600 text-white shadow-xs'
                                                  : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                                              }`}
                                            >
                                              Leave
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. STICKY FOOTER INSIDE CARD */}
                <div className="px-6 py-4.5 sm:px-7 sm:py-5 border-t border-border/50 bg-white dark:bg-card sticky bottom-0 shrink-0 flex items-center justify-end gap-3 z-10 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {editingShift ? 'Save Changes' : 'Create Shift'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION DIALOG */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 text-center"
            >
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <Clock className="h-6 w-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-foreground">
                  {confirmModal.action === 'UPDATE' ? 'Update Shift?' : `Create "${confirmModal.shiftName}"?`}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {confirmModal.action === 'UPDATE'
                    ? 'Are you sure you want to update operational hours and day schedules for this shift?'
                    : `Are you sure you want to create the "${confirmModal.shiftName}" shift for this organization?`}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all cursor-pointer border border-border"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmSave}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{confirmModal.action === 'UPDATE' ? 'Confirm Update' : 'Confirm & Create'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SAFETY WARNING MODAL (Deactivation / Deletion with member impact) */}
      <AnimatePresence>
        {safetyModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 text-center"
            >
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-foreground">
                  {safetyModal.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {safetyModal.message}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSafetyModal(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all cursor-pointer border border-border"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={safetyModal.onConfirm}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer ${safetyModal.confirmColor}`}
                >
                  {safetyModal.confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ASSIGN MEMBERS MODAL */}
      <AssignMembersModal
        isOpen={Boolean(assigningShift)}
        onClose={() => setAssigningShift(null)}
        shift={assigningShift}
        company={selectedCompany}
        onSuccess={(msg) => {
          showToast('success', msg);
          fetchShifts();
          fetchAnalytics();
        }}
      />

      {/* SHIFT PLANNER MODAL */}
      <ShiftPlannerModal
        isOpen={isPlannerOpen}
        onClose={() => setIsPlannerOpen(false)}
        organizationId={selectedOrgId}
        shifts={shifts}
        onSuccess={(msg) => {
          showToast('success', msg);
          fetchShifts();
          fetchAnalytics();
        }}
      />

      {/* SHIFT OVERRIDE MODAL */}
      <ShiftOverrideModal
        isOpen={isOverrideOpen}
        onClose={() => setIsOverrideOpen(false)}
        organizationId={selectedOrgId}
        shifts={shifts}
        onSuccess={(msg) => {
          showToast('success', msg);
          fetchShifts();
          fetchAnalytics();
        }}
      />

      {/* SHIFT SWAP MODAL */}
      <ShiftSwapModal
        isOpen={isSwapOpen}
        onClose={() => setIsSwapOpen(false)}
        organizationId={selectedOrgId}
        onSuccess={(msg) => {
          showToast('success', msg);
          fetchShifts();
          fetchAnalytics();
        }}
      />

      {/* PHASE 7 MODALS */}
      <ShiftApprovalsModal
        isOpen={isApprovalsOpen}
        onClose={() => setIsApprovalsOpen(false)}
        organizationId={selectedOrgId}
        onApprovalUpdated={() => {
          fetchPendingApprovalsCount();
          fetchShifts();
          fetchAnalytics();
        }}
      />

      <RecurringShiftTemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        organizationId={selectedOrgId}
        shifts={shifts}
        onSuccess={(msg) => {
          showToast('success', msg);
          fetchShifts();
          fetchAnalytics();
        }}
      />

      <ShiftReportsModal
        isOpen={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
        organizationId={selectedOrgId}
      />

      <ShiftAutomationSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        organizationId={selectedOrgId}
      />
    </div>
  );
};

export default ShiftManager;
