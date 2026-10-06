import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { AlertCircle, Users, RefreshCw } from 'lucide-react';

const CATEGORIES_CONFIG = [
  { key: 'present', name: 'Present', color: '#10B981' },
  { key: 'late', name: 'Late', color: '#F59E0B' },
  { key: 'absent', name: 'Absent', color: '#EF4444' },
  { key: 'onLeave', name: 'On Leave', color: '#3B82F6' },
  { key: 'wfh', name: 'WFH', color: '#8B5CF6' },
  { key: 'holiday', name: 'Holiday', color: '#64748B' },
];

export default function TodayAttendanceCard({
  reportData,
  loading = false,
  error = false,
  onRetry,
  dateStr
}) {
  const formattedDate = useMemo(() => {
    const rawDate = dateStr || reportData?.targetDateStr;
    if (rawDate) {
      const parts = String(rawDate).trim().split('T')[0].split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        return new Date(y, m, d, 12, 0, 0).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      }
    }
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }, [dateStr, reportData?.targetDateStr]);

  const summary = useMemo(() => {
    if (reportData?.summary) {
      return reportData.summary;
    }

    const records = Array.isArray(reportData?.records) ? reportData.records : [];
    const counts = {
      present: 0,
      late: 0,
      absent: 0,
      onLeave: 0,
      wfh: 0,
      holiday: 0,
      total: records.length
    };

    records.forEach((r) => {
      if (r.loginStatus === 'Late' || r.attendance === 'Late') {
        counts.late++;
      } else if (r.attendance === 'Present' || r.loginStatus === 'On Time') {
        counts.present++;
      } else if (r.attendance === 'On Leave' || r.loginStatus === 'On Leave') {
        counts.onLeave++;
      } else if (r.attendance === 'WFH' || r.loginStatus === 'WFH') {
        counts.wfh++;
      } else if (r.attendance === 'Holiday' || r.loginStatus === 'Holiday') {
        counts.holiday++;
      } else {
        counts.absent++;
      }
    });

    return counts;
  }, [reportData]);

  const totalMembers = summary.total ?? (reportData?.recordsCount ?? 0);

  // 1. Loading State (clean skeleton without misleading zero values)
  if (loading) {
    return (
      <div className="clean-card text-left space-y-4">
        <div className="flex items-center justify-between pb-1">
          <div className="h-5 w-36 bg-muted/70 rounded-md animate-pulse" />
          <div className="h-5 w-14 bg-muted/60 rounded-full animate-pulse" />
        </div>

        <div className="relative h-44 w-full flex items-center justify-center my-2">
          <div className="h-32 w-32 rounded-full border-[14px] border-muted/50 dark:border-muted/30 animate-pulse flex items-center justify-center">
            <div className="h-5 w-8 bg-muted/70 rounded animate-pulse" />
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-border/40">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center justify-between py-1 px-1">
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-muted/70 animate-pulse" />
                <div className="h-3.5 w-16 bg-muted/60 rounded animate-pulse" />
              </div>
              <div className="h-3.5 w-6 bg-muted/70 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State (clean failure alert without crashing dashboard)
  if (error) {
    return (
      <div className="clean-card text-left space-y-4">
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-base font-bold text-foreground">Today's Attendance</h3>
          <span className="text-xs font-bold text-muted-foreground bg-muted/60 dark:bg-muted/30 px-2.5 py-1 rounded-full border border-border/40">
            {formattedDate}
          </span>
        </div>

        <div className="py-8 px-4 text-center rounded-2xl bg-rose-500/5 border border-dashed border-rose-500/20 my-2">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2 opacity-80" />
          <p className="text-sm font-bold text-foreground">Unable to load attendance</p>
          <p className="text-xs text-muted-foreground mt-1">
            Attendance data could not be retrieved at this time.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3. Empty State (no members or missing data)
  if (!totalMembers || totalMembers === 0) {
    return (
      <div className="clean-card text-left space-y-4">
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-base font-bold text-foreground">Today's Attendance</h3>
          <span className="text-xs font-bold text-muted-foreground bg-muted/60 dark:bg-muted/30 px-2.5 py-1 rounded-full border border-border/40">
            {formattedDate}
          </span>
        </div>

        <div className="py-8 px-4 text-center rounded-2xl bg-muted/20 border border-dashed border-border/60 my-2">
          <Users className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground">No attendance data available</p>
          <p className="text-xs text-muted-foreground mt-1">
            No active members recorded for this date.
          </p>
        </div>
      </div>
    );
  }

  // 4. Render Active Donut Chart + Legend
  const chartSlices = CATEGORIES_CONFIG
    .map((cat) => ({
      key: cat.key,
      name: cat.name,
      value: summary[cat.key] || 0,
      color: cat.color
    }))
    .filter((item) => item.value > 0);

  return (
    <div className="clean-card text-left space-y-4">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h3 className="text-base font-bold text-foreground">Today's Attendance</h3>
        </div>
        <span className="text-xs font-bold text-muted-foreground bg-muted/60 dark:bg-muted/30 px-2.5 py-1 rounded-full border border-border/40">
          {formattedDate}
        </span>
      </div>

      {/* Donut Chart with Centered Total */}
      <div className="relative h-44 w-full flex items-center justify-center my-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const dataPoint = payload[0].payload;
                  const percent = totalMembers > 0 ? Math.round((dataPoint.value / totalMembers) * 100) : 0;
                  return (
                    <div className="bg-[#0B1528] text-white px-3 py-2 rounded-xl shadow-2xl border border-slate-700/60 min-w-[110px] text-left pointer-events-none">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: dataPoint.color }}
                        />
                        <p className="text-[11px] font-semibold text-slate-300 font-sans">{dataPoint.name}</p>
                      </div>
                      <p className="text-base font-black text-white font-mono leading-none">
                        {dataPoint.value}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">({percent}%)</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Pie
              data={chartSlices}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={chartSlices.length > 1 ? 3 : 0}
              dataKey="value"
              nameKey="name"
              stroke="none"
              isAnimationActive={true}
            >
              {chartSlices.map((entry) => (
                <Cell key={`cell-${entry.key}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center of Donut Summary */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          <span className="text-2xl font-black text-foreground tracking-tight leading-none font-sans">
            {totalMembers}
          </span>
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1 font-sans">
            {totalMembers === 1 ? 'Member' : 'Members'}
          </span>
        </div>
      </div>

      {/* Compact Legend */}
      <div className="space-y-1 pt-2 border-t border-border/40">
        {CATEGORIES_CONFIG.map((cat) => {
          const count = summary[cat.key] || 0;
          return (
            <div
              key={cat.key}
              className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-muted/40 transition-colors text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="font-semibold text-foreground">{cat.name}</span>
              </div>
              <span className="font-mono font-bold text-foreground">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
