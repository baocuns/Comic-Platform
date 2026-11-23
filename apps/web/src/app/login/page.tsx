'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api-client';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function sanitizeInternalUrl(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '/';
  const trimmed = raw.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }
  return '/';
}

const isDev = process.env.NODE_ENV === 'development';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const { toast } = useToast();

  const [redirectTo, setRedirectTo] = useState('/');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectTo(sanitizeInternalUrl(params.get('redirect') || params.get('next')));
  }, []);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || isLoading) return;
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Vui lòng nhập email hoặc tên đăng nhập.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(cleanId, password);
      toast.success('Đăng nhập thành công!');
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-5xl items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl md:grid-cols-2">
        {/* Left Warm Editorial Showcase */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-[#1B2340] via-[#2D3561] to-[#5458C4] p-8 text-white md:flex">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              OWOC 2.0 Warm Editorial
            </span>
            <h2 className="font-serif text-3xl font-bold leading-snug pt-3">
              Chào mừng trở lại Tàng Kinh Các
            </h2>
            <p className="text-sm text-white/80 leading-relaxed">
              Đồng bộ lịch sử đọc truyện, tủ sách theo dõi và tích lũy Xu Linh Thạch mỗi ngày.
            </p>
          </div>

          {isDev ? (
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-xs space-y-1.5 backdrop-blur-md">
              <p className="font-bold text-amber-300">Tài khoản trải nghiệm nhanh (Dev):</p>
              <p>Quản trị & Studio: <code className="font-mono">admin@owoc.vn</code> / <code className="font-mono">Admin@2026</code></p>
              <p>Tác giả: <code className="font-mono">tacgia@owoc.vn</code> / <code className="font-mono">Author@2026</code></p>
              <p>Độc giả: <code className="font-mono">docgia@owoc.vn</code> / <code className="font-mono">Reader@2026</code></p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-xs text-white/80 backdrop-blur-md">
              Đăng nhập an toàn qua mật khẩu hoặc tài khoản Google để trải nghiệm đầy đủ tính năng.
            </div>
          )}
        </div>

        {/* Right Form */}
        <div className="p-6 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">Đăng nhập</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Nhập email hoặc tên đăng nhập để tiếp tục.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3.5 py-2.5 text-xs font-semibold text-[var(--danger)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email hoặc Tên đăng nhập"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin@owoc.vn"
              required
            />

            <Input
              label="Mật khẩu"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  aria-label="Hiện/ẩn mật khẩu"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
              <LogIn className="h-4 w-4" />
              <span>Đăng nhập</span>
            </Button>
          </form>

          {/* Divider + Google Sign-In */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Hoặc tiếp tục với
            </span>
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>

          <GoogleSignInButton
            mode="login"
            onSuccess={() => router.push(redirectTo)}
            onError={setError}
          />

          <p className="mt-6 text-center text-xs text-[var(--text-secondary)]">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="font-bold text-[var(--accent-primary)] hover:underline">
              Đăng ký ngay (+30 Xu tân thủ)
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
