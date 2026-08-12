import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, ChevronUp } from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import api, { getSocket } from '../services/api';

const PAGE_SIZE = 50;

const TaskDiscussionPanel = ({ taskId, currentUser, initialComments = [], className = '' }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const scrollRef = useRef(null);

  // Sync initial comments when modal opens or taskId changes
  useEffect(() => {
    const formattedInitial = (initialComments || []).map(c => ({
      ...c,
      status: 'SENT'
    }));
    setComments(formattedInitial);
    setDisplayCount(PAGE_SIZE);
  }, [taskId, initialComments]);

  // Socket.IO real-time event listener for live comments
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !taskId) return;

    const handleCommentCreated = (newComment) => {
      if (!newComment || newComment.taskId !== taskId) return;
      setComments(prev => {
        const existingIdx = prev.findIndex(
          m => m.id === newComment.id || (m.tempId && m.userId === newComment.userId && m.text === newComment.text)
        );
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = { ...newComment, status: 'SENT' };
          return updated;
        }
        return [...prev, { ...newComment, status: 'SENT' }];
      });
      setTimeout(() => scrollToBottom(), 80);
    };

    socket.on('task_comment_created', handleCommentCreated);
    socket.on('taskMessage:new', handleCommentCreated);

    return () => {
      socket.off('task_comment_created', handleCommentCreated);
      socket.off('taskMessage:new', handleCommentCreated);
    };
  }, [taskId]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [comments.length]);

  const handleSendMessage = async ({ text, audioUrl }) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMsg = {
      id: tempId,
      tempId,
      taskId,
      userId: currentUser?.id,
      user: currentUser,
      text,
      audioUrl,
      type: audioUrl ? 'AUDIO' : 'TEXT',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    // 1. Add optimistic message locally
    setComments(prev => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom(), 50);

    try {
      setLoading(true);
      const res = await api.post(`/tasks/${taskId}/comment`, {
        text,
        audioUrl: audioUrl || null,
        type: audioUrl ? 'AUDIO' : 'TEXT'
      });

      const savedMessage = { ...res.data, status: 'SENT' };

      // 2. Replace PENDING message with saved SENT message
      setComments(prev =>
        prev.map(m =>
          (m.tempId === tempId || m.id === tempId) ? savedMessage : m
        )
      );
      setTimeout(() => scrollToBottom(), 50);
    } catch (err) {
      console.error('Failed to post comment:', err);
      setComments(prev =>
        prev.map(m =>
          (m.tempId === tempId || m.id === tempId) ? { ...m, status: 'FAILED' } : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const visibleComments = useMemo(() => {
    return comments.slice(-displayCount);
  }, [comments, displayCount]);

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + PAGE_SIZE);
  };

  // Group consecutive messages from the same sender within 5 minutes
  const groupedComments = useMemo(() => {
    const groups = [];
    visibleComments.forEach((c, idx) => {
      const prevC = visibleComments[idx - 1];
      const isSameSender = prevC && prevC.userId === c.userId && (new Date(c.createdAt) - new Date(prevC.createdAt) < 5 * 60 * 1000);
      if (isSameSender && groups.length > 0) {
        groups[groups.length - 1].messages.push(c);
      } else {
        groups.push({
          id: c.id || c.tempId,
          user: c.user,
          userId: c.userId,
          messages: [c]
        });
      }
    });
    return groups;
  }, [visibleComments]);

  return (
    <div className={`flex flex-col h-full bg-card border border-border/40 rounded-3xl shadow-xl overflow-hidden min-h-0 ${className}`}>
      {/* Discussion Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-600">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-extrabold text-foreground tracking-wide">Task Thread Discussion</h4>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full font-mono">
          {comments.length} messages
        </span>
      </div>

      {/* Messages Scroll Area (Internal Scroll Only) */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1.5 scrollbar-thin">
        {comments.length > displayCount && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={handleLoadMore}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-muted/60 hover:bg-muted text-xs font-bold text-muted-foreground transition-colors cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Load older messages</span>
            </button>
          </div>
        )}

        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-2 text-muted-foreground">
            <MessageSquare className="w-10 h-10 opacity-30" />
            <p className="text-xs font-semibold">No discussion messages yet.</p>
            <p className="text-[10px] max-w-xs">Start the thread by sending a message below.</p>
          </div>
        ) : (
          groupedComments.map(group => (
            <div key={group.id} className="space-y-1">
              {group.messages.map((msg, msgIdx) => (
                <MessageBubble
                  key={msg.id || msg.tempId}
                  message={msg}
                  currentUser={currentUser}
                  showSenderHeader={msgIdx === 0}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Sticky Bottom Message Composer */}
      <MessageComposer
        onSendMessage={handleSendMessage}
        loading={loading}
      />
    </div>
  );
};

export default TaskDiscussionPanel;
