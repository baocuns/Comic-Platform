'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';

interface GoogleAccountsId {
  initialize: (options: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_black' | 'filled_blue';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      logo_alignment?: 'left' | 'center';
      locale?: string;
      width?: number;
    },
  ) => void;
}

function getGoogleAccountsId(): GoogleAccountsId | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    google?: { accounts?: { id?: GoogleAccountsId } };
  };
  return win.google?.accounts?.id || null;
}

interface GoogleSignInButtonProps {
  mode?: 'login' | 'register';
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function GoogleSignInButton({
  mode = 'login',
  onSuccess,
  onError,
}: GoogleSignInButtonProps) {
  const { googleLogin } = useAuthStore();
  const { theme } = useTheme();
  const { toast } = useToast();

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '';
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const lastWidthRef = useRef(0);
  const [ready, setReady] = useState(false);

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const renderGoogleButton = useCallback(() => {
    if (!clientId || !containerRef.current || !buttonRef.current) return;
    const gsi = getGoogleAccountsId();
    if (!gsi) return;

    const width = Math.min(Math.max(containerRef.current.clientWidth || 320, 240), 400);
    lastWidthRef.current = width;

    gsi.initialize({
      client_id: clientId,
      callback: async (response) => {
        if (submittingRef.current) return;
        if (!response?.credential) {
          onErrorRef.current('Không nhận được mã xác thực từ Google.');
          return;
        }
        submittingRef.current = true;
        try {
          await useAuthStore.getState().googleLogin(response.credential);
          toast.success(
            mode === 'register'
              ? 'Đăng ký bằng Google thành công!'
              : 'Đăng nhập bằng Google thành công!',
          );
          onSuccessRef.current();
        } catch (err) {
          onErrorRef.current(
            err instanceof ApiError
              ? err.message
              : 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.',
          );
        } finally {
          submittingRef.current = false;
        }
      },
    });

    buttonRef.current.innerHTML = '';
    gsi.renderButton(buttonRef.current, {
      theme: theme === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      text: mode === 'register' ? 'signup_with' : 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      locale: 'vi',
      width,
    });
    setReady(true);
  }, [clientId, mode, theme, toast]);

  useEffect(() => {
    renderGoogleButton();
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (!containerRef.current || !getGoogleAccountsId()) return;
      const nextWidth = Math.min(Math.max(containerRef.current.clientWidth || 320, 240), 400);
      if (Math.abs(nextWidth - lastWidthRef.current) >= 4) {
        renderGoogleButton();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [renderGoogleButton]);

  if (!clientId) {
    return (
      <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 px-3 py-2 text-center text-xs text-[var(--text-muted)]">
        Chưa cấu hình <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> để bật Đăng nhập Google.
      </p>
    );
  }

  return (
    <div ref={containerRef} className="relative flex min-h-[44px] w-full items-center justify-center">
      <div
        ref={buttonRef}
        className={`flex w-full justify-center transition-opacity duration-200 ${
          ready ? 'opacity-100' : 'pointer-events-none absolute opacity-0'
        }`}
      />
      {!ready && (
        <div className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-xs font-medium text-[var(--text-muted)]">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent-primary)]" />
          <span>Đang tải nút Đăng nhập Google...</span>
        </div>
      )}
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={renderGoogleButton}
      />
    </div>
  );
}
