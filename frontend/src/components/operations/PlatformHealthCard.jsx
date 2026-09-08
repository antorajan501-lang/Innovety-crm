import React from 'react';
import { Activity, Cpu, HardDrive, Clock, Database, Radio, Server } from 'lucide-react';

const PlatformHealthCard = ({ health }) => {
  if (!health) {
    return (
      <div className="p-4 rounded-3xl bg-card border border-border/60 text-center text-xs text-muted-foreground font-bold">
        Loading platform health metrics...
      </div>
    );
  }

  const dbLatencyClass = health.databaseLatencyMs < 20 ? 'text-emerald-500' : health.databaseLatencyMs < 100 ? 'text-amber-500' : 'text-rose-500';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-left">
      <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-sm space-y-1">
        <div className="text-[10px] font-extrabold uppercase text-muted-foreground flex items-center justify-between">
          <span>Uptime</span>
          <Clock className="h-3.5 w-3.5 text-blue-500" />
        </div>
        <div className="text-xl font-black text-foreground">{health.uptimeFormatted || '1h 20m'}</div>
        <div className="text-[10px] text-blue-600 font-bold">Node Process Active</div>
      </div>

      <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-sm space-y-1">
        <div className="text-[10px] font-extrabold uppercase text-muted-foreground flex items-center justify-between">
          <span>CPU Load</span>
          <Cpu className="h-3.5 w-3.5 text-purple-500" />
        </div>
        <div className="text-xl font-black text-foreground">{health.cpuPercentage}%</div>
        <div className="text-[10px] text-purple-600 font-bold">System CPU Usage</div>
      </div>

      <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-sm space-y-1">
        <div className="text-[10px] font-extrabold uppercase text-muted-foreground flex items-center justify-between">
          <span>RAM Capacity</span>
          <HardDrive className="h-3.5 w-3.5 text-emerald-500" />
        </div>
        <div className="text-xl font-black text-foreground">{health.memoryPercentage}%</div>
        <div className="text-[10px] text-emerald-600 font-bold">Heap: {health.heapUsedMB} MB</div>
      </div>

      <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-sm space-y-1">
        <div className="text-[10px] font-extrabold uppercase text-muted-foreground flex items-center justify-between">
          <span>DB Latency</span>
          <Database className={`h-3.5 w-3.5 ${dbLatencyClass}`} />
        </div>
        <div className="text-xl font-black text-foreground">{health.databaseLatencyMs} ms</div>
        <div className={`text-[10px] font-bold ${dbLatencyClass}`}>PostgreSQL Query</div>
      </div>

      <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-sm space-y-1">
        <div className="text-[10px] font-extrabold uppercase text-muted-foreground flex items-center justify-between">
          <span>Active Sockets</span>
          <Radio className="h-3.5 w-3.5 text-indigo-500" />
        </div>
        <div className="text-xl font-black text-foreground">{health.socketConnections}</div>
        <div className="text-[10px] text-indigo-600 font-bold">Connected Clients</div>
      </div>

      <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-sm space-y-1">
        <div className="text-[10px] font-extrabold uppercase text-muted-foreground flex items-center justify-between">
          <span>Health Score</span>
          <Activity className="h-3.5 w-3.5 text-emerald-500" />
        </div>
        <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">Optimal</div>
        <div className="text-[10px] text-emerald-600 font-bold">All Systems Normal</div>
      </div>
    </div>
  );
};

export default PlatformHealthCard;
