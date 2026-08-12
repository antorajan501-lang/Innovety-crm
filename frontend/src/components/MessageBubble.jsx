import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import UserAvatar from './common/UserAvatar';
import AudioPlayer from './AudioPlayer';

const getRoleBadgeClass = (role) => {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30';
    case 'TEAM_LEADER':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30';
    case 'EMPLOYEE':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30';
    case 'INTERN':
    default:
      return 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30';
  }
};

const MessageBubble = ({ message, currentUser, showSenderHeader = true }) => {
  const isSelf = message.userId === currentUser?.id || message.user?.id === currentUser?.id;
  const isPending = message.status === 'PENDING';
  const isFailed = message.status === 'FAILED';

  const formattedTime = new Date(message.createdAt || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const isSystemAlert = message.type === 'SYSTEM' || message.text?.startsWith('Correction Needed:');

  if (isSystemAlert) {
    return (
      <div className="p-3 bg-red-500/10 border-l-4 border-red-500 rounded-r-2xl text-xs space-y-1 text-red-700 dark:text-red-300 shadow-xs max-w-[85%] my-1">
        <div className="flex items-center gap-1 font-bold">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span>System Alert</span>
        </div>
        <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>
        <div className="text-[9px] opacity-75 font-mono">
          {formattedTime}
        </div>
      </div>
    );
  }

  const isShortSingleLine =
    !message.audioUrl &&
    !message.text?.includes('\n') &&
    (message.text?.length || 0) <= 35;

  return (
    <div className={`flex gap-2.5 my-1.5 ${isSelf ? 'flex-row-reverse justify-start' : 'flex-row justify-start'}`}>
      {!isSelf && (
        <UserAvatar
          user={message.user}
          className="w-7 h-7 rounded-full border-2 border-white shadow-xs shrink-0 object-cover mt-1"
        />
      )}

      <div className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} max-w-[78%]`}>
        {/* Sender Name & Role Badge Header */}
        {showSenderHeader && (
          <div className={`flex items-center gap-1.5 text-[10px] mb-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
            <span className="font-bold text-foreground">{isSelf ? 'You' : message.user?.name || 'Member'}</span>
            {message.user?.role && (
              <span className={`px-1.5 py-0.2 rounded-full font-mono font-extrabold text-[8px] uppercase ${getRoleBadgeClass(message.user.role)}`}>
                {message.user.role}
              </span>
            )}
          </div>
        )}

        {/* Message Bubble Box */}
        <div
          className={`p-2.5 shadow-xs transition-all w-fit max-w-full ${
            isPending ? 'opacity-70' : 'opacity-100'
          } ${
            isSelf
              ? 'bg-emerald-600 dark:bg-emerald-700 text-white rounded-[18px] rounded-tr-xs'
              : 'bg-card border border-border/50 dark:bg-slate-900/70 text-foreground rounded-[18px] rounded-tl-xs'
          }`}
        >
          {message.audioUrl ? (
            <AudioPlayer audioUrl={message.audioUrl} className="my-0.5 min-w-[200px]" />
          ) : isShortSingleLine ? (
            /* Single-Line Compact Layout for Short Messages (e.g. "hi") */
            <div className="flex items-baseline gap-2.5 shrink-0 whitespace-nowrap">
              <span className="text-xs font-normal leading-tight">{message.text}</span>
              <span
                className={`text-[9px] font-mono select-none opacity-75 ${
                  isSelf ? 'text-emerald-100' : 'text-muted-foreground'
                }`}
              >
                {formattedTime}
              </span>
            </div>
          ) : (
            /* Standard Multi-Line Layout for Long Messages */
            <div className="space-y-1">
              <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
              <div
                className={`flex items-center gap-1 text-[9px] font-mono opacity-75 ${
                  isSelf ? 'justify-end text-emerald-100' : 'justify-start text-muted-foreground'
                }`}
              >
                {isPending && <Clock className="w-2.5 h-2.5 animate-spin" />}
                <span>{formattedTime}</span>
              </div>
            </div>
          )}
        </div>

        {isFailed && (
          <span className="text-[9px] text-red-500 font-bold mt-0.5">Failed to send</span>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
