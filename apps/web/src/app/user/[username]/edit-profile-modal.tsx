'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PenTool } from 'lucide-react';
import type { UserProfile } from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';

interface Props {
  user: UserProfile;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditProfileModal({ user, onClose, onUpdated }: Props) {
  const { accessToken, updateProfile } = useAuthStore();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || '');
  const [facebook, setFacebook] = useState(user.socialLinks?.facebook || '');
  const [website, setWebsite] = useState(user.socialLinks?.website || '');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        displayName,
        bio,
        socialLinks: {
          ...(facebook.trim() ? { facebook: facebook.trim() } : {}),
          ...(website.trim() ? { website: website.trim() } : {}),
        },
      });
      toast.success('Đã cập nhật hồ sơ!');
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newPassword) return;
    setChangingPass(true);
    try {
      await api.patch(
        '/auth/password',
        { currentPassword: currentPassword || undefined, newPassword },
        { token: accessToken },
      );
      toast.success('Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Đổi mật khẩu thất bại');
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Cài đặt hồ sơ cá nhân" maxWidthClass="max-w-xl">
      <div className="space-y-6">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Tên hiển thị"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <Textarea
            label="Giới thiệu bản thân"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Đôi lời giới thiệu về gu truyện hoặc hành trình sáng tác..."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Facebook"
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="https://facebook.com/..."
            />
            <Input
              label="Website / Portfolio"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Đóng
            </Button>
            <Button type="submit" isLoading={saving}>
              Lưu thông tin
            </Button>
          </div>
        </form>

        {user.role === 'READER' && (
          <div className="rounded-2xl border border-[var(--accent-warm)]/30 bg-[var(--accent-warm-soft)]/50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-bold text-[var(--text-primary)]">Muốn đăng truyện của riêng bạn?</h4>
              <p className="text-xs text-[var(--text-secondary)]">
                Gửi hồ sơ đăng ký để Admin xem xét và mở khóa Author Studio cho bạn.
              </p>
            </div>
            <Link href="/studio" onClick={onClose}>
              <Button size="sm" variant="warm">
                <PenTool className="h-3.5 w-3.5" />
                Gửi đơn đăng ký Tác giả
              </Button>
            </Link>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Đổi mật khẩu
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              type="password"
              label="Mật khẩu hiện tại"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Input
              type="password"
              label="Mật khẩu mới"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" isLoading={changingPass}>
            Cập nhật mật khẩu
          </Button>
        </form>
      </div>
    </Modal>
  );
}
