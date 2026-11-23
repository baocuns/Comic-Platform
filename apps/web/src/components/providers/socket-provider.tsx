'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { NotificationItem } from 'shared';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';
import { useToast } from './toast-provider';

function getSocketOrigin(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.startsWith('http')) {
    const stripped = envUrl.replace(/\/v1\/?$/, '');
    if (
      typeof window !== 'undefined' &&
      stripped.includes('localhost') &&
      window.location.hostname !== 'localhost'
    ) {
      return window.location.origin;
    }
    return stripped;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://127.0.0.1:4000';
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const notificationStore = useNotificationStore.getState();

    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      notificationStore.reset();
      return;
    }

    notificationStore.fetchUnreadCount(accessToken);

    let refreshedOnAuthError = false;
    const socket = io(getSocketOrigin(), {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socket.on('notification:new', (payload: NotificationItem) => {
      useNotificationStore.getState().pushRealtimeNotification(payload);
      toastRef.current.info(payload.content || payload.title, payload.content ? payload.title : undefined);
    });

    socket.on('notification:unread-count', (payload: { count: number }) => {
      if (typeof payload?.count === 'number') {
        useNotificationStore.getState().setUnreadCount(payload.count);
      }
    });

    socket.on('connect_error', (err) => {
      if (
        !refreshedOnAuthError &&
        /unauthorized|token|auth/i.test(err?.message || '')
      ) {
        refreshedOnAuthError = true;
        socket.disconnect();
        useAuthStore.getState().refreshToken().catch(() => {});
      }
    });

    socketRef.current = socket;

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [accessToken]);

  return <>{children}</>;
}
