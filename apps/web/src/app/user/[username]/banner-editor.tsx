'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface BannerData {
  url?: string;
  position?: number;
}

interface Props {
  banner: BannerData | null;
  isOwnProfile: boolean;
  onBannerChange: (banner: BannerData | null) => void;
}

export default function BannerEditor({ banner, isOwnProfile, onBannerChange }: Props) {
  const { accessToken, updateUser } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const [repositioning, setRepositioning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tempPosition, setTempPosition] = useState(banner?.position ?? 50);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Release drag on mouseup anywhere (even outside the banner)
  useEffect(() => {
    if (!repositioning) return;
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, [repositioning]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setUploading(true);
    setShowMenu(false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.upload<{ data: { url: string } }>('/upload/users/banner', formData, {
        token: accessToken,
      });
      const newBanner = { url: res.data.url, position: 50 };
      onBannerChange(newBanner);
      updateUser({ banner: newBanner });
    } catch {
      // silently fail
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startReposition = () => {
    setShowMenu(false);
    setTempPosition(banner?.position ?? 50);
    setRepositioning(true);
  };

  const handleDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !repositioning || !bannerRef.current) return;
    e.preventDefault();
    const rect = bannerRef.current.getBoundingClientRect();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const pct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setTempPosition(pct);
  }, [isDragging, repositioning]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!repositioning) return;
    e.preventDefault();
    setIsDragging(true);
  }, [repositioning]);

  const savePosition = async () => {
    if (!accessToken) return;
    setSaving(true);
    try {
      await api.put('/users/me/banner', { position: Math.round(tempPosition) }, { token: accessToken });
      const newBanner = { ...banner, position: Math.round(tempPosition) };
      onBannerChange(newBanner);
      updateUser({ banner: newBanner });
    } catch {
      // silently fail
    } finally {
      setSaving(false);
      setRepositioning(false);
    }
  };

  const handleRemove = async () => {
    if (!accessToken) return;
    setShowMenu(false);
    try {
      await api.delete('/users/me/banner', { token: accessToken });
      onBannerChange(null);
      updateUser({ banner: null });
    } catch {
      // silently fail
    }
  };

  const position = repositioning ? tempPosition : (banner?.position ?? 50);

  return (
    <div
      ref={bannerRef}
      className={`relative -mt-16 h-52 overflow-hidden sm:h-64 transition-all duration-300 ${repositioning
        ? `z-[51] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`
        : '-z-1'
        }`}
      onMouseDown={repositioning ? handleDragStart : undefined}
      onMouseMove={repositioning ? handleDrag : undefined}
      onTouchStart={repositioning ? handleDragStart : undefined}
      onTouchMove={repositioning ? handleDrag : undefined}
    >
      {/* Image or gradient */}
      {banner?.url ? (
        <img
          src={banner.url}
          alt="Banner"
          className="h-full w-full object-cover"
          style={{ objectPosition: `center ${position}%` }}
          draggable={false}
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-violet-600/40 via-fuchsia-600/30 to-indigo-600/40" />
      )}

      {/* Bottom gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent dark:from-[#0a0a0a]" />

      {/* Uploading overlay */}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {/* Reposition mode */}
      {repositioning && (
        <>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-3 bg-black/60 px-4 py-3 text-sm text-white">
            <span>Nhấn giữ và kéo để đặt lại vị trí</span>
            <button
              onClick={() => setRepositioning(false)}
              className="rounded border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
            >
              Hủy
            </button>
            <button
              onClick={savePosition}
              disabled={saving}
              className="rounded bg-violet-600 px-3 py-1 text-xs font-semibold hover:bg-violet-500 disabled:opacity-50 text-white"
            >
              {saving ? 'Lưu...' : 'Lưu'}
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-4 text-center text-xs text-white/80">
            ↕ Nhấn giữ chuột và kéo lên/xuống
          </div>
        </>
      )}

      {/* Edit button (only for own profile) */}
      {isOwnProfile && !repositioning && (
        <div className="absolute right-4 top-20" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 rounded bg-black/50 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur-sm transition-all hover:bg-black/70 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Chỉnh sửa ảnh bìa
          </button>

          {/* Dropdown */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 overflow-hidden rounded border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] py-1 shadow-xl z-50">
              <button
                onClick={() => { fileInputRef.current?.click(); }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer"
              >
                <span>📤</span> Tải ảnh lên
              </button>
              {banner?.url && (
                <>
                  <button
                    onClick={startReposition}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer"
                  >
                    <span>↕️</span> Đặt lại vị trí
                  </button>
                  <button
                    onClick={handleRemove}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer"
                  >
                    <span>🗑️</span> Gỡ ảnh
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
