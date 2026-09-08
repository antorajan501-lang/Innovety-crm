import React from 'react';
import { HardDrive, AlertTriangle } from 'lucide-react';

const StorageUsageBar = ({ usedMB = 0, maxGB = 5 }) => {
  const maxMB = maxGB * 1024;
  const percentage = Math.min(100, Math.round((usedMB / maxMB) * 100));
  const isWarning = percentage >= 80;
  const isDanger = percentage >= 95;

  const barColor = isDanger ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between text-xs font-bold text-foreground">
        <span className="flex items-center gap-1 text-muted-foreground">
          <HardDrive className="h-3.5 w-3.5" /> Storage Usage
        </span>
        <span className="font-mono">
          {usedMB < 1024 ? `${usedMB} MB` : `${(usedMB / 1024).toFixed(1)} GB`} / {maxGB} GB ({percentage}%)
        </span>
      </div>

      <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden p-0.5 border border-border/40">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isWarning && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>Storage usage is high ({percentage}% capacity).</span>
        </div>
      )}
    </div>
  );
};

export default StorageUsageBar;
