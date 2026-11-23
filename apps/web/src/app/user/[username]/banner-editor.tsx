'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, MoveVertical, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
  bannerUrl: string | null;
  bannerPosition: number;
  isOwnProfile: boolean;
  onUpdated: (bannerUrl: string | null, position: number) => void;
}

export default function BannerEditor({ bannerUrl, bannerPosition, isOwnProfile, onUpdated }: Props) {
  const { accessToken, updateUser } = useAuthStore();
  const { toast } = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [repositioning, setRepositioning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tempPos, setTempPos] = useState(bannerPosition ?? 50);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    if (!repositioning) return;
    const onUp = () => setIsDragging(false);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
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
      const res = await api.upload<{ data: { url: string; position: number } }>(
        '/uploads/users/me/banner',
        formData,
        { token: accessToken },
      );
      onUpdated(res.data.url, res.data.position ?? 50);
      updateUser({ bannerUrl: res.data.url, bannerPosition: res.data.position ?? 50 });
      toast.success('Đã cập nhật ảnh bìa');
    } catch {
      toast.error('Không thể tải ảnh bìa lên');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging || !repositioning || !bannerRef.current) return;
      e.preventDefault();
      const rect = bannerRef.current.getBoundingClientRect();
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const pct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      setTempPos(pct);
    },
    [isDragging, repositioning],
  );

  const savePosition = async () => {
    if (!accessToken) return;
    setSaving(true);
    try {
      const rounded = Math.round(tempPos);
      await api.patch('/users/me/banner-position', { position: rounded }, { token: accessToken });
      onUpdated(bannerUrl, rounded);
      updateUser({ bannerPosition: rounded });
      toast.success('Đã lưu vị trí ảnh bìa');
    } catch {
      toast.error('Không thể lưu vị trí');
    } finally {
      setSaving(false);
      setRepositioning(false);
    }
  };

  const handleRemove = async () => {
    if (!accessToken || removing) return;
    setRemoving(true);
    try {
      await api.delete('/users/me/banner', { token: accessToken });
      onUpdated(null, 50);
      updateUser({ bannerUrl: null, bannerPosition: 50 });
      setConfirmRemoveOpen(false);
      toast.info('Đã gỡ ảnh bìa');
    } catch {
      toast.error('Không thể gỡ ảnh bìa');
    } finally {
      setRemoving(false);
    }
  };

  const activePos = repositioning ? tempPos : bannerPosition ?? 50;

  return (
    <div
      ref={bannerRef}
      className={`relative h-52 sm:h-64 overflow-hidden bg-[var(--bg-subtle)] ${
        repositioning ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
      }`}
      onMouseDown={repositioning ? () => setIsDragging(true) : undefined}
      onMouseMove={repositioning ? handleDrag : undefined}
      onTouchStart={repositioning ? () => setIsDragging(true) : undefined}
      onTouchMove={repositioning ? handleDrag : undefined}
    >
      {bannerUrl ? (
        <img
          src={bannerUrl}
          alt="Banner cá nhân"
          className="h-full w-full object-cover"
          style={{ objectPosition: `center ${activePos}%` }}
          draggable={false}
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-[#1B2340] via-[#3A417A] to-[#D96B52]/75" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--bg-canvas)] via-transparent to-transparent" />

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {repositioning && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-3 bg-black/65 px-4 py-2.5 text-xs text-white backdrop-blur-sm">
          <span>Kéo lên/xuống để căn chỉnh ảnh bìa</span>
          <button
            type="button"
            onClick={() => setRepositioning(false)}
            className="rounded-lg border border-white/25 px-3 py-1 hover:bg-white/10 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={savePosition}
            className="rounded-lg bg-[var(--accent-warm)] px-3 py-1 font-semibold hover:bg-[var(--accent-warm-hover)] cursor-pointer"
          >
            {saving ? 'Đang lưu...' : 'Lưu vị trí'}
          </button>
        </div>
      )}

      {isOwnProfile && !repositioning && (
        <div className="absolute right-4 top-4 z-20" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-black/75 cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Chỉnh ảnh bìa</span>
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1.5 w-48 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-1 shadow-xl">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                Tải ảnh bìa mới
              </button>
              {bannerUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setTempPos(bannerPosition ?? 50);
                      setRepositioning(true);
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <MoveVertical className="h-3.5 w-3.5" />
                    Căn chỉnh vị trí
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setConfirmRemoveOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)] cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Gỡ ảnh bìa
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

      <ConfirmDialog
        open={confirmRemoveOpen}
        onClose={() => setConfirmRemoveOpen(false)}
        onConfirm={handleRemove}
        title="Gỡ ảnh bìa?"
        description="Ảnh bìa hiện tại sẽ bị xóa khỏi hồ sơ cá nhân."
        confirmLabel="Gỡ ảnh bìa"
        isLoading={removing}
      />
    </div>
  );
}
