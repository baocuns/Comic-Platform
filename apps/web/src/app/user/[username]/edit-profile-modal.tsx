'use client';

import { useState } from 'react';
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
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl">
        <h2 className="mb-6 text-xl font-bold text-white">Chỉnh sửa hồ sơ</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">Tên hiển thị</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
              placeholder="Nhập tên hiển thị..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">Giới thiệu</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
              placeholder="Viết gì đó về bạn..."
            />
            <p className="mt-1 text-right text-xs text-zinc-600">{bio.length}/500</p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-400">Liên kết mạng xã hội</label>
            <div className="flex items-center gap-3">
              <span className="w-8 text-center text-lg">🌐</span>
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-500/50"
                placeholder="https://website.com" />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 text-center text-lg">𝕏</span>
              <input type="text" value={twitter} onChange={(e) => setTwitter(e.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-500/50"
                placeholder="@username" />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 text-center text-lg">📘</span>
              <input type="text" value={facebook} onChange={(e) => setFacebook(e.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-500/50"
                placeholder="facebook.com/username" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-white">
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:brightness-110 disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}
