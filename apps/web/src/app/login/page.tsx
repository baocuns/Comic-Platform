'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { useAuthStore } from '@/stores/auth-store';
import { ApiError } from '@/lib/api-client';
import { useTheme } from '@/components/providers/theme-provider';

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, googleLogin, isLoading } = useAuthStore();
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const redirectTo = searchParams.get('redirect') || '/';
  const [googleInitialized, setGoogleInitialized] = useState(false);

  const handleGoogleLogin = async (response: any) => {
    setError('');
    const idToken = response.credential;
    try {
      await googleLogin(idToken);
      router.push(redirectTo);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Đăng nhập bằng Google thất bại. Vui lòng thử lại.');
      }
    }
  };

  const initializeGoogleBtn = () => {
    if (typeof window !== 'undefined' && window.google) {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '292333278398-p7b1stp89olfcsf0affr5v46kn8m40tr.apps.googleusercontent.com',
        callback: handleGoogleLogin,
      });

      const card = document.getElementById('google-card-container');
      const calculatedWidth = card ? Math.min(382, card.clientWidth - 64) : 382;

      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        {
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: calculatedWidth,
        }
      );
      setGoogleInitialized(true);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.google) {
      initializeGoogleBtn();
    }
  }, [theme]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined' && window.google && googleInitialized) {
        const card = document.getElementById('google-card-container');
        const calculatedWidth = card ? Math.min(382, card.clientWidth - 64) : 382;
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-button'),
          {
            theme: theme === 'dark' ? 'filled_black' : 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            width: calculatedWidth,
          }
        );
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [googleInitialized, theme]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      router.push(redirectTo);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-amber-500/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-orange-500/20 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div id="google-card-container" className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-2xl font-bold text-white shadow-lg shadow-amber-500/30">
              C
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Chào mừng trở lại</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Đăng nhập để tiếp tục đọc truyện
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-3 pr-12 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Đang đăng nhập...
                </span>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
            <span className="text-xs text-zinc-500">HOẶC</span>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
          </div>

          {/* Google Login */}
          <div className="relative flex min-h-[44px] w-full justify-center">
            <div
              id="google-signin-button"
              className={`w-full flex justify-center transition-opacity duration-300 ${googleInitialized ? 'opacity-100' : 'absolute pointer-events-none opacity-0'
                }`}
            />
            {!googleInitialized && (
              <div className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 py-3 text-sm font-medium text-zinc-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500/30 border-t-zinc-500" />
                Đang tải Google Sign-In...
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-zinc-500">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
      <Script
        src="https://accounts.google.com/gsi/client"
        onLoad={initializeGoogleBtn}
        strategy="afterInteractive"
      />
    </div>
  );
}
