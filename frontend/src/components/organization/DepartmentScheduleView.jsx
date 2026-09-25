import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Calendar, Filter, Users, Clock, ShieldCheck,
  AlertTriangle, CheckCircle2, Zap, ArrowRightLeft, Search,
  RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import api from '../../services/api';

const format12Hour = (timeStr) => {
  if (!timeStr) return '--:--';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${mStr || '00'} ${period}`;
};

const DepartmentScheduleView = ({
  organizationId,
  shifts = [],
  onOpenOverride,
  onOpenSwap
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rosterData, setRosterData] = useState(null);
  const [coverageData, setCoverageData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchRosterAndCoverage = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      const [rosterRes, coverageRes] = await Promise.all([
        api.get('/schedules/day', {
          params: { organizationId, date: selectedDate }
        }),
        api.get('/schedules/coverage', {
          params: { organizationId, date: selectedDate }
        })
      ]);

      if (rosterRes.data?.success) {
        setRosterData(rosterRes.data);
      }
      if (coverageRes.data?.success) {
        setCoverageData(coverageRes.data);
      }
    } catch (err) {
      console.warn('Error fetching roster/coverage:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRosterAndCoverage();
  }, [organizationId, selectedDate]);

  // Group roster items by department
  const groupedRoster = useMemo(() => {
    if (!rosterData?.roster) return [];
    let list = rosterData.roster;

    // Filters
    if (departmentFilter !== 'ALL') {
      list = list.filter(r => r.department === departmentFilter);
    }
    if (shiftFilter !== 'ALL') {
      list = list.filter(r => r.shiftId === shiftFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.employeeId?.toLowerCase().includes(q) ||
        r.shiftName?.toLowerCase().includes(q)
      );
    }

    const groups = new Map();
    list.forEach(item => {
      const dept = item.department || 'General';
      if (!groups.has(dept)) {
        groups.set(dept, []);
      }
      groups.get(dept).push(item);
    });

    return Array.from(groups.entries()).map(([deptName, members]) => ({
      departmentName: deptName,
      members
    }));
  }, [rosterData, departmentFilter, shiftFilter, search]);

  const uniqueDepartments = useMemo(() => {
    if (!rosterData?.roster) return [];
    const set = new Set();
    rosterData.roster.forEach(r => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set);
  }, [rosterData]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground tracking-tight">
              Department Schedule &amp; Coverage
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              View employee rosters by department with real-time staffing coverage validation.
            </p>
          </div>
        </div>

        {/* Date Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/30 border border-border/50 rounded-2xl p-1">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={handleToday}
              className="px-3 py-1 rounded-xl hover:bg-muted text-xs font-black text-foreground transition-all cursor-pointer"
            >
              Today
            </button>

            <button
              onClick={handleNextDay}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-2xl border border-border/60 bg-muted/30 text-xs font-bold text-foreground outline-none cursor-pointer"
          />

          <button
            onClick={fetchRosterAndCoverage}
            disabled={loading}
            className="p-2 rounded-2xl border border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Roster"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Coverage Checker Cards */}
      {coverageData?.departments?.length > 0 && (
        <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Staffing Coverage Validation</span>
            </h4>
            <span className="text-[10px] text-muted-foreground font-medium">
              {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {coverageData.departments.map((dept, idx) => {
              const isUnder = dept.status === 'Understaffed';
              const isOver = dept.status === 'Overstaffed';

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                    isUnder
                      ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300'
                      : isOver
                      ? 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-300'
                      : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  <div>
                    <div className="text-xs font-black text-foreground truncate max-w-[130px]">
                      {dept.departmentName}
                    </div>
                    <div className="text-[10px] font-semibold mt-0.5">
                      {dept.workingMembers + dept.wfhMembers} / {dept.totalMembers} active
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border shrink-0 ${
                    isUnder
                      ? 'bg-rose-600 text-white border-rose-700'
                      : isOver
                      ? 'bg-blue-600 text-white border-blue-700'
                      : 'bg-emerald-600 text-white border-emerald-700'
                  }`}>
                    {dept.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="p-3 rounded-2xl bg-card border border-border/60 flex items-center justify-between gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search roster by employee or shift..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs font-medium text-foreground outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-muted/30">
            <Filter className="h-3 w-3 text-muted-foreground" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {uniqueDepartments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Shift Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-muted/30">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer"
            >
              <option value="ALL">All Shifts</option>
              {shifts.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grouped Department Roster Lists */}
      {loading && !rosterData ? (
        <div className="py-20 text-center text-xs text-muted-foreground font-bold flex items-center justify-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
          <span>Loading department roster...</span>
        </div>
      ) : groupedRoster.length === 0 ? (
        <div className="py-16 text-center text-xs text-muted-foreground p-6 rounded-3xl bg-card border border-dashed border-border/70">
          No employees found matching the filters for this date.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedRoster.map((group) => (
            <div
              key={group.departmentName}
              className="rounded-3xl bg-card border border-border/60 shadow-xs overflow-hidden"
            >
              {/* Department Header */}
              <div className="p-4 bg-muted/20 border-b border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                    {group.departmentName}
                  </h4>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-muted text-muted-foreground">
                    {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>

              {/* Members Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-muted/10 border-b border-border/40 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      <th className="py-2.5 px-4">Employee</th>
                      <th className="py-2.5 px-4">Effective Shift</th>
                      <th className="py-2.5 px-4">Timings</th>
                      <th className="py-2.5 px-4 text-center">Schedule Status</th>
                      <th className="py-2.5 px-4 text-center">Type</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {group.members.map((m) => {
                      const isOverride = m.scheduleType === 'OVERRIDE';
                      const isSwap = m.scheduleType === 'SWAP';
                      const isPlanned = m.scheduleType === 'PLANNED';

                      return (
                        <tr key={m.userId} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-black text-foreground">{m.name}</div>
                            <div className="text-[10px] text-muted-foreground">{m.employeeId || m.email}</div>
                          </td>

                          <td className="py-3 px-4 font-bold text-foreground">
                            {m.shiftName}
                          </td>

                          <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {m.startTime} – {m.endTime}
                            <span className="text-[10px] text-muted-foreground ml-1">
                              ({format12Hour(m.startTime)})
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                              m.scheduleStatus === 'Working'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : m.scheduleStatus === 'WFH'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            }`}>
                              {m.scheduleStatus}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase font-mono ${
                              isOverride
                                ? 'bg-purple-500/15 text-purple-600 border border-purple-500/20'
                                : isSwap
                                ? 'bg-blue-500/15 text-blue-600 border border-blue-500/20'
                                : isPlanned
                                ? 'bg-teal-500/15 text-teal-600 border border-teal-500/20'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {m.scheduleType}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={onOpenOverride}
                                className="p-1 rounded-lg hover:bg-purple-500/10 text-purple-600 transition-all cursor-pointer"
                                title="Create Override"
                              >
                                <Zap className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={onOpenSwap}
                                className="p-1 rounded-lg hover:bg-blue-500/10 text-blue-600 transition-all cursor-pointer"
                                title="Swap Shift"
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DepartmentScheduleView;
