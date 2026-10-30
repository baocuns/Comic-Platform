'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useSearchStore } from '@/stores/search-store';
import { useTheme } from '@/components/providers/theme-provider';
import { NotificationBell } from './notification-bell';
import { Brand } from './brand';
import './shell.css';

const navigation = [
  { href: '/', label: 'Trang chủ' },
  { href: '/comics', label: 'Khám phá' },
  { href: '/news', label: 'Bản tin' },
];

export function Header() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const openSearch = useSearchStore((state) => state.open);
  const [isVisible, setIsVisible] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const lastScrollY = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      if (current <= 50 || current < lastScrollY.current - 10) setIsVisible(true);
      else if (current > lastScrollY.current + 10) setIsVisible(false);
      lastScrollY.current = current;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    const handleOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowDropdown(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dropdownRef.current) {
        setShowDropdown(false);
        dropdownRef.current.querySelector('button')?.focus();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showDropdown]);

  if (pathname?.startsWith('/read/') || pathname?.startsWith('/studio')) return null;

  const handleLogout = async () => {
    setShowDropdown(false);
    await logout();
    router.push('/');
  };

  return (
    <header className={`ow-header${isVisible ? '' : ' ow-header--hidden'}`}>
      <a className="ow-skip" href="#main-content">Đến nội dung chính</a>
      <div className="ow-header-inner">
        <Link href="/" className="ow-logo"><Brand /></Link>
        <nav className="ow-nav" aria-label="Điều hướng chính">
          {navigation.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
            return <Link key={href} href={href} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}>{label}</Link>;
          })}
        </nav>
        <div className="ow-header-actions">
          <button className="ow-search-trigger" type="button" onClick={openSearch} aria-label="Tìm kiếm truyện">
            <i className="fa-light fa-magnifying-glass" aria-hidden="true" /><span>Tìm truyện hay...</span>
          </button>
          <button className="ow-icon-button ow-theme-toggle" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Bật giao diện sáng' : 'Bật giao diện tối'}>
            <i className={`fa-light ${theme === 'dark' ? 'fa-sun-bright' : 'fa-moon-stars'}`} aria-hidden="true" />
          </button>
          {user ? (
            <>
              <NotificationBell />
              <div className="ow-account" ref={dropdownRef}>
                <button className="ow-account-trigger" type="button" aria-expanded={showDropdown} aria-controls="ow-account-panel" onClick={() => setShowDropdown(!showDropdown)}>
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" width="36" height="36" />
                  ) : <span className="ow-avatar-letter">{(user.displayName || user.username).charAt(0).toUpperCase()}</span>}
                  <span className="ow-account-name">{user.displayName || user.username}</span>
                  <i className="fa-light fa-chevron-down" aria-hidden="true" />
                  <span className="sr-only">Tài khoản</span>
                </button>
                {showDropdown && (
                  <div className="ow-account-panel" id="ow-account-panel">
                    <div className="ow-account-summary"><strong>{user.displayName || user.username}</strong><small>@{user.username} · Cấp {user.level || 1} · {user.coins || 0} xu</small></div>
                    <Link href={`/@${user.username}`} onClick={() => setShowDropdown(false)}><i className="fa-light fa-user" aria-hidden="true" />Trang cá nhân</Link>
                    {['AUTHOR', 'MODERATOR', 'ADMIN'].includes(user.role) && <Link href="/studio" onClick={() => setShowDropdown(false)}><i className="fa-light fa-pen-nib" aria-hidden="true" />Studio sáng tác</Link>}
                    <Link href="/bookmarks" onClick={() => setShowDropdown(false)}><i className="fa-light fa-bookmark" aria-hidden="true" />Truyện đã lưu</Link>
                    <Link href="/history" onClick={() => setShowDropdown(false)}><i className="fa-light fa-clock-rotate-left" aria-hidden="true" />Lịch sử đọc</Link>
                    <Link href={`/@${user.username}`} onClick={() => setShowDropdown(false)}><i className="fa-light fa-gear" aria-hidden="true" />Cài đặt tài khoản</Link>
                    <button type="button" className="ow-logout" onClick={handleLogout}><i className="fa-light fa-right-from-bracket" aria-hidden="true" />Đăng xuất</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <><Link href="/login" className="ow-login">Đăng nhập</Link><Link href="/register" className="ow-join">Tham gia <span aria-hidden="true">↗</span></Link></>
          )}
        </div>
      </div>
    </header>
  );
}
