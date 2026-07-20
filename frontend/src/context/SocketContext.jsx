import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api from '../services/api';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch initial notifications and announcements
  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setAnnouncements([]);
      setOnlineUsers([]);
      setUnreadCount(0);
      return;
    }

    const fetchInitialData = async () => {
      try {
        const [notifRes, announceRes] = await Promise.all([
          api.get('/notifications'),
          api.get('/announcements')
        ]);
        setNotifications(notifRes.data);
        setUnreadCount(notifRes.data.filter((n) => !n.isRead).length);
        setAnnouncements(announceRes.data);
      } catch (error) {
        console.error('Failed to load initial notifications/announcements:', error);
      }
    };

    fetchInitialData();
  }, [token]);

  // Handle live socket connections
  useEffect(() => {
    if (!user || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket'],
      upgrade: false
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to real-time notification socket.');
      const teamId = user.teamMembers?.[0]?.teamId || null;
      newSocket.emit('register', {
        userId: user.id,
        name: user.name,
        role: user.role,
        teamId
      });
    });

    // Listen for new notifications
    newSocket.on('notification', (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Play alert sound if supported
      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {}
    });

    // Listen for live announcements
    newSocket.on('announcement', (newAnnounce) => {
      setAnnouncements((prev) => [newAnnounce, ...prev]);
    });

    // Listen for changes in online users status list
    newSocket.on('online_users', (userIdsList) => {
      setOnlineUsers(userIdsList);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user, token]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      const wasUnread = !notifications.find((n) => n.id === id)?.isRead;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const isUserOnline = (userId) => {
    return onlineUsers.some((u) => u.id === userId);
  };

  const value = {
    notifications,
    announcements,
    unreadCount,
    onlineUsers,
    markRead,
    markAllAsRead,
    deleteNotification,
    isUserOnline
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
