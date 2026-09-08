import React from 'react';
import { Users, FolderKanban, HardDrive, ShieldCheck, HeartPulse } from 'lucide-react';
import SubscriptionBadge from './SubscriptionBadge';
import StorageUsageBar from './StorageUsageBar';

const OrganizationUsageCard = ({ stats, company }) => {
  const plan = stats?.subscriptionPlan || company?.subscriptionPlan || { name: 'Starter', maxUsers: 25, maxProjects: 5, maxStorageGB: 5 };
  const userCount = stats?.users || 0;
  const maxUsers = plan.maxUsers || 25;
  const projectCount = stats?.projects || 0;
  const maxProjects = plan.maxProjects || 5;
  const usedMB = stats?.storageUsedMB || company?.storageUsedMB || 0;
  const maxStorageGB = plan.maxStorageGB || 5;

  const storagePercentage = (usedMB / (maxStorageGB * 1024)) * 100;
  const isHealthy = company?.status === 'ACTIVE' && storagePercentage < 90 && userCount <= maxUsers;

  return (
    <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className={`h-4 w-4 ${isHealthy ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Tenant Health</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isHealthy ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
            {isHealthy ? 'Healthy' : 'Needs Review'}
          </span>
          <SubscriptionBadge plan={plan} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
          <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5 mb-1">
            <Users className="h-3.5 w-3.5 text-blue-500" /> Users Quota
          </div>
          <div className="font-mono font-extrabold text-sm text-foreground">
            {userCount} / {maxUsers > 9999 ? 'Unlimited' : maxUsers}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
          <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5 mb-1">
            <FolderKanban className="h-3.5 w-3.5 text-purple-500" /> Projects Quota
          </div>
          <div className="font-mono font-extrabold text-sm text-foreground">
            {projectCount} / {maxProjects > 9999 ? 'Unlimited' : maxProjects}
          </div>
        </div>
      </div>

      <StorageUsageBar usedMB={usedMB} maxGB={maxStorageGB} />
    </div>
  );
};

export default OrganizationUsageCard;
