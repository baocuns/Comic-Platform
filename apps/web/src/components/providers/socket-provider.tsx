'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore, NotificationItem } from '@/stores/notification-store';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/v1', '') || 'http://localhost:4000';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const { addRealTimeNotification, updateUnreadCount, fetchUnreadCount } = useNotificationStore();

  useEffect(() => {
    // Only connect when user is logged in with a valid token
    if (!user || !accessToken) {
      // Disconnect if user logs out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Avoid duplicate connections
    if (socketRef.current?.connected) return;

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected');
      // Fetch latest unread count on connect
      fetchUnreadCount();
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('notification:new', (notification: NotificationItem) => {
      addRealTimeNotification(notification);
    });

    socket.on('notification:unread-count', (data: { count: number }) => {
      updateUnreadCount(data.count);
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket] Connection error:', error.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, accessToken]);

  return <>{children}</>;
}
