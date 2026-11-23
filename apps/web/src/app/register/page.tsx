'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, UserPlus, Coins } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api-client';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || isLoading) return;
    setError('');
    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        username: username.trim(),
        displayName: displayName.trim(),
        password,
      });
      toast.success('Đăng ký thành công! Bạn đã nhận +30 Xu tân thủ.');
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng ký thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-5xl items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-[#2B223C] via-[#6D4C64] to-[#D96B52] p-8 text-white md:flex">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <Coins className="h-3.5 w-3.5 text-amber-300" />
              Tặng ngay 30 Xu Linh Thạch
            </span>
            <h2 className="font-serif text-3xl font-bold leading-snug">
              Khởi tạo hành trình Đạo Lộ
            </h2>
            <p className="text-sm text-white/85 leading-relaxed">
              Lưu tủ sách, tham gia bình luận cùng cộng đồng, điểm danh nhận Xu và gửi hồ sơ xét duyệt trở thành Tác giả bất cứ lúc nào.
            </p>
          </div>
          <p className="text-xs text-white/75">
            Mật khẩu cần tối thiểu 8 ký tự gồm chữ hoa, chữ thường và chữ số.
          </p>
        </div>

        <div className="p-6 sm:p-10">
          <div className="mb-5">
            <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">Tạo tài khoản mới</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Chỉ mất 30 giây để gia nhập OWOC.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3.5 py-2.5 text-xs font-semibold text-[var(--danger)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@example.com"
              required
            />
            <Input
              label="Tên đăng nhập (username)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="dao_huu_moi"
              hint="Chỉ gồm chữ cái, số và dấu _"
              required
            />
            <Input
              label="Tên hiển thị"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Thanh Vân"
              required
            />
            <Input
              label="Mật khẩu"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự (Hoa, thường, số)"
              required
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <Button type="submit" variant="warm" size="lg" className="w-full" isLoading={isLoading || submitting}>
              <UserPlus className="h-4 w-4" />
              <span>Đăng ký tài khoản</span>
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Hoặc đăng ký nhanh với
            </span>
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>

          <GoogleSignInButton
            mode="register"
            onSuccess={() => router.push('/')}
            onError={setError}
          />

          <p className="mt-5 text-center text-xs text-[var(--text-secondary)]">
            Đã có tài khoản?{' '}
            <Link href="/login" className="font-bold text-[var(--accent-primary)] hover:underline">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
