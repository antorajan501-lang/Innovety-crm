import React from 'react';
import { Users } from 'lucide-react';
import UserAvatar from '../common/UserAvatar';

const TeamRosterStatus = ({
  members = [],
  title = 'Team Roster & Status',
  className = ''
}) => {
  return (
    <div className={`rounded-3xl border border-border/70 bg-card p-6 shadow-sm space-y-4 text-left font-sans ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>

        <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          {members.length} Member{members.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Member List */}
      <div className="dash-scroll max-h-64 space-y-2.5 overflow-y-auto">
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 bg-muted/20 rounded-xl border border-dashed border-border/50 font-semibold">
            No team members assigned.
          </p>
        ) : (
          members.map((member) => {
            const isPresent = member.attStatus === 'PRESENT';

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-muted/20 text-xs transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserAvatar user={member} className="h-8 w-8 rounded-full shrink-0" />
                  <div className="min-w-0">
                    <span className="font-bold text-foreground block truncate">{member.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono block truncate">
                      {member.role || 'MEMBER'} • {member.memberTasksCount ?? 0} Active Task{member.memberTasksCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase shrink-0 border ${
                    isPresent
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : member.attStatus === 'WFH'
                      ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                      : member.attStatus === 'ON LEAVE'
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                  }`}
                >
                  {member.attStatus || 'ABSENT'}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TeamRosterStatus;
