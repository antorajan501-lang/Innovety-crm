import { useEffect, useRef, useState, useCallback } from 'react';
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
      if (activeRoomIdRef.current && !activeRoomIdRef.current.startsWith('virtual_')) {
        socket.emit('join_chat_room', activeRoomIdRef.current);
      }
    };

    const handleDisconnect = () => {
      setIsSocketConnected(false);
    };

    // Register user identity
    socket.emit('register', {
      userId: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
      teamId: currentUser.teamMembers?.[0]?.teamId
    });

    // 1. Online Users
    const handleOnlineUsers = (usersList) => {
      callbacksRef.current.onOnlineUsers?.(usersList);
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

    // Attach listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('online_users', handleOnlineUsers);
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

  // Manage room joining/leaving when activeRoomId changes
  const prevRoomIdRef = useRef(null);
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const currentRoomId = activeRoomId;
    const prevRoomId = prevRoomIdRef.current;

    if (prevRoomId && prevRoomId !== currentRoomId && !prevRoomId.startsWith('virtual_')) {
      socket.emit('leave_chat_room', prevRoomId);
    }

    if (currentRoomId && !currentRoomId.startsWith('virtual_')) {
      socket.emit('join_chat_room', currentRoomId);
    }

    prevRoomIdRef.current = currentRoomId;
  }, [activeRoomId]);

  // Socket Emitters
  const emitSendMessage = useCallback((msgData) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('send_chat_message', msgData);
    }
  }, []);

  const emitTyping = useCallback((roomId, userId, userName) => {
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit('typing', { roomId, userId, userName });
    }
  }, []);

  const emitStopTyping = useCallback((roomId, userId) => {
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit('stop_typing', { roomId, userId });
    }
  }, []);

  const emitMessageEdited = useCallback((msgData) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('message_edited', msgData);
    }
  }, []);

  const emitMessageDeleted = useCallback((msgData) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('message_deleted', msgData);
    }
  }, []);

  const emitGroupDeleted = useCallback((roomId) => {
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit('group_deleted', { roomId });
    }
  }, []);

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
