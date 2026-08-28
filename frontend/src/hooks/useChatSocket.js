import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../services/api';

/**
 * Custom hook to stabilize Socket.IO event listeners for the Chat Module.
 * Prevents duplicate listener registration and ensures smooth real-time events.
 */
export const useChatSocket = ({
  currentUser,
  activeRoomId,
  onReceiveMessage,
  onMessageEdited,
  onMessageDeleted,
  onRoomsUpdated,
  onGroupDeleted,
  onOnlineUsers,
  onUserOnline,
  onUserOffline,
  onUserTyping,
  onUserStopTyping
}) => {
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Store latest callbacks in refs to avoid tearing down and re-binding socket listeners
  const callbacksRef = useRef({
    onReceiveMessage,
    onMessageEdited,
    onMessageDeleted,
    onRoomsUpdated,
    onGroupDeleted,
    onOnlineUsers,
    onUserOnline,
    onUserOffline,
    onUserTyping,
    onUserStopTyping
  });

  useEffect(() => {
    callbacksRef.current = {
      onReceiveMessage,
      onMessageEdited,
      onMessageDeleted,
      onRoomsUpdated,
      onGroupDeleted,
      onOnlineUsers,
      onUserOnline,
      onUserOffline,
      onUserTyping,
      onUserStopTyping
    };
  }, [
    onReceiveMessage,
    onMessageEdited,
    onMessageDeleted,
    onRoomsUpdated,
    onGroupDeleted,
    onOnlineUsers,
    onUserOnline,
    onUserOffline,
    onUserTyping,
    onUserStopTyping
  ]);

  const activeRoomIdRef = useRef(activeRoomId);
  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    if (!currentUser || !currentUser.id) return;

    const socket = getSocket();
    if (!socket) return;

    setIsSocketConnected(socket.connected);

    const handleConnect = () => {
      setIsSocketConnected(true);
      socket.emit('register', {
        userId: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        teamId: currentUser.teamMembers?.[0]?.teamId
      });
      socket.emit('get_online_users');
      if (activeRoomIdRef.current && !activeRoomIdRef.current.startsWith('virtual_')) {
        socket.emit('join_chat_room', activeRoomIdRef.current);
      }
    };

    const handleDisconnect = () => {
      setIsSocketConnected(false);
    };

    // Register user identity and request online users
    socket.emit('register', {
      userId: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
      teamId: currentUser.teamMembers?.[0]?.teamId
    });
    socket.emit('get_online_users');

    // 1. Online Users Handlers
    const handleOnlineUsers = (usersList) => {
      console.log('[CHAT SOCKET] online_users:', usersList);
      callbacksRef.current.onOnlineUsers?.(usersList);
    };

    const handleUserOnline = (data) => {
      console.log('[CHAT SOCKET] user_online:', data);
      callbacksRef.current.onUserOnline?.(data);
    };

    const handleUserOffline = (data) => {
      console.log('[CHAT SOCKET] user_offline:', data);
      callbacksRef.current.onUserOffline?.(data);
    };

    // 2. Incoming Chat Message
    const handleReceiveMessage = (msg) => {
      callbacksRef.current.onReceiveMessage?.(msg);
    };

    // 3. Typing Indicators
    const handleUserTyping = (data) => {
      callbacksRef.current.onUserTyping?.(data);
    };

    const handleUserStopTyping = (data) => {
      callbacksRef.current.onUserStopTyping?.(data);
    };

    // 4. Message Edits & Deletions
    const handleMessageEdited = (updatedMsg) => {
      callbacksRef.current.onMessageEdited?.(updatedMsg);
    };

    const handleMessageDeleted = (deletedMsg) => {
      callbacksRef.current.onMessageDeleted?.(deletedMsg);
    };

    // 5. Room Activity & Updates
    const handleRoomsUpdated = (data) => {
      callbacksRef.current.onRoomsUpdated?.(data);
    };

    // 6. Group Deletions
    const handleGroupDeleted = (data) => {
      callbacksRef.current.onGroupDeleted?.(data);
    };

    // Clean previous listeners before attaching
    socket.off('connect', handleConnect);
    socket.off('disconnect', handleDisconnect);
    socket.off('online_users', handleOnlineUsers);
    socket.off('user_online', handleUserOnline);
    socket.off('user_offline', handleUserOffline);
    socket.off('receive_chat_message', handleReceiveMessage);
    socket.off('chat_room_activity', handleRoomsUpdated);
    socket.off('chat_rooms_updated', handleRoomsUpdated);
    socket.off('user_typing', handleUserTyping);
    socket.off('user_stop_typing', handleUserStopTyping);
    socket.off('message_edited', handleMessageEdited);
    socket.off('message_deleted', handleMessageDeleted);
    socket.off('group_deleted', handleGroupDeleted);
    socket.off('chat_room_deleted', handleGroupDeleted);

    // Attach listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('online_users', handleOnlineUsers);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);
    socket.on('receive_chat_message', handleReceiveMessage);
    socket.on('chat_room_activity', handleRoomsUpdated);
    socket.on('chat_rooms_updated', handleRoomsUpdated);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('group_deleted', handleGroupDeleted);
    socket.on('chat_room_deleted', handleGroupDeleted);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('online_users', handleOnlineUsers);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
      socket.off('receive_chat_message', handleReceiveMessage);
      socket.off('chat_room_activity', handleRoomsUpdated);
      socket.off('chat_rooms_updated', handleRoomsUpdated);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('group_deleted', handleGroupDeleted);
      socket.off('chat_room_deleted', handleGroupDeleted);
    };
  }, [currentUser?.id]);

  // Actions
  const emitSendMessage = (messageData) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('send_chat_message', messageData);
    }
  };

  const emitTyping = (roomId) => {
    const socket = getSocket();
    if (socket && socket.connected && currentUser) {
      socket.emit('typing', { roomId, userId: currentUser.id, userName: currentUser.name });
    }
  };

  const emitStopTyping = (roomId) => {
    const socket = getSocket();
    if (socket && socket.connected && currentUser) {
      socket.emit('stop_typing', { roomId, userId: currentUser.id });
    }
  };

  const emitMessageEdited = (messageData) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('message_edited', messageData);
    }
  };

  const emitMessageDeleted = (messageData) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('message_deleted', messageData);
    }
  };

  const emitGroupDeleted = (roomId) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('chat_room_deleted', { roomId });
    }
  };

  return {
    isSocketConnected,
    emitSendMessage,
    emitTyping,
    emitStopTyping,
    emitMessageEdited,
    emitMessageDeleted,
    emitGroupDeleted
  };
};

export default useChatSocket;
