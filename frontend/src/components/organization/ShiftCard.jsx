import React from 'react';
import { motion } from 'framer-motion';
import {
  Clock, Edit2, Trash2, Copy, Users, Lock,
  Calendar, ShieldCheck, CheckSquare, Square, Eye
} from 'lucide-react';
import { formatSaturdayPattern } from './ShiftManager';

/**
 * ShiftCard Component
 *
 * Clean, compact card representation of an organizational shift.
 * Features:
 *  - Header: Checkbox + Shift Name + DEFAULT badge (left), ACTIVE status + Lock/Delete icon (top-right)
 *  - Timing: 24h & 12h range in a single horizontal line (e.g. 09:00–18:00 (09:00 AM–06:00 PM))
 *  - Information Row: Working Days summary, Member count, Today's status
 *  - Actions Toolbar: 4 actions (Details, Edit, Duplicate, Assign) in a single balanced horizontal row
 */
export default function ShiftCard({
  shift,
  isSelected = false,
  onToggleSelect,
  onClick,
  onOpenEdit,
  onDuplicate,
  onAssign,
  onDelete,
  analyticsItem,
  format12Hour,
  formatWorkingDaysSummary,
}) {
  const isDefault = shift.name === 'Company Default';
  const memberCount = shift._count?.members ?? (shift.members?.length || 0);
  const satPatternText = formatSaturdayPattern(shift.workingDays);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`p-4.5 sm:p-5 rounded-2xl border bg-white dark:bg-card shadow-xs transition-all hover:shadow-md flex flex-col justify-between gap-3.5 cursor-pointer relative ${
        isSelected
          ? 'border-emerald-600 ring-2 ring-emerald-500/30'
          : isDefault
          ? 'border-emerald-500/60 ring-1 ring-emerald-500/20'
          : 'border-emerald-500/30 hover:border-emerald-500/60'
      }`}
    >
      <div className="space-y-2.5">
        {/* Header: Checkbox, Name, Default Badge (Left) & Status Pill, Lock/Delete (Top-Right) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Checkbox for bulk selection */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(shift.id, e);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 dark:text-muted-foreground dark:hover:text-foreground cursor-pointer shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-muted/50 transition-colors"
              title={isSelected ? 'Deselect shift' : 'Select shift'}
            >
              {isSelected ? (
                <CheckSquare className="h-4 w-4 text-emerald-600" />
              ) : (
                <Square className="h-4 w-4 text-slate-400 dark:text-muted-foreground/60" />
              )}
            </button>

            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-foreground tracking-tight truncate">
                {shift.name}
              </h4>
              {isDefault && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0"
                  title="Default Company Shift"
                >
                  <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Default</span>
                </span>
              )}
            </div>
          </div>

          {/* Top-Right: Status Pill + Lock/Delete Icon */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Status Pill */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                shift.status === 'ACTIVE'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border/60'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  shift.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-muted-foreground'
                }`}
              />
              <span>{shift.status || 'ACTIVE'}</span>
            </span>

            {/* Lock / Delete Icon at Far Right */}
            {isDefault ? (
              <div
                className="p-1.5 rounded-xl text-slate-300 dark:text-muted-foreground/40 cursor-not-allowed shrink-0"
                title="Company Default Shift is protected and cannot be deleted."
              >
                <Lock className="h-4 w-4" />
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(shift);
                }}
                className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 transition-all cursor-pointer shrink-0"
                title="Delete shift"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Timing: Strictly single horizontal row with no wrapping */}
        <div className="flex items-center flex-nowrap gap-2 text-xs font-semibold whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">{shift.startTime}–{shift.endTime}</span>
          </div>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap shrink-0">
            ({format12Hour(shift.startTime)}–{format12Hour(shift.endTime)})
          </span>
        </div>

        {/* Information Row: Working Days, Member Count, Today's Status */}
        <div className="pt-0.5 flex items-center flex-wrap gap-2 text-[11px] font-semibold">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-muted/40 border border-slate-200/80 dark:border-border/50 text-slate-700 dark:text-foreground">
            <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-muted-foreground" />
            <span>{formatWorkingDaysSummary(shift.workingDays)}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-muted/40 border border-slate-200/80 dark:border-border/50 text-slate-700 dark:text-foreground">
            <Users className="h-3.5 w-3.5 text-blue-500" />
            <span>
              {memberCount} {memberCount === 1 ? 'Member' : 'Members'}
            </span>
          </div>

          {analyticsItem?.todayStatus && (
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold border ${
                analyticsItem.todayStatus === 'Working'
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : analyticsItem.todayStatus === 'WFH'
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
              }`}
            >
              <span>Today: {analyticsItem.todayStatus}</span>
            </div>
          )}

          {satPatternText && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-muted/40 border border-border/60 text-muted-foreground truncate"
              title={`Saturday Pattern: ${satPatternText}`}
            >
              <Calendar className="h-3 w-3 text-emerald-600 shrink-0" />
              <span className="truncate">{satPatternText}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions Toolbar: Single horizontal row of 4 equally spaced actions */}
      <div
        className="pt-3 border-t border-slate-100 dark:border-border/50 grid grid-cols-4 gap-1.5 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* View Details Action */}
        <button
          type="button"
          onClick={() => onClick?.()}
          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl hover:bg-slate-100 dark:hover:bg-muted text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground font-bold transition-all cursor-pointer truncate"
          title="View shift details drawer"
        >
          <Eye className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span className="truncate">Details</span>
        </button>

        {/* Edit Action */}
        <button
          type="button"
          onClick={() => onOpenEdit?.(shift)}
          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl hover:bg-slate-100 dark:hover:bg-muted text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground font-bold transition-all cursor-pointer truncate"
          title="Edit shift timings & working days"
        >
          <Edit2 className="h-3.5 w-3.5 text-slate-500 dark:text-muted-foreground shrink-0" />
          <span className="truncate">Edit</span>
        </button>

        {/* Duplicate Action */}
        <button
          type="button"
          onClick={() => onDuplicate?.(shift)}
          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl hover:bg-slate-100 dark:hover:bg-muted text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground font-bold transition-all cursor-pointer truncate"
          title="Duplicate shift configuration"
        >
          <Copy className="h-3.5 w-3.5 text-slate-500 dark:text-muted-foreground shrink-0" />
          <span className="truncate">Duplicate</span>
        </button>

        {/* Assign Members Action */}
        <button
          type="button"
          onClick={() => onAssign?.(shift)}
          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold transition-all cursor-pointer truncate"
          title="Assign members to this shift"
        >
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Assign</span>
        </button>
      </div>
    </motion.div>
  );
}
