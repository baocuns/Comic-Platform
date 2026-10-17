'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';

interface Props {
  onClose: () => void;
}

export default function EditProfileModal({ onClose }: Props) {
  const { user, updateProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [website, setWebsite] = useState(user?.socialLinks?.website || '');
  const [twitter, setTwitter] = useState(user?.socialLinks?.twitter || '');
  const [facebook, setFacebook] = useState(user?.socialLinks?.facebook || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(true);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 200);
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Tên hiển thị không được để trống');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const socialLinks: Record<string, string> = {};
      if (website.trim()) socialLinks.website = website.trim();
      if (twitter.trim()) socialLinks.twitter = twitter.trim();
      if (facebook.trim()) socialLinks.facebook = facebook.trim();

      await updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        socialLinks,
      });
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`relative w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#111] p-6 shadow-2xl transition-all duration-200 ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}>
        <h2 className="mb-6 text-xl font-bold text-zinc-900 dark:text-white">Chỉnh sửa hồ sơ</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-400">Tên hiển thị</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-2.5 text-sm text-zinc-900 dark:text-white outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              placeholder="Nhập tên hiển thị..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-400">Giới thiệu</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full resize-none rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-2.5 text-sm text-zinc-900 dark:text-white outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              placeholder="Viết gì đó về bạn..."
            />
            <p className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">{bio.length}/500</p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-400">Liên kết mạng xã hội</label>
            <div className="flex items-center gap-3">
              <span className="w-8 text-center text-lg">🌐</span>
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none transition-colors focus:border-amber-500/50"
                placeholder="https://website.com" />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 text-center text-lg">𝕏</span>
              <input type="text" value={twitter} onChange={(e) => setTwitter(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none transition-colors focus:border-amber-500/50"
                placeholder="@username" />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 text-center text-lg">📘</span>
              <input type="text" value={facebook} onChange={(e) => setFacebook(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none transition-colors focus:border-amber-500/50"
                placeholder="facebook.com/username" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={handleClose}
            className="flex-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-400 transition-colors hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white cursor-pointer">
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40 hover:brightness-110 disabled:opacity-50 cursor-pointer">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}
