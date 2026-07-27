'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { ApiError } from '@/lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();

  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    displayName: '',
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      await register({
        email: form.email,
        username: form.username,
        password: form.password,
        displayName: form.displayName,
      });
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    }
  };

  // Password strength
  const getPasswordStrength = () => {
    const p = form.password;
    if (!p) return { score: 0, label: '', color: '' };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[a-z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    if (score <= 2) return { score, label: 'Yếu', color: 'bg-red-500' };
    if (score <= 3) return { score, label: 'Trung bình', color: 'bg-yellow-500' };
    return { score, label: 'Mạnh', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength();

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-8">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-80 w-80 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl font-bold text-white shadow-lg shadow-violet-500/30">
              C
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Tạo tài khoản</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Tham gia cộng đồng đọc truyện tranh
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tên hiển thị
              </label>
              <input
                id="displayName"
                type="text"
                value={form.displayName}
                onChange={(e) => updateField('displayName', e.target.value)}
                required
                placeholder="Tên bạn muốn hiển thị"
                className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
                required
                placeholder="username_cua_ban"
                pattern="^[a-zA-Z0-9_]+$"
                minLength={3}
                maxLength={50}
                className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-650">Chỉ chữ, số và dấu gạch dưới</p>
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
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
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  required
                  minLength={8}
                  placeholder="Tối thiểu 8 ký tự"
                  className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-3 pr-12 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Password strength */}
              {form.password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          i <= strength.score ? strength.color : 'bg-zinc-200 dark:bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{strength.label}</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Xác nhận mật khẩu
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                required
                placeholder="Nhập lại mật khẩu"
                className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Đang tạo tài khoản...
                </span>
              ) : (
                'Đăng ký'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-zinc-500">
            Đã có tài khoản?{' '}
            <Link href="/login" className="font-medium text-violet-400 hover:text-violet-300">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
