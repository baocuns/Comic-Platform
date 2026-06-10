'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white shadow-lg shadow-violet-500/25">
            O
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            OW<span className="text-violet-400">OC</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm text-zinc-400 transition-colors hover:text-white">
            Trang chủ
          </Link>
          <Link href="/comics" className="text-sm text-zinc-400 transition-colors hover:text-white">
            Khám phá
          </Link>
          {user && (
            <>
              <Link href="/bookmarks" className="text-sm text-zinc-400 transition-colors hover:text-white">
                🔖 Đã lưu
              </Link>
              <Link href="/history" className="text-sm text-zinc-400 transition-colors hover:text-white">
                📖 Lịch sử
              </Link>
              <Link href="/studio" className="text-sm text-zinc-400 transition-colors hover:text-white">
                ✏️ Studio
              </Link>
            </>
          )}
        </div>

        {/* Auth Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href={`/@${user.username}`}
                className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline">{user.displayName}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:brightness-110"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
