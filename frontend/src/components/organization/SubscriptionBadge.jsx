import React from 'react';
import { Award, Zap, Crown } from 'lucide-react';

const SubscriptionBadge = ({ plan }) => {
  const code = (plan?.code || 'STARTER').toUpperCase();

  if (code === 'ENTERPRISE') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
        <Crown className="h-3 w-3 text-purple-500" />
        <span>Enterprise</span>
      </span>
    );
  }

  if (code === 'GROWTH') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
        <Zap className="h-3 w-3 text-blue-500" />
        <span>Growth</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
      <Award className="h-3 w-3 text-emerald-500" />
      <span>Starter</span>
    </span>
  );
};

export default SubscriptionBadge;
