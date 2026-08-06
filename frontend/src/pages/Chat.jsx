import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Users, Globe, Search, Send, Paperclip, Smile,
  Reply, Trash2, Edit3, Check, CheckCheck, FileText,
  Download, X, Sparkles, Building2, Info, Folder, Calendar, UserCheck, Lock, ExternalLink, Loader2,
  Play, Pause, Music, FileSpreadsheet, Package, Headphones, Copy, MoreVertical,
  Forward, CheckSquare, Save, Share2, Pin
} from 'lucide-react';
import api, { getSocket, downloadChatAttachment, getUploadUrl } from '../services/api';

import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/common/UserAvatar';

const EMOJI_LIST = ['😊', '👍', '🔥', '🎉', '❤️', '🙌', '🚀', '✅', '😂', '💡', '👏', '🎯', '💯', '🙏', '✨', '⚡'];

const SENDER_COLOR_PALETTE = [
  '#FFD600', // Bright Canary Yellow
  '#FF6D00', // Neon Tangerine Orange
  '#FF1744', // Hot Coral Pink
  '#00E5FF', // Electric Cyan
  '#D500F9', // Neon Purple Magenta
  '#FF9100', // Bright Deep Amber
  '#E040FB', // Electric Orchid Violet
  '#40C4FF', // High-Contrast Sky Blue
];

const getSenderNameColor = (sender) => {
  return '#40C4FF'; // Sky Blue
};

const getRoomTitleAndCode = (room) => {
  if (!room) return { title: '', code: null };
  const rawName = room.name || '';
  
  // Match "[PRJ-XXXX] Project Name"
  const match = rawName.match(/^\[(PRJ-[^\]]+)\]\s*(.*)$/i);
  if (match) {
    return {
      code: match[1].toUpperCase(),
      title: match[2].trim() || rawName
    };
  }

  const code = room.projectCode || room.project?.projectCode || room.task?.projectCode;
  if (code) {
    return {
      code: code.toUpperCase(),
      title: rawName
    };
  }

  return { title: rawName, code: null };
};

const isImageAttachment = (msg) => {
  if (!msg) return false;
  if (msg.messageType === 'IMAGE') return true;
  const url = (msg.attachmentUrl || msg.text || msg.message || '').toLowerCase();
  return (
    url.endsWith('.jpg') ||
    url.endsWith('.jpeg') ||
    url.endsWith('.png') ||
    url.endsWith('.gif') ||
    url.endsWith('.webp') ||
    url.endsWith('.svg')
  );
};

const isVideoAttachment = (msg) => {
  if (!msg) return false;
  if (msg.messageType === 'VIDEO') return true;
  const url = (msg.attachmentUrl || msg.text || msg.message || '').toLowerCase();
  return (
    url.endsWith('.mp4') ||
    url.endsWith('.webm') ||
    url.endsWith('.mov') ||
    url.endsWith('.avi') ||
    url.endsWith('.m4v') ||
    url.endsWith('.mkv') ||
    url.endsWith('.3gp')
  );
};

const isAudioAttachment = (msg) => {
  if (!msg) return false;
  if (msg.messageType === 'AUDIO') return true;
  const url = (msg.attachmentUrl || msg.text || msg.message || '').toLowerCase();
  return (
    url.endsWith('.mp3') ||
    url.endsWith('.wav') ||
    url.endsWith('.ogg') ||
    url.endsWith('.m4a') ||
    url.endsWith('.aac') ||
    url.endsWith('.flac')
  );
};

const getMessageCaption = (msg) => {
  if (!msg) return '';
  const text = (msg.message || msg.text || '').trim();
  if (!text) return '';
  const file = (msg.fileName || '').trim();
  if (file && text === file) return '';
  const lower = text.toLowerCase();
  if (
    lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') ||
    lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.svg') ||
    lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') ||
    lower.endsWith('.avi') || lower.endsWith('.pdf') || lower.endsWith('.zip') ||
    lower.endsWith('.docx') || lower.endsWith('.xlsx') || lower.endsWith('.mp3')
  ) {
    return '';
  }
  return text;
};

const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getCleanFileName = (msg) => {
  if (!msg) return 'File Attachment';
  let name = (msg.fileName || '').trim();

  // If missing or if it matches a 32-char raw random server hash (e.g. ef72718ba9d31cfb2a7f462411fc094d.pdf)
  if (!name || /^[a-f0-9]{32}\.[a-z0-9]+$/i.test(name)) {
    const card = getFriendlyFileTypeCard(msg);
    return card.title.replace(/^[^\s]+\s*/, '');
  }
  return name;
};

const getFriendlyFileTypeCard = (msg) => {
  const url = (msg.attachmentUrl || msg.text || msg.message || '').toLowerCase();
  if (url.endsWith('.pdf')) {
    return { title: '📄 PDF Document', icon: FileText, label: 'PDF Document' };
  }
  if (url.endsWith('.doc') || url.endsWith('.docx')) {
    return { title: '📝 Word Document', icon: FileText, label: 'Word Document' };
  }
  if (url.endsWith('.xls') || url.endsWith('.xlsx') || url.endsWith('.csv')) {
    return { title: '📊 Excel Spreadsheet', icon: FileSpreadsheet, label: 'Excel Spreadsheet' };
  }
  if (url.endsWith('.zip') || url.endsWith('.rar') || url.endsWith('.7z') || url.endsWith('.tar') || url.endsWith('.gz')) {
    return { title: '📦 ZIP File', icon: Package, label: 'Archive File' };
  }
  if (url.endsWith('.mp3') || url.endsWith('.wav') || url.endsWith('.ogg') || url.endsWith('.m4a')) {
    return { title: '🎵 Audio File', icon: Music, label: 'Audio File' };
  }
  return { title: '📎 Attachment', icon: Paperclip, label: 'Attachment' };
};

const getFriendlyLastMessagePreview = (lastMsg) => {
  if (!lastMsg) return '';
  if (lastMsg.isDeleted) return 'This message was deleted';

  if (isImageAttachment(lastMsg)) {
    const caption = getMessageCaption(lastMsg);
    return caption ? `🖼 ${caption}` : '🖼 Image';
  }

  if (isVideoAttachment(lastMsg)) {
    const caption = getMessageCaption(lastMsg);
    return caption ? `🎥 ${caption}` : '🎥 Video';
  }

  if (isAudioAttachment(lastMsg)) {
    return '🎧 Audio';
  }

  if (lastMsg.attachmentUrl) {
    const url = lastMsg.attachmentUrl.toLowerCase();
    if (url.endsWith('.pdf')) return '📄 PDF';
    if (url.endsWith('.doc') || url.endsWith('.docx')) return '📄 Document';
    if (url.endsWith('.xls') || url.endsWith('.xlsx') || url.endsWith('.csv')) return '📊 Spreadsheet';
    if (url.endsWith('.zip') || url.endsWith('.rar') || url.endsWith('.7z')) return '📦 ZIP File';
    return '📎 Attachment';
  }

  const rawText = lastMsg.text || lastMsg.message || '';
  const lower = rawText.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp')) {
    return '🖼 Image';
  }
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) {
    return '🎥 Video';
  }
  if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.m4a')) {
    return '🎧 Audio';
  }
  if (lower.endsWith('.pdf')) return '📄 PDF';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return '📄 Document';
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return '📊 Spreadsheet';
  if (lower.endsWith('.zip') || lower.endsWith('.rar')) return '📦 ZIP File';

  return rawText;
};

/* ─── WHATSAPP-STYLE AUDIO PLAYER COMPONENT ─── */
const AudioPlayer = ({ url }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-[180px] w-full max-w-full p-1 overflow-hidden">
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        preload="metadata"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/35 text-white flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-xs"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current text-white" />
          ) : (
            <Play className="h-5 w-5 fill-current ml-0.5 text-white" />
          )}
        </button>

        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
          />
          <div className="flex items-center justify-between text-[11px] font-semibold text-white/85 select-none px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Chat = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  // Core State
  const [currentUser, setCurrentUser] = useState(authUser || null);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Feature State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [lightboxMedia, setLightboxMedia] = useState(null);

  // Message Options Menu & Delete Confirmation State
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);
  const [deleteTargetMsg, setDeleteTargetMsg] = useState(null);
  const [deleteMode, setDeleteMode] = useState('EVERYONE'); // 'EVERYONE' or 'ME'
  const [deleting, setDeleting] = useState(false);

  // WhatsApp Desktop Context Menu & Action States
  const [contextMenu, setContextMenu] = useState(null); // { x, y, msg }
  const [toastMessage, setToastMessage] = useState(null);

  // Select Mode State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());

  // Forward Modal State
  const [forwardTargetMsg, setForwardTargetMsg] = useState(null); // single message or array
  const [selectedForwardRoomIds, setSelectedForwardRoomIds] = useState(new Set());
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwarding, setForwarding] = useState(false);

  // Group Info Drawer State
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [roomDetails, setRoomDetails] = useState(null);
  const [sharedFilesList, setSharedFilesList] = useState([]);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const touchTimerRef = useRef(null);
  const groupInfoRef = useRef(null);
  const infoBtnRef = useRef(null);

  // Auto-dismiss Group Information panel on outside click, Esc key, or switching rooms
  useEffect(() => {
    if (!showGroupInfo) return;

    const handlePointerDownOutside = (event) => {
      if (
        groupInfoRef.current &&
        !groupInfoRef.current.contains(event.target) &&
        infoBtnRef.current &&
        !infoBtnRef.current.contains(event.target)
      ) {
        setShowGroupInfo(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowGroupInfo(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [showGroupInfo]);

  // Close Group Info panel when switching rooms or navigating
  useEffect(() => {
    setShowGroupInfo(false);
  }, [activeRoom?.id, location.pathname]);

  // Handle click outside & keydown for context menu
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (e?.target?.closest('.msg-options-btn') || e?.target?.closest('.msg-context-menu')) {
        return;
      }
      setContextMenu(null);
      setActiveMenuMsgId(null);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setActiveMenuMsgId(null);
        if (isSelectMode) {
          setIsSelectMode(false);
          setSelectedMsgIds(new Set());
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSelectMode]);

  const showToast = (text) => {
    setToastMessage(text);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Message Action Menu Trigger (Exclusively via Three-Dot Button)
  const openMessageMenu = (e, msg) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    if (!msg) return;

    let clientX = e?.clientX;
    let clientY = e?.clientY;

    // Calculate position from target element when position is missing (e.g. three-dot button click)
    if ((clientX === undefined || clientY === undefined || (clientX === 0 && clientY === 0)) && e?.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      clientX = rect.left;
      clientY = rect.bottom + 4;
    }

    const mouseX = clientX !== undefined && clientX !== 0 ? clientX : (window.innerWidth / 2);
    const mouseY = clientY !== undefined && clientY !== 0 ? clientY : (window.innerHeight / 2);

    const menuWidth = 200;
    const menuHeight = 280;

    const posX = mouseX + menuWidth > window.innerWidth ? Math.max(10, mouseX - menuWidth) : mouseX;
    const posY = mouseY + menuHeight > window.innerHeight ? Math.max(10, mouseY - menuHeight) : mouseY;

    setContextMenu({ x: posX, y: posY, msg });
  };

  const handleTogglePinAction = async (msg) => {
    if (!msg) return;
    try {
      const res = await api.put(`/chat/messages/${msg.id}/pin`);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isPinned: res.data.isPinned } : m));
      showToast(res.data.isPinned ? 'Message pinned' : 'Message unpinned');
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      showToast(err.response?.data?.message || 'Failed to pin message');
    }
  };

  const handleTouchStartTrigger = (e, msg) => {
    if (!msg) return;
    touchTimerRef.current = setTimeout(() => {
      const touch = e.touches[0];
      if (touch) {
        const menuWidth = 220;
        const menuHeight = 280;
        const posX = touch.clientX + menuWidth > window.innerWidth ? touch.clientX - menuWidth : touch.clientX;
        const posY = touch.clientY + menuHeight > window.innerHeight ? touch.clientY - menuHeight : touch.clientY;
        setContextMenu({ x: posX, y: posY, msg });
      }
    }, 500);
  };

  const handleTouchEndTrigger = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
  };

  const handleCopyAction = (msg) => {
    if (!msg) return;
    let contentToCopy = msg.message || '';
    if (msg.attachmentUrl) {
      contentToCopy = `${api.defaults.baseURL.replace('/api', '')}${msg.attachmentUrl}`;
    }
    navigator.clipboard.writeText(contentToCopy);
    showToast('Copied to clipboard');
  };

  const handleSaveAsAction = async (msg) => {
    if (!msg || (!msg.attachmentUrl && !msg.id)) return;
    try {
      showToast('Downloading file...');
      await downloadChatAttachment(msg);
      showToast('Download completed!');
    } catch (err) {
      console.error('Save As action failed:', err);
      showToast('Download failed');
    }
  };

  const handleShareAction = (msg) => {
    if (!msg) return;
    const shareUrl = msg.attachmentUrl
      ? `${api.defaults.baseURL.replace('/api', '')}${msg.attachmentUrl}`
      : window.location.href;
    const titleText = getCleanFileName(msg) || 'Shared Message';

    if (navigator.share) {
      navigator.share({
        title: titleText,
        text: msg.message || titleText,
        url: shareUrl
      }).catch(() => { });
    } else {
      navigator.clipboard.writeText(shareUrl);
      showToast('Share link copied!');
    }
  };

  const toggleSelectMessage = (msgId) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const handleForwardSelected = () => {
    const selectedMsgs = messages.filter(m => selectedMsgIds.has(m.id));
    if (selectedMsgs.length === 0) return;
    setForwardTargetMsg(selectedMsgs);
    setSelectedForwardRoomIds(new Set());
  };

  const handleDeleteSelected = () => {
    const selectedMsgs = messages.filter(m => selectedMsgIds.has(m.id));
    if (selectedMsgs.length === 0) return;
    setDeleteTargetMsg(selectedMsgs[0]);
    setDeleteMode(selectedMsgs[0].senderId === currentUser?.id ? 'EVERYONE' : 'ME');
  };

  const handleExecuteForward = async () => {
    if (!forwardTargetMsg || selectedForwardRoomIds.size === 0) return;
    setForwarding(true);
    try {
      const messagesToForward = Array.isArray(forwardTargetMsg) ? forwardTargetMsg : [forwardTargetMsg];

      for (const roomId of Array.from(selectedForwardRoomIds)) {
        for (const msgItem of messagesToForward) {
          const res = await api.post('/chat/messages', {
            roomId,
            message: msgItem.message || '',
            attachmentUrl: msgItem.attachmentUrl || null,
            fileName: msgItem.fileName || null,
            fileSize: msgItem.fileSize || null,
            messageType: msgItem.messageType || 'TEXT'
          });

          const socket = getSocket();
          if (socket) {
            socket.emit('send_chat_message', res.data);
          }
        }
      }

      fetchRooms();
      showToast(messagesToForward.length > 1 ? 'Messages forwarded!' : 'Message forwarded!');
      setForwardTargetMsg(null);
      setSelectedForwardRoomIds(new Set());
      if (isSelectMode) {
        setIsSelectMode(false);
        setSelectedMsgIds(new Set());
      }
    } catch (err) {
      console.error('Failed to forward message:', err);
    } finally {
      setForwarding(false);
    }
  };

  // Load current user profile
  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);
    } else {
      const fetchProfile = async () => {
        try {
          const userRes = await api.get('/auth/profile');
          setCurrentUser(userRes.data);
        } catch (err) {
          console.error('Failed to load user profile in chat:', err);
        }
      };
      fetchProfile();
    }
  }, [authUser]);

  // Socket.io initialization & real-time listeners
  useEffect(() => {
    if (!currentUser) return;

    const socket = getSocket();
    if (!socket) return;

    socket.emit('register', {
      userId: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
      teamId: currentUser.teamMembers?.[0]?.teamId
    });

    socket.on('online_users', (usersList) => {
      setOnlineUserIds(new Set(usersList.map(u => u.id)));
    });

    socket.on('receive_chat_message', (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        if (msg.roomId === activeRoom?.id) {
          return [...prev, msg];
        }
        return prev;
      });
      fetchRooms();
    });

    socket.on('user_typing', ({ roomId, userId, userName }) => {
      if (activeRoom && roomId === activeRoom.id && userId !== currentUser.id) {
        setTypingUsers(prev => new Map(prev.set(userId, userName)));
      }
    });

    socket.on('user_stop_typing', ({ roomId, userId }) => {
      if (activeRoom && roomId === activeRoom.id) {
        setTypingUsers(prev => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
      }
    });

    socket.on('message_edited', (updatedMsg) => {
      setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
    });

    socket.on('message_deleted', (deletedMsg) => {
      if (deletedMsg.deleteMode === 'PERMANENT_EVERYONE' || deletedMsg.isPermanentlyDeleted) {
        setMessages(prev => prev.filter(m => m.id !== deletedMsg.id));
      } else if (deletedMsg.deleteMode === 'PERMANENT_ME' || deletedMsg.deleteMode === 'ME') {
        if (deletedMsg.userId === currentUser?.id) {
          setMessages(prev => prev.filter(m => m.id !== deletedMsg.id));
        }
      } else {
        setMessages(prev => prev.map(m => m.id === deletedMsg.id ? {
          ...m,
          isDeleted: true,
          message: 'This message was deleted',
          attachmentUrl: null,
          fileName: null,
          fileSize: null
        } : m));
      }
      fetchRooms();
    });

    socket.on('chat_rooms_updated', () => {
      fetchRooms();
    });

    return () => {
      socket.off('online_users');
      socket.off('receive_chat_message');
      socket.off('chat_rooms_updated');
      socket.off('user_typing');
      socket.off('user_stop_typing');
      socket.off('message_edited');
      socket.off('message_deleted');
    };
  }, [currentUser, activeRoom]);

  const handleDeleteMessage = async () => {
    if (!deleteTargetMsg) return;
    setDeleting(true);
    try {
      const isSender = deleteTargetMsg.senderId === currentUser?.id || currentUser?.role === 'ADMIN';
      const isPlaceholder = deleteTargetMsg.isDeleted;

      let chosenMode = deleteMode;
      if (isPlaceholder) {
        chosenMode = isSender ? deleteMode : 'PERMANENT_ME';
      } else {
        chosenMode = isSender ? deleteMode : 'ME';
      }

      await api.delete(`/chat/messages/${deleteTargetMsg.id}`, {
        data: { deleteMode: chosenMode }
      });

      const socket = getSocket();
      if (socket) {
        socket.emit('message_deleted', {
          id: deleteTargetMsg.id,
          roomId: activeRoom?.id,
          deleteMode: chosenMode,
          userId: currentUser?.id,
          isDeleted: chosenMode === 'EVERYONE',
          isPermanentlyDeleted: chosenMode.startsWith('PERMANENT')
        });
      }

      if (chosenMode === 'ME' || chosenMode.startsWith('PERMANENT')) {
        setMessages(prev => prev.filter(m => m.id !== deleteTargetMsg.id));
      } else {
        setMessages(prev => prev.map(m => m.id === deleteTargetMsg.id ? {
          ...m,
          isDeleted: true,
          message: 'This message was deleted',
          attachmentUrl: null,
          fileName: null,
          fileSize: null
        } : m));
      }

      fetchRooms();
      showToast(chosenMode.startsWith('PERMANENT') ? 'Message permanently deleted' : 'Message deleted');
      setDeleteTargetMsg(null);
      setActiveMenuMsgId(null);
    } catch (err) {
      console.error('Failed to delete message:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Fetch unified WhatsApp-style chat list (Company Room ALWAYS #1)
  const fetchRooms = async () => {
    try {
      const res = await api.get('/chat/rooms');
      const allRooms = res.data || [];
      setRooms(allRooms);

      const params = new URLSearchParams(location.search);
      const targetDmUserId = params.get('dm');
      const targetRoomId = params.get('room');

      if (targetDmUserId) {
        const dmRes = await api.post('/chat/rooms/direct', { targetUserId: targetDmUserId });
        setActiveRoom(dmRes.data);
      } else if (targetRoomId) {
        const found = allRooms.find(r => r.id === targetRoomId);
        if (found) setActiveRoom(found);
      } else if (allRooms.length > 0 && !activeRoom) {
        setActiveRoom(allRooms[0]);
      }
    } catch (err) {
      console.error('Failed to fetch chat rooms:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchRooms();
    }
  }, [currentUser, location.search]);

  // Fetch messages when activeRoom changes
  useEffect(() => {
    if (!activeRoom) return;

    if (!activeRoom.isVirtual && !activeRoom.id.startsWith('virtual_')) {
      const socket = getSocket();
      if (socket) {
        socket.emit('join_chat_room', activeRoom.id);
      }

      const fetchMessages = async () => {
        setMessagesLoading(true);
        try {
          const res = await api.get(`/chat/rooms/${activeRoom.id}/messages`);
          setMessages(res.data.messages || []);
          if (res.data.room) {
            setRoomDetails(res.data.room);
            setSharedFilesList(res.data.room.sharedFiles || []);
          }
          await api.post(`/chat/rooms/${activeRoom.id}/read`);
          setRooms(prev => prev.map(r => r.id === activeRoom.id ? { ...r, unreadCount: 0 } : r));
        } catch (err) {
          console.error('Failed to load room messages:', err);
        } finally {
          setMessagesLoading(false);
        }
      };
      fetchMessages();
    } else {
      setMessages([]);
      setRoomDetails(null);
      setSharedFilesList([]);
    }

    setReplyingTo(null);
    setEditingMsg(null);
    setTypingUsers(new Map());

    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);

    return () => {
      const socket = getSocket();
      if (socket && activeRoom?.id && !activeRoom.isVirtual && !activeRoom.id.startsWith('virtual_')) {
        socket.emit('leave_chat_room', activeRoom.id);
      }
    };
  }, [activeRoom]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle room selection (transparently creates DM if virtual)
  const handleSelectRoomItem = async (roomItem) => {
    if (roomItem.isVirtual || (roomItem.id && roomItem.id.startsWith('virtual_'))) {
      try {
        const res = await api.post('/chat/rooms/direct', { targetUserId: roomItem.targetUserId || roomItem.otherUser?.id });
        setActiveRoom(res.data);
        fetchRooms();
      } catch (err) {
        console.error('Failed to open direct conversation:', err);
      }
    } else {
      setActiveRoom(roomItem);
    }
  };

  // Handle typing indicator
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (!activeRoom || !currentUser || activeRoom.isVirtual || activeRoom.id.startsWith('virtual_')) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('typing', { roomId: activeRoom.id, userId: currentUser.id, userName: currentUser.name });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { roomId: activeRoom.id, userId: currentUser.id });
    }, 2000);
  };

  // Send or update message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !activeRoom) return;

    const content = inputText.trim();
    setInputText('');
    setShowEmojiPicker(false);

    let currentRoom = activeRoom;

    if (currentRoom.isVirtual || currentRoom.id.startsWith('virtual_')) {
      try {
        const createRes = await api.post('/chat/rooms/direct', { targetUserId: currentRoom.targetUserId || currentRoom.otherUser?.id });
        currentRoom = createRes.data;
        setActiveRoom(currentRoom);
      } catch (err) {
        console.error('Failed to provision direct chat room:', err);
        return;
      }
    }

    const socket = getSocket();
    if (socket) {
      socket.emit('stop_typing', { roomId: currentRoom.id, userId: currentUser.id });
    }

    try {
      if (editingMsg) {
        const res = await api.put(`/chat/messages/${editingMsg.id}`, { message: content });
        setMessages(prev => prev.map(m => m.id === editingMsg.id ? res.data : m));
        if (socket) {
          socket.emit('message_edited', res.data);
        }
        setEditingMsg(null);
      } else {
        const res = await api.post('/chat/messages', {
          roomId: currentRoom.id,
          message: content,
          replyToMessageId: replyingTo?.id || null
        });

        setMessages(prev => [...prev, res.data]);
        setReplyingTo(null);

        if (socket) {
          socket.emit('send_chat_message', res.data);
        }
      }
      fetchRooms();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // File Attachment Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoom) return;

    let currentRoom = activeRoom;

    if (currentRoom.isVirtual || currentRoom.id.startsWith('virtual_')) {
      try {
        const createRes = await api.post('/chat/rooms/direct', { targetUserId: currentRoom.targetUserId || currentRoom.otherUser?.id });
        currentRoom = createRes.data;
        setActiveRoom(currentRoom);
      } catch (err) {
        console.error('Failed to provision direct chat room for file upload:', err);
        return;
      }
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await api.post('/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { attachmentUrl, fileName, fileSize, messageType } = uploadRes.data;

      const res = await api.post('/chat/messages', {
        roomId: currentRoom.id,
        message: fileName,
        messageType,
        attachmentUrl,
        fileName,
        fileSize,
        replyToMessageId: replyingTo?.id || null
      });

      setMessages(prev => [...prev, res.data]);
      setReplyingTo(null);

      const socket = getSocket();
      if (socket) {
        socket.emit('send_chat_message', res.data);
      }
      fetchRooms();
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };



  // Filtered rooms list matching Search Query (Company group ALWAYS stays at top index 0)
  const filteredRooms = rooms.filter(r => {
    if (r.type === 'COMPANY') return true; // Always display Company Group
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchName = r.name?.toLowerCase().includes(q);
    const matchUser = r.otherUser?.name?.toLowerCase().includes(q);
    const matchMsg = r.lastMessage?.text?.toLowerCase().includes(q);
    return matchName || matchUser || matchMsg;
  });

  return (
    <div className="h-[calc(100svh-7.5rem)] max-w-[1600px] w-full mx-auto flex flex-col font-sans select-none animate-in fade-in duration-300">

      {/* 2-COLUMN WHATSAPP-STYLE CONTAINER */}
      <div className="flex-1 flex bg-card dark:bg-slate-900 border border-border/80 rounded-3xl shadow-xl overflow-hidden">

        {/* ─── LEFT PANEL: UNIFIED WHATSAPP CHAT LIST & SEARCH ─────────────────────── */}
        <div className="w-80 sm:w-96 border-r border-border/80 flex flex-col bg-card dark:bg-slate-900/60 shrink-0">

          {/* Top Search Header */}
          <div className="p-4 border-b border-border/80 space-y-3 bg-card dark:bg-slate-900">
            <div className="flex items-center gap-2 text-foreground font-black text-lg tracking-tight">
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="text-[18px] font-extrabold">Chat</span>
            </div>

            {/* Single WhatsApp Unified Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-[18px] w-[18px] text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users, teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background/80 dark:bg-slate-950/60 border border-border/70 rounded-full pl-10 pr-8 py-2.5 text-[16px] font-medium text-foreground placeholder:text-[16px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Unified Conversation List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-none bg-card dark:bg-slate-900/60">
            {filteredRooms
              .filter(r => r.type !== 'TEAM')
              .map((r, index, arr) => {
                const isActive = activeRoom && (
                  activeRoom.id === r.id ||
                  (activeRoom.isVirtual && r.isVirtual && activeRoom.targetUserId === r.targetUserId)
                );
                const isOnline = r.type === 'DIRECT' && r.otherUser && onlineUserIds.has(r.otherUser.id);
                const isCompany = r.type === 'COMPANY';
                const showPersonalHeader = index > 0 && r.type === 'DIRECT' && arr[index - 1]?.type !== 'DIRECT';

                return (
                  <React.Fragment key={r.id}>
                    {showPersonalHeader && (
                      <div className="mt-3 mb-1 px-3 flex items-center gap-2 text-[11px] font-black uppercase text-primary tracking-wider">
                        <span>👤 Personal Chats</span>
                        <div className="flex-1 h-px bg-primary/10" />
                      </div>
                    )}

                    <div
                      onClick={() => handleSelectRoomItem(r)}
                      className={`flex items-center gap-2.5 px-3 h-[64px] rounded-[16px] cursor-pointer transition-all relative group ${isActive
                          ? 'bg-primary text-white shadow-md shadow-primary/20'
                          : isCompany
                            ? 'bg-primary/5 border border-primary/20 text-foreground hover:bg-primary/10'
                            : 'hover:bg-muted/50 text-foreground'
                        }`}
                    >
                      {/* Avatar / Group Icon (40px) */}
                      <div className="relative shrink-0">
                        {isCompany ? (
                          <div className={`h-[40px] w-[40px] rounded-xl flex items-center justify-center font-bold shadow-sm ${isActive ? 'bg-white/20 text-white' : 'bg-primary text-white'
                            }`}>
                            <Globe className="h-5 w-5" />
                          </div>
                        ) : r.type === 'PROJECT' ? (
                          <div className={`h-[40px] w-[40px] rounded-xl flex items-center justify-center font-bold shadow-xs ${isActive ? 'bg-white/20 text-white' : 'bg-primary/15 text-primary'
                            }`}>
                            <Users className="h-5 w-5" />
                          </div>
                        ) : (
                          <UserAvatar
                            user={r.otherUser}
                            src={r.displayPic}
                            name={r.name}
                            className="h-[40px] w-[40px] rounded-xl overflow-hidden shadow-xs"
                          />
                        )}

                        {/* Online Status Dot for Direct Users */}
                        {r.type === 'DIRECT' && (
                          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 ${isActive ? 'border-primary' : 'border-background'} ${isOnline ? 'bg-primary' : 'bg-slate-400'}`} />
                        )}
                      </div>

                      {/* Room Name, Badge, Preview & Timestamp */}
                      <div className="flex-1 truncate text-left min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          {(() => {
                            const { title, code } = getRoomTitleAndCode(r);
                            return (
                              <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
                                <span className={`text-[15px] font-bold truncate ${isActive ? 'text-white' : 'text-foreground'}`}>
                                  {title}
                                </span>

                                {code && (
                                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border shrink-0 ${isActive
                                      ? 'bg-white/20 text-white border-white/30'
                                      : 'bg-primary/10 text-primary border-primary/20'
                                    }`}>
                                    {code}
                                  </span>
                                )}

                                {isCompany && (
                                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-primary text-white'
                                    }`}>
                                    Official
                                  </span>
                                )}

                                {r.type === 'DIRECT' && r.otherUser?.role && (
                                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border shrink-0 ${isActive ? 'bg-white/20 text-white border-white/30' : 'bg-primary/10 text-primary border-primary/20'
                                    }`}>
                                    {r.otherUser.role === 'ADMIN' ? 'Admin' : r.otherUser.role === 'TEAM_LEADER' ? 'Team Leader' : r.otherUser.role}
                                  </span>
                                )}
                              </div>
                            );
                          })()}

                          {r.lastMessage && (
                            <span className={`text-[11px] font-medium shrink-0 ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                              {new Date(r.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <p className={`text-[13px] truncate font-medium ${isActive ? 'text-white/90' : 'text-muted-foreground'}`}>
                            {r.lastMessage ? (
                              getFriendlyLastMessagePreview(r.lastMessage)
                            ) : isCompany ? (
                              <span className="italic opacity-90 font-semibold">Company Announcement & Discussion</span>
                            ) : r.type === 'PROJECT' ? (
                              <span className="italic opacity-80">Project Chat Group</span>
                            ) : (
                              <span className="italic opacity-80">No messages yet</span>
                            )}
                          </p>

                          {r.unreadCount > 0 && (
                            <span className={`shrink-0 px-1.5 py-0.2 min-w-[18px] h-4.5 rounded-full text-[10px] font-black flex items-center justify-center shadow-xs transition-all ${isActive
                                ? 'bg-white text-primary'
                                : 'bg-primary text-white shadow-sm shadow-primary/30'
                              }`}>
                              {r.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
          </div>
        </div>

        {/* ─── RIGHT PANEL: ACTIVE CHAT CONVERSATION WINDOW ───────────────── */}
        <div className="flex-1 flex flex-col bg-card dark:bg-slate-900 min-w-0 relative transition-all duration-200 ease-in-out overflow-hidden">
          {isSelectMode && (
            <div className="absolute top-0 left-0 right-0 z-30 bg-slate-900/95 border-b border-white/15 backdrop-blur-2xl px-6 py-3 flex items-center justify-between shadow-xl text-white animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setIsSelectMode(false); setSelectedMsgIds(new Set()); }}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
                  title="Cancel selection"
                >
                  <X className="h-5 w-5" />
                </button>
                <span className="font-bold text-[15px] text-white">
                  {selectedMsgIds.size} Selected
                </span>
              </div>

              <div className="flex items-center gap-3">
                {selectedMsgIds.size > 0 && (
                  <>
                    <button
                      onClick={handleForwardSelected}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[13px] font-semibold transition-all"
                    >
                      <Forward className="h-4 w-4" />
                      Forward ({selectedMsgIds.size})
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white text-[13px] font-bold transition-all shadow-md shadow-red-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete ({selectedMsgIds.size})
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {activeRoom ? (
            <>
              {/* Compact Header (py-2.5 px-4) */}
              <div className="py-2.5 px-4 border-b border-border/80 bg-card dark:bg-slate-900 flex items-center justify-between shrink-0 z-10">
                <div
                  ref={infoBtnRef}
                  onClick={() => setShowGroupInfo(prev => !prev)}
                  className="flex items-center gap-2.5 cursor-pointer group truncate"
                >
                  <div className="relative shrink-0">
                    {activeRoom.type === 'COMPANY' ? (
                      <div className="h-[42px] w-[42px] rounded-xl bg-primary text-white font-bold flex items-center justify-center shadow-md">
                        <Globe className="h-5 w-5" />
                      </div>
                    ) : activeRoom.type === 'PROJECT' ? (
                      <div className="h-[42px] w-[42px] rounded-xl bg-primary/15 text-primary font-bold flex items-center justify-center shadow-xs">
                        <Users className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="h-[42px] w-[42px] rounded-xl bg-primary text-white font-bold flex items-center justify-center text-sm overflow-hidden shadow-xs">
                        {activeRoom.displayPic ? (
                          <img src={getUploadUrl(activeRoom.displayPic)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          activeRoom.name?.charAt(0) || 'U'
                        )}
                      </div>
                    )}

                    {activeRoom.type === 'DIRECT' && (
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${onlineUserIds.has(activeRoom.otherUser?.id || roomDetails?.otherUser?.id) ? 'bg-primary' : 'bg-slate-400'}`} />
                    )}
                  </div>

                  <div className="truncate text-left flex-1 min-w-0">
                    {(() => {
                      const { title, code } = getRoomTitleAndCode(activeRoom);
                      return (
                        <div className="flex items-center gap-1.5 truncate">
                          <h3 className="text-[16px] font-bold text-foreground group-hover:text-primary transition-colors truncate leading-tight">
                            {title}
                          </h3>

                          {code && (
                            <span className="text-[9px] font-black uppercase bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded shrink-0">
                              {code}
                            </span>
                          )}

                          {activeRoom.type === 'COMPANY' && (
                            <span className="text-[9px] font-black uppercase bg-primary text-white px-1.5 py-0.2 rounded shrink-0">
                              Official
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    <p className="text-[12px] text-muted-foreground font-medium truncate mt-0.5">
                      {activeRoom.type === 'COMPANY' ? (
                        'Company Discussion'
                      ) : activeRoom.type === 'PROJECT' ? (
                        `Project Chat Group • ${roomDetails?.members?.length || activeRoom.members?.length || 0} members`
                      ) : (
                        onlineUserIds.has(activeRoom.otherUser?.id || roomDetails?.otherUser?.id) ? (
                          <span className="text-primary font-bold flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                            Online
                          </span>
                        ) : (
                          'Offline'
                        )
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowGroupInfo(!showGroupInfo)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Info className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-none bg-background">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
                    <MessageSquare className="h-12 w-12 text-primary" />
                    <p className="text-base font-bold">No messages yet</p>
                    <p className="text-xs text-muted-foreground">Send a message to start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg, index, arr) => {
                    const isOwn = msg.sender?.id === currentUser?.id || msg.sender?._id === currentUser?.id;
                    const prevMsg = arr[index - 1];
                    const isDifferentSender = !prevMsg || prevMsg.sender?.id !== msg.sender?.id;
                    const showDateHeader = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

                    const formatDateBadge = (dateStr) => {
                      const msgDate = new Date(dateStr);
                      const today = new Date();
                      const yesterday = new Date();
                      yesterday.setDate(today.getDate() - 1);

                      if (msgDate.toDateString() === today.toDateString()) return 'Today';
                      if (msgDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
                      return msgDate.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
                    };

                    const isEmojiOnly = (text) => {
                      if (!text) return false;
                      const trimmed = text.trim();
                      if (!trimmed) return false;
                      const cleanText = trimmed
                        .replace(/[\u2000-\u3300\u2600-\u27B0\u2700-\u27BF\uFE00-\uFE0F\uD83C-\uD83E][\uDC00-\uDFFF]?/g, '')
                        .replace(/[\u200D\uFE0F\u00A9\u00AE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9-\u21AA\u231A-\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA-\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u27BF\u2934-\u2935\u2B05-\u2B07\u2B1B-\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]/g, '')
                        .trim();
                      return cleanText.length === 0;
                    };

                    const getEmojiCount = (text) => {
                      if (!text) return 1;
                      const matches = text.trim().match(/[\u2000-\u3300\u2600-\u27B0\u2700-\u27BF\uFE00-\uFE0F\uD83C-\uD83E][\uDC00-\uDFFF]?/g);
                      return matches ? matches.length : 1;
                    };

                    const isEmojiMsg = !msg.isDeleted && !msg.replyTo && !msg.attachmentUrl && isEmojiOnly(msg.message);
                    const isImg = isImageAttachment(msg);
                    const isVid = isVideoAttachment(msg);
                    const isAudio = isAudioAttachment(msg);
                    const captionText = getMessageCaption(msg);
                    const fileCard = getFriendlyFileTypeCard(msg);

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateHeader && (
                          <div className="flex justify-center my-5">
                            <span className="bg-white/90 dark:bg-slate-800/90 text-[#64748B] dark:text-slate-300 text-[13px] font-semibold px-[14px] py-[6px] rounded-full shadow-xs border border-[#DCEFE8] dark:border-slate-700 backdrop-blur-md select-none">
                              {formatDateBadge(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        <motion.div
                          layout
                          initial={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95, height: 0, marginTop: 0 }}
                          transition={{ duration: 0.18 }}
                          className={`flex gap-2 items-start text-left px-4 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${isDifferentSender ? 'mt-4' : 'mt-2'}`}
                        >
                          {!isOwn && (
                            <UserAvatar
                              user={msg.sender}
                              className="h-10 w-10 rounded-2xl shrink-0 mt-0.5 shadow-xs"
                            />
                          )}

                          {isSelectMode && !msg.isDeleted && (
                            <div className="flex items-center shrink-0 self-center px-1">
                              <input
                                type="checkbox"
                                checked={selectedMsgIds.has(msg.id)}
                                onChange={() => toggleSelectMessage(msg.id)}
                                className="accent-primary h-5 w-5 rounded-md cursor-pointer"
                              />
                            </div>
                          )}

                          <div className={`max-w-[88%] sm:max-w-[80%] md:max-w-[75%] min-w-0 w-fit ${isOwn ? 'ml-auto' : 'mr-auto'}`}>
                            {isEmojiMsg ? (
                              /* ─── UNIFORM DYNAMIC THEME EMOJI MESSAGE BUBBLE ─── */
                              <div
                                onContextMenu={(e) => openMessageMenu(e, msg)}
                                onTouchStart={(e) => handleTouchStartTrigger(e, msg)}
                                onTouchEnd={handleTouchEndTrigger}
                                className={`group/msg relative inline-flex flex-col p-[10px_12px_8px_12px] rounded-[22px] transition-all duration-200 hover:-translate-y-[1px] bg-primary text-white shadow-md shadow-primary/20 ${isOwn ? 'rounded-br-[4px] ml-auto' : 'rounded-bl-[4px] mr-auto'
                                  }`}
                                style={{ width: 'fit-content', height: 'fit-content', maxWidth: '100%' }}
                              >
                                {!msg.isDeleted && (
                                  <div className="absolute top-2 right-2.5 opacity-0 group-hover/msg:opacity-100 transition-opacity z-20">
                                    <button
                                      type="button"
                                      onClick={(e) => openMessageMenu(e, msg)}
                                      className="msg-options-btn p-1 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all shadow-xs cursor-pointer"
                                      title="Message options"
                                    >
                                      <MoreVertical className="h-3.5 w-3.5 text-white pointer-events-none" />
                                    </button>
                                  </div>
                                )}

                                {!isOwn && activeRoom.type !== 'DIRECT' && (
                                  <p
                                    className="text-[15px] font-bold mb-[6px] leading-[1.2] truncate select-none text-left w-full"
                                    style={{ color: '#40C4FF' }}
                                  >
                                    {msg.sender?.name}
                                  </p>
                                )}

                                <div className="text-center text-[48px] leading-none select-none my-0.5">
                                  {msg.message}
                                </div>

                                <div className="mt-[6px] text-right w-full flex items-center justify-end gap-1 text-[13px] font-medium text-white/85 select-none">
                                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  {isOwn && (
                                    msg.reads && msg.reads.length > 0 ? (
                                      <CheckCheck className="h-3.5 w-3.5 text-white fill-current ml-0.5" title="Read ✓✓" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5 text-white/70 ml-0.5" title="Sent ✓" />
                                    )
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* ─── UNIFORM DYNAMIC THEME TEXT / ATTACHMENT MESSAGE BUBBLE ─── */
                              <div
                                onContextMenu={(e) => openMessageMenu(e, msg)}
                                onTouchStart={(e) => handleTouchStartTrigger(e, msg)}
                                onTouchEnd={handleTouchEndTrigger}
                                className={`group/msg relative inline-flex flex-col p-[10px_12px_8px_12px] rounded-[22px] transition-all duration-200 hover:-translate-y-[1px] bg-primary text-white shadow-md shadow-primary/20 max-w-full overflow-hidden ${isOwn ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'
                                  }`}
                                style={{ width: 'fit-content', maxWidth: '100%' }}
                              >
                                {!msg.isDeleted && (
                                  <div className="absolute top-2 right-2.5 opacity-0 group-hover/msg:opacity-100 transition-opacity z-20">
                                    <button
                                      type="button"
                                      onClick={(e) => openMessageMenu(e, msg)}
                                      className="msg-options-btn p-1 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all shadow-xs cursor-pointer"
                                      title="Message options"
                                    >
                                      <MoreVertical className="h-3.5 w-3.5 text-white pointer-events-none" />
                                    </button>
                                  </div>
                                )}
                                {!isOwn && activeRoom.type !== 'DIRECT' && (
                                  <p
                                    className="text-[15px] font-bold mb-[6px] leading-[1.2] truncate select-none text-left"
                                    style={{ color: '#40C4FF' }}
                                  >
                                    {msg.sender?.name}
                                  </p>
                                )}

                                {msg.isDeleted ? (
                                  <div className="flex items-center gap-3">
                                    <p className="italic text-white/90 text-[18px]">This message was deleted</p>
                                    <span className="text-[13px] font-medium text-white/85">
                                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    {msg.replyTo && (
                                      <div className="mb-2 p-[8px_10px] rounded-[14px] border-l-[4px] border-white/90 bg-black/20 text-white text-[14px] max-w-full overflow-hidden">
                                        <p className="font-bold text-[14px] truncate text-white">{msg.replyTo.sender?.name}</p>
                                        <p className="truncate font-normal mt-0.5 text-white/90">{msg.replyTo.message}</p>
                                      </div>
                                    )}

                                    {/* Attachments */}
                                    {msg.attachmentUrl && (
                                      <div className="mb-1.5 max-w-full overflow-hidden">
                                        {isVid ? (
                                          /* ─── VIDEO BUBBLE (Thumbnail + Centered Play Button Overlay) ─── */
                                          <div
                                            className="relative group/vid overflow-hidden rounded-[18px] cursor-pointer max-w-full"
                                            onClick={() => setLightboxMedia({ url: `${api.defaults.baseURL.replace('/api', '')}${msg.attachmentUrl}`, type: 'VIDEO' })}
                                          >
                                            <video
                                              src={`${api.defaults.baseURL.replace('/api', '')}${msg.attachmentUrl}`}
                                              preload="metadata"
                                              className="max-h-72 max-w-full w-auto rounded-[18px] object-cover pointer-events-none"
                                            />
                                            {/* Centered Play Button Overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/vid:bg-black/45 transition-colors rounded-[18px]">
                                              <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border-2 border-white/90 shadow-xl group-hover/vid:scale-110 transition-transform">
                                                <Play className="h-6 w-6 fill-current ml-1 text-white" />
                                              </div>
                                            </div>
                                          </div>
                                        ) : isAudio ? (
                                          /* ─── AUDIO PLAYER BUBBLE (WhatsApp Desktop Voice/Audio Player) ─── */
                                          <AudioPlayer url={`${api.defaults.baseURL.replace('/api', '')}${msg.attachmentUrl}`} />
                                        ) : isImg ? (
                                          /* ─── IMAGE BUBBLE (Image Preview Only) ─── */
                                          <div
                                            className="relative group/img overflow-hidden rounded-[18px] cursor-pointer max-w-full"
                                            onClick={() => setLightboxMedia({ url: `${api.defaults.baseURL.replace('/api', '')}${msg.attachmentUrl}`, type: 'IMAGE' })}
                                          >
                                            <img
                                              src={`${api.defaults.baseURL.replace('/api', '')}${msg.attachmentUrl}`}
                                              alt=""
                                              className="max-h-72 max-w-full w-auto rounded-[18px] object-cover hover:opacity-95 transition-opacity"
                                            />
                                          </div>
                                        ) : (
                                          /* ─── DOCUMENT CARD (PDF, ZIP, DOCX, XLSX, etc.) ─── */
                                          <button
                                            type="button"
                                            onClick={() => downloadChatAttachment(msg)}
                                            className="flex items-center gap-2.5 p-2.5 rounded-[18px] bg-white/15 text-white hover:bg-white/25 transition-all group/file border border-white/15 w-full max-w-full min-w-0 overflow-hidden text-left cursor-pointer"
                                          >
                                            <div className="w-9 h-9 rounded-[14px] bg-white/20 text-white flex items-center justify-center shrink-0">
                                              <fileCard.icon className="h-4.5 w-4.5 text-white" />
                                            </div>

                                            <div className="truncate text-left flex-1 min-w-0 pr-1">
                                              <p className="text-[15px] font-semibold truncate text-white leading-snug">
                                                {getCleanFileName(msg)}
                                              </p>
                                              {msg.fileSize && (
                                                <p className="text-[12px] text-white/85 font-medium mt-0.5 select-none">
                                                  {formatFileSize(msg.fileSize)}
                                                </p>
                                              )}
                                            </div>

                                            <div className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/35 text-white flex items-center justify-center shrink-0 ml-auto transition-transform group-hover/file:scale-110">
                                              <Download className="h-3.5 w-3.5 text-white" />
                                            </div>
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {/* WhatsApp Inline Text Caption & Timestamp Flow */}
                                    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-0.5">
                                      {isImg || isVid ? (
                                        captionText ? (
                                          <span className="break-words text-white text-[18px] leading-[1.45] font-medium tracking-normal mt-1">
                                            {captionText}
                                          </span>
                                        ) : (
                                          <span className="flex-1" />
                                        )
                                      ) : msg.attachmentUrl ? (
                                        /* For File Attachments with optional user comment */
                                        captionText ? (
                                          <span className="break-words text-white text-[16px] leading-[1.4] font-medium tracking-normal mt-1">
                                            {captionText}
                                          </span>
                                        ) : (
                                          <span className="flex-1" />
                                        )
                                      ) : (
                                        <span className="break-words text-white text-[16px] leading-[1.4] font-medium tracking-normal">
                                          {msg.message}
                                        </span>
                                      )}

                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium select-none ml-auto shrink-0 pb-0.5 translate-y-[2px] text-white/85">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {isOwn && (
                                          msg.reads && msg.reads.length > 0 ? (
                                            <CheckCheck className="h-3.5 w-3.5 text-[#D6FFF4] fill-current ml-0.5" title="Read ✓✓" />
                                          ) : (
                                            <Check className="h-3.5 w-3.5 text-white/70 ml-0.5" title="Sent ✓" />
                                          )
                                        )}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </React.Fragment>
                    );
                  })
                )}

                {/* Real-time Typing Status */}
                {typingUsers.size > 0 && (
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-primary italic animate-pulse pt-2 pl-2">
                    <Sparkles className="h-4 w-4" />
                    <span>{Array.from(typingUsers.values()).join(', ')} is typing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Toolbar / Read-Only Banner (48px Height) */}
              <div className="p-3 border-t border-border/60 bg-card/80 backdrop-blur-xl shrink-0">
                {activeRoom.isArchived ? (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-2">
                    <Lock className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>This project has been completed or closed. Chat is read-only.</span>
                  </div>
                ) : (
                  <>
                    {(replyingTo || editingMsg) && (
                      <div className="mb-2 p-2 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-2 text-primary truncate">
                          {replyingTo ? <Reply className="h-4 w-4 shrink-0" /> : <Edit3 className="h-4 w-4 shrink-0" />}
                          <span className="truncate">
                            {replyingTo ? `Replying to ${replyingTo.sender?.name}: "${replyingTo.message}"` : `Editing message: "${editingMsg.message}"`}
                          </span>
                        </div>
                        <button onClick={() => { setReplyingTo(null); setEditingMsg(null); setInputText(''); }} className="text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {showEmojiPicker && (
                      <div className="absolute bottom-16 left-6 z-50 bg-card border border-border/80 rounded-2xl p-3 shadow-2xl grid grid-cols-8 gap-2 animate-in fade-in zoom-in duration-200">
                        {EMOJI_LIST.map((emo) => (
                          <button
                            key={emo}
                            onClick={() => { setInputText(prev => prev + emo); setShowEmojiPicker(false); }}
                            className="text-lg hover:scale-125 transition-transform p-1.5 rounded-lg hover:bg-primary/10"
                          >
                            {emo}
                          </button>
                        ))}
                      </div>
                    )}

                    {(activeRoom.isArchived || activeRoom.status === 'ARCHIVED') ? (
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold shadow-xs">
                        <Users className="h-4 w-4" />
                        <span>👥 This project chat group is Archived and read-only. Sending new messages is disabled.</span>
                      </div>
                    ) : (
                      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          className="hidden"
                        />

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="p-2 rounded-full border border-border/60 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-50 shrink-0"
                          title="Attach File"
                        >
                          <Paperclip className="h-5 w-5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="p-2 rounded-full border border-border/60 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0"
                          title="Insert Emoji"
                        >
                          <Smile className="h-5 w-5" />
                        </button>

                        <input
                          ref={inputRef}
                          type="text"
                          placeholder={`Message ${getRoomTitleAndCode(activeRoom).title || 'chat'}...`}
                          value={inputText}
                          onChange={handleInputChange}
                          className="flex-1 bg-background/80 dark:bg-slate-950/60 border border-border/70 rounded-full h-[48px] px-4 text-[14px] font-medium text-foreground placeholder:text-[14px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                        />

                        <button
                          type="submit"
                          disabled={!inputText.trim()}
                          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white h-[48px] px-5 rounded-full text-xs font-bold shadow-md shadow-primary/20 transition-all active:scale-95 disabled:opacity-40 shrink-0"
                        >
                          <Send className="h-4 w-4" />
                          <span className="hidden sm:inline">Send</span>
                        </button>
                      </form>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8 space-y-3">
              <MessageSquare className="h-12 w-12 text-primary/50" />
              <p className="text-sm font-bold text-foreground">Select a contact or project group from the chat list to start messaging.</p>
            </div>
          )}
        </div>

        {/* ─── GROUP / USER PROFILE INFORMATION SIDE PANEL ─────────────────────────────── */}
        <AnimatePresence>
          {showGroupInfo && activeRoom && (
            <motion.div
              ref={groupInfoRef}
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="w-full max-w-[340px] sm:w-[350px] border-l border-border/60 bg-card/95 backdrop-blur-2xl flex flex-col shrink-0 shadow-2xl z-30 md:z-20 overflow-y-auto scrollbar-none select-none transition-all duration-200 ease-in-out"
            >
              {/* Slide-over Header */}
              <div className="p-4 border-b border-border/60 flex items-center justify-between sticky top-0 bg-card/90 backdrop-blur-md z-10">
                <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                  <Info className="h-4.5 w-4.5 text-primary" />
                  <span>{activeRoom.type === 'DIRECT' ? 'User Profile' : 'Group Information'}</span>
                </h3>
                <button onClick={() => setShowGroupInfo(false)} className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-primary/10">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Panel Body */}
              <div className="p-4 space-y-5 text-left text-xs">

                {/* DIRECT MESSAGE: USER PROFILE VIEW */}
                {activeRoom.type === 'DIRECT' ? (
                  <>
                    {/* Top Avatar Banner */}
                    <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-primary/5 border border-primary/15 space-y-2">
                      <UserAvatar
                        user={roomDetails?.otherUser}
                        src={activeRoom.displayPic}
                        name={activeRoom.name}
                        className="h-20 w-20 rounded-2xl shadow-lg shadow-primary/20"
                      />
                      <div>
                        <h4 className="font-black text-sm text-foreground">{roomDetails?.otherUser?.name || activeRoom.name}</h4>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-primary/10 text-primary border border-primary/20">
                            {(roomDetails?.otherUser?.role || activeRoom.otherUser?.role) === 'ADMIN' ? 'Admin' : (roomDetails?.otherUser?.role || activeRoom.otherUser?.role) === 'TEAM_LEADER' ? 'Team Leader' : (roomDetails?.otherUser?.role || activeRoom.otherUser?.role) || 'User'}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${onlineUserIds.has(roomDetails?.otherUser?.id || activeRoom.otherUser?.id) ? 'bg-primary/10 text-primary border-primary/20' : 'bg-slate-400/10 text-slate-400 border-slate-400/20'
                            }`}>
                            {onlineUserIds.has(roomDetails?.otherUser?.id || activeRoom.otherUser?.id) ? '🟢 Online' : '⚪ Offline'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* User Profile Information Card */}
                    <div className="space-y-2.5 p-3.5 rounded-2xl bg-card border border-border/70 shadow-xs">
                      <h5 className="font-extrabold text-[11px] text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Profile Details</span>
                      </h5>

                      <div className="space-y-2 text-xs font-semibold">
                        <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                          <span className="text-muted-foreground">Email</span>
                          <span className="text-foreground font-bold truncate max-w-[180px]">{roomDetails?.otherUser?.email || activeRoom.otherUser?.email || 'N/A'}</span>
                        </div>

                        <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                          <span className="text-muted-foreground">User ID</span>
                          <span className="text-foreground font-bold">{roomDetails?.otherUser?.employeeId || activeRoom.otherUser?.employeeId || 'N/A'}</span>
                        </div>

                        <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                          <span className="text-muted-foreground">Department</span>
                          <span className="text-foreground font-bold">{roomDetails?.otherUser?.department || 'Engineering'}</span>
                        </div>

                        {roomDetails?.otherUser?.college && (
                          <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground">College</span>
                            <span className="text-foreground font-bold truncate max-w-[180px]">{roomDetails.otherUser.college}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                          <span className="text-muted-foreground">Phone</span>
                          <span className="text-foreground font-bold">{roomDetails?.otherUser?.phone || 'N/A'}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Joined Date</span>
                          <span className="text-foreground font-medium">
                            {(roomDetails?.otherUser?.joiningDate || roomDetails?.otherUser?.createdAt)
                              ? new Date(roomDetails?.otherUser?.joiningDate || roomDetails?.otherUser?.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '01 Jan 2024'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* PROJECT / GROUP CHAT VIEW */
                  <>
                    {/* Top Avatar Banner */}
                    <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-primary/5 border border-primary/15 space-y-2">
                      <div className="h-16 w-16 rounded-2xl bg-primary text-white font-black text-xl flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden">
                        {activeRoom.type === 'COMPANY' ? (
                          <Globe className="h-8 w-8" />
                        ) : (
                          <Users className="h-8 w-8" />
                        )}
                      </div>
                      {(() => {
                        const { title, code } = getRoomTitleAndCode(activeRoom);
                        return (
                          <div className="flex flex-col items-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap max-w-full">
                              <h4 className="font-black text-sm text-foreground truncate">{title}</h4>
                              {code && (
                                <span className="text-[9px] font-black uppercase bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded shrink-0">
                                  {code}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                              {activeRoom.type === 'COMPANY' ? 'Official Organization Group' : 'Project Chat Group'}
                            </p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Project Details Card */}
                    {(activeRoom.type === 'PROJECT' || roomDetails?.task) && (
                      <div className="space-y-2.5 p-3.5 rounded-2xl bg-card border border-border/70 shadow-xs">
                        <h5 className="font-extrabold text-[11px] text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          <span>Project Details</span>
                        </h5>

                        <div className="space-y-2 text-xs font-semibold">
                          <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground">Status</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${['COMPLETED', 'APPROVED', 'CLOSED'].includes(roomDetails?.task?.status || activeRoom.task?.status)
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              }`}>
                              {['COMPLETED', 'APPROVED', 'CLOSED'].includes(roomDetails?.task?.status || activeRoom.task?.status) ? '🟢 Completed' : '🟢 In Progress'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground">Team</span>
                            <span className="text-foreground font-bold">{roomDetails?.team?.name || activeRoom.team?.name || 'Software Team'}</span>
                          </div>

                          <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground">Project Lead</span>
                            <span className="text-foreground font-bold">{roomDetails?.team?.leader?.name || activeRoom.team?.leader?.name || 'Praveen N'}</span>
                          </div>

                          <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground">Start Date</span>
                            <span className="text-foreground font-medium">
                              {(roomDetails?.task?.createdAt || activeRoom.task?.createdAt)
                                ? new Date(roomDetails?.task?.createdAt || activeRoom.task?.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '10 Jul 2026'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Due Date</span>
                            <span className="text-foreground font-medium">
                              {(roomDetails?.task?.deadline || activeRoom.task?.deadline)
                                ? new Date(roomDetails?.task?.deadline || activeRoom.task?.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '30 Aug 2026'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Members Section (Group Chats Only) */}
                    <div className="space-y-2.5">
                      <h5 className="font-extrabold text-[11px] text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        <span>Members ({(roomDetails?.members || activeRoom.members || []).length})</span>
                      </h5>

                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {(roomDetails?.members || activeRoom.members || []).map((m) => {
                          const isOnline = onlineUserIds.has(m.id);
                          const isTL = roomDetails?.team?.leaderId === m.id || activeRoom.team?.leaderId === m.id || m.role === 'TEAM_LEADER';

                          return (
                            <div key={m.id} className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/60 hover:bg-primary/5 transition-all">
                              <div className="flex items-center gap-2.5 truncate">
                                <UserAvatar
                                  user={m}
                                  className="h-8 w-8 rounded-xl shrink-0"
                                />
                                <div className="truncate">
                                  <p className="font-bold text-foreground text-xs truncate flex items-center gap-1">
                                    <span>{m.name}</span>
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-semibold">
                                    {isTL ? 'Team Leader' : m.role === 'ADMIN' ? 'Admin' : m.role}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isOnline ? 'bg-primary/10 text-primary border-primary/20' : 'bg-slate-400/10 text-slate-400 border-slate-400/20'
                                  }`}>
                                  {isOnline ? '🟢 Online' : '⚪ Offline'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Shared Files Section */}
                <div className="space-y-2.5 pt-1">
                  <h5 className="font-extrabold text-[11px] text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>Shared Files ({sharedFilesList.length})</span>
                  </h5>

                  {sharedFilesList.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic p-3 text-center rounded-xl bg-card border border-border/50">No shared files in this conversation.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {sharedFilesList.map((file, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => downloadChatAttachment(file)}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <FileText className="h-5 w-5 text-primary shrink-0" />
                            <div className="truncate text-left">
                              <p className="font-bold text-foreground text-xs truncate">{file.name}</p>
                              <p className="text-[9px] text-muted-foreground font-semibold">{file.source || 'Attachment'}</p>
                            </div>
                          </div>
                          <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 ml-2" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Lightbox Modal for Video & Image Previews */}
      {lightboxMedia && (
        <div
          onClick={() => setLightboxMedia(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {lightboxMedia.type === 'VIDEO' ? (
              <video
                src={lightboxMedia.url}
                controls
                autoPlay
                className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
              />
            ) : (
              <img src={lightboxMedia.url} alt="Full preview" className="max-h-[85vh] max-w-full object-contain rounded-2xl" />
            )}
            <button
              onClick={() => setLightboxMedia(null)}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all border border-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      {/* WhatsApp-Style Delete Confirmation Modal */}
      {deleteTargetMsg && (
        <div
          onClick={() => setDeleteTargetMsg(null)}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900/90 border border-white/20 backdrop-blur-2xl rounded-2xl p-6 max-w-md w-full shadow-2xl text-white flex flex-col gap-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-white leading-tight">
                  {deleteTargetMsg.isDeleted ? 'Delete this message permanently?' : 'Delete Message?'}
                </h3>
                <p className="text-[13px] text-white/70 font-medium mt-0.5">
                  {deleteTargetMsg.isDeleted
                    ? 'This will completely remove the deleted message placeholder from your chat. This action cannot be undone.'
                    : 'Are you sure you want to delete this message?'}
                </p>
              </div>
            </div>

            {/* Delete Options */}
            <div className="flex flex-col gap-2.5 my-1">
              {deleteTargetMsg.senderId === currentUser?.id || currentUser?.role === 'ADMIN' ? (
                <>
                  <label
                    onClick={() => setDeleteMode(deleteTargetMsg.isDeleted ? 'PERMANENT_EVERYONE' : 'EVERYONE')}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${deleteMode.includes('EVERYONE')
                        ? 'bg-primary/25 border-primary text-white font-semibold'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                      }`}
                  >
                    <input
                      type="radio"
                      name="deleteMode"
                      checked={deleteMode.includes('EVERYONE')}
                      onChange={() => setDeleteMode(deleteTargetMsg.isDeleted ? 'PERMANENT_EVERYONE' : 'EVERYONE')}
                      className="accent-primary h-4 w-4"
                    />
                    <div className="text-left">
                      <p className="text-[14px] font-bold text-white">
                        {deleteTargetMsg.isDeleted ? 'Delete Permanently for Everyone' : 'Delete for Everyone'}
                      </p>
                      <p className="text-[12px] text-white/70 font-medium">
                        {deleteTargetMsg.isDeleted
                          ? 'Completely remove placeholder for all room participants'
                          : 'Remove this message for all room participants'}
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setDeleteMode(deleteTargetMsg.isDeleted ? 'PERMANENT_ME' : 'ME')}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${deleteMode.includes('ME')
                        ? 'bg-primary/25 border-primary text-white font-semibold'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                      }`}
                  >
                    <input
                      type="radio"
                      name="deleteMode"
                      checked={deleteMode.includes('ME')}
                      onChange={() => setDeleteMode(deleteTargetMsg.isDeleted ? 'PERMANENT_ME' : 'ME')}
                      className="accent-primary h-4 w-4"
                    />
                    <div className="text-left">
                      <p className="text-[14px] font-bold text-white">
                        {deleteTargetMsg.isDeleted ? 'Delete Permanently for Me' : 'Delete for Me'}
                      </p>
                      <p className="text-[12px] text-white/70 font-medium">
                        {deleteTargetMsg.isDeleted
                          ? 'Remove placeholder only from your chat view'
                          : 'Remove this message only from your chat view'}
                      </p>
                    </div>
                  </label>
                </>
              ) : (
                <label className="flex items-center gap-3 p-3 rounded-xl border bg-primary/25 border-primary text-white font-semibold select-none">
                  <input type="radio" checked readOnly className="accent-primary h-4 w-4" />
                  <div className="text-left">
                    <p className="text-[14px] font-bold text-white">
                      {deleteTargetMsg.isDeleted ? 'Delete Permanently for Me' : 'Delete for Me'}
                    </p>
                    <p className="text-[12px] text-white/70 font-medium">
                      {deleteTargetMsg.isDeleted
                        ? 'Remove placeholder only from your chat view'
                        : 'Remove this message only from your chat view'}
                    </p>
                  </div>
                </label>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetMsg(null)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[14px] font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteMessage}
                className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white text-[14px] font-bold transition-all flex items-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Trash2 className="h-4 w-4 text-white" />
                )}
                {deleteTargetMsg.isDeleted ? 'Delete Permanently' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* WhatsApp Desktop Right-Click Context Menu */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-[220px] bg-slate-900/95 border border-white/20 backdrop-blur-2xl rounded-[14px] shadow-[0_12px_32px_rgba(0,0,0,0.5)] py-2 px-1 text-white animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          {contextMenu.msg.isDeleted ? (
            /* Context Menu for Deleted Message Placeholder: ONLY Delete from Me */
            <button
              type="button"
              onClick={async () => {
                const msgId = contextMenu.msg.id;
                setContextMenu(null);
                try {
                  await api.delete(`/chat/messages/${msgId}`, {
                    data: { deleteMode: 'PERMANENT_ME' }
                  });

                  setMessages(prev => prev.filter(m => m.id !== msgId));

                  const socket = getSocket();
                  if (socket) {
                    socket.emit('message_deleted', {
                      id: msgId,
                      roomId: activeRoom?.id,
                      deleteMode: 'PERMANENT_ME',
                      userId: currentUser?.id,
                      isPermanentlyDeleted: true
                    });
                  }

                  fetchRooms();
                  showToast('Deleted placeholder');
                } catch (err) {
                  console.error('Failed to delete placeholder:', err);
                }
              }}
              className="w-full h-10 px-3 py-2 rounded-lg flex items-center gap-3 text-[13px] font-semibold text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors text-left"
            >
              <Trash2 className="h-4 w-4 text-red-400 shrink-0" />
              <span>Delete from Me</span>
            </button>
          ) : (
            <>
              {/* Standard Actions for Active Messages */}
              <button
                type="button"
                onClick={() => {
                  setReplyingTo(contextMenu.msg);
                  setContextMenu(null);
                }}
                className="w-full h-10 px-3 py-2 rounded-lg flex items-center gap-3 text-[13px] font-semibold text-white/90 hover:bg-primary/20 hover:text-primary transition-colors text-left cursor-pointer"
              >
                <Reply className="h-4 w-4 text-primary shrink-0" />
                <span>Reply</span>
              </button>

              {/* Edit (Own Messages Only) */}
              {(contextMenu.msg.senderId === currentUser?.id || contextMenu.msg.sender?.id === currentUser?.id) && !contextMenu.msg.attachmentUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMsg(contextMenu.msg);
                    setNewMessage(contextMenu.msg.message || '');
                    setContextMenu(null);
                  }}
                  className="w-full h-10 px-3 py-2 rounded-lg flex items-center gap-3 text-[13px] font-semibold text-white/90 hover:bg-primary/20 hover:text-primary transition-colors text-left cursor-pointer"
                >
                  <Edit3 className="h-4 w-4 text-primary shrink-0" />
                  <span>Edit Message</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  handleCopyAction(contextMenu.msg);
                  setContextMenu(null);
                }}
                className="w-full h-10 px-3 py-2 rounded-lg flex items-center gap-3 text-[13px] font-semibold text-white/90 hover:bg-primary/20 hover:text-primary transition-colors text-left cursor-pointer"
              >
                <Copy className="h-4 w-4 text-primary shrink-0" />
                <span>{isImageAttachment(contextMenu.msg) ? 'Copy Image' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setForwardTargetMsg(contextMenu.msg);
                  setContextMenu(null);
                }}
                className="w-full h-10 px-3 py-2 rounded-lg flex items-center gap-3 text-[13px] font-semibold text-white/90 hover:bg-primary/20 hover:text-primary transition-colors text-left cursor-pointer"
              >
                <Forward className="h-4 w-4 text-primary shrink-0" />
                <span>Forward</span>
              </button>

              {/* Pin / Unpin (Admin & TL) */}
              {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'TEAM_LEADER') && (
                <button
                  type="button"
                  onClick={() => {
                    handleTogglePinAction(contextMenu.msg);
                    setContextMenu(null);
                  }}
                  className="w-full h-10 px-3 py-2 rounded-lg flex items-center gap-3 text-[13px] font-semibold text-white/90 hover:bg-primary/20 hover:text-primary transition-colors text-left cursor-pointer"
                >
                  <Pin className="h-4 w-4 text-primary shrink-0" />
                  <span>{contextMenu.msg.isPinned ? 'Unpin Message' : 'Pin Message'}</span>
                </button>
              )}

              {contextMenu.msg.attachmentUrl && (
                <button
                  type="button"
                  onClick={() => {
                    handleSaveAsAction(contextMenu.msg);
                    setContextMenu(null);
                  }}
                  className="w-full h-10 px-3 py-2 rounded-lg flex items-center gap-3 text-[13px] font-semibold text-white/90 hover:bg-primary/20 hover:text-primary transition-colors text-left cursor-pointer"
                >
                  <Save className="h-4 w-4 text-primary shrink-0" />
                  <span>Save As...</span>
                </button>
              )}

              {contextMenu.msg.attachmentUrl && (
                <button
                  type="button"
                  onClick={() => {
                    handleShareAction(contextMenu.msg);
                    setContextMenu(null);
                  }}
                  className="w-full h-10 px-3 py-2 rounded-lg flex items-center gap-3 text-[13px] font-semibold text-white/90 hover:bg-primary/20 hover:text-primary transition-colors text-left cursor-pointer"
                >
                  <Share2 className="h-4 w-4 text-primary shrink-0" />
                  <span>Share</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsSelectMode(true);
                  setSelectedMsgIds(new Set([contextMenu.msg.id]));
                  setContextMenu(null);
                }}
                className="w-full h-10 px-3 py-2 rounded-lg flex items-center gap-3 text-[13px] font-semibold text-white/90 hover:bg-primary/20 hover:text-primary transition-colors text-left cursor-pointer"
              >
                <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                <span>Select</span>
              </button>

              <div className="my-1 border-t border-white/10" />

              <button
                type="button"
                onClick={() => {
                  setDeleteTargetMsg(contextMenu.msg);
                  setDeleteMode(contextMenu.msg.senderId === currentUser?.id || currentUser?.role === 'ADMIN' ? 'EVERYONE' : 'ME');
                  setContextMenu(null);
                }}
                className="w-full h-10 px-3 py-2 rounded-lg flex items-center gap-3 text-[13px] font-semibold text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors text-left cursor-pointer"
              >
                <Trash2 className="h-4 w-4 text-red-400 shrink-0" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Forward Message Modal */}
      {forwardTargetMsg && (
        <div
          onClick={() => setForwardTargetMsg(null)}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900/90 border border-white/20 backdrop-blur-2xl rounded-2xl p-6 max-w-md w-full shadow-2xl text-white flex flex-col gap-4 animate-in zoom-in-95 duration-200 max-h-[85vh]"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/20 text-primary">
                  <Forward className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-white leading-tight">Forward Message</h3>
                  <p className="text-[12px] text-white/70 font-medium">Select users or groups to forward to</p>
                </div>
              </div>
              <button
                onClick={() => setForwardTargetMsg(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-white/50" />
              <input
                type="text"
                placeholder="Search chats or members..."
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/15 rounded-xl text-white placeholder:text-white/40 text-[13px] outline-none focus:border-primary transition-all"
              />
            </div>

            {/* Room / User List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-64 pr-1">
              {rooms
                .filter(r => r.name?.toLowerCase().includes(forwardSearch.toLowerCase()))
                .map(r => {
                  const isSelected = selectedForwardRoomIds.has(r.id);
                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        setSelectedForwardRoomIds(prev => {
                          const next = new Set(prev);
                          if (next.has(r.id)) next.delete(r.id);
                          else next.add(r.id);
                          return next;
                        });
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all select-none ${isSelected
                          ? 'bg-primary/25 border-primary text-white'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => { }}
                        className="accent-primary h-4 w-4 rounded cursor-pointer"
                      />
                      <div className="w-9 h-9 rounded-full bg-primary text-white font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                        {r.name?.charAt(0) || 'C'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[14px] truncate text-white">{r.name}</p>
                        <p className="text-[11px] text-white/60 truncate font-medium">{r.type} Chat</p>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setForwardTargetMsg(null)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[14px] font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={forwarding || selectedForwardRoomIds.size === 0}
                onClick={handleExecuteForward}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white text-[14px] font-bold transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {forwarding ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Forward className="h-4 w-4 text-white" />
                )}
                Forward ({selectedForwardRoomIds.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-white/20 backdrop-blur-xl text-white font-semibold text-[13px] px-5 py-2.5 rounded-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex items-center gap-2 pointer-events-none">
          <Check className="h-4 w-4 text-primary" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};

export default Chat;
