'use client';

import { useState } from 'react';
import { ReportReason, ReportTargetType } from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { Modal } from './modal';
import { Button } from './button';
import { Textarea } from './input';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
}

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: ReportReason.COPYRIGHT, label: 'Vi phạm bản quyền' },
  { value: ReportReason.INAPPROPRIATE, label: 'Nội dung phản cảm / không phù hợp' },
  { value: ReportReason.SPAM, label: 'Spam / Quảng cáo rác' },
  { value: ReportReason.HARASSMENT, label: 'Quấy rối / Công kích cá nhân' },
  { value: ReportReason.OTHER, label: 'Lý do khác' },
];

export function ReportModal({ open, onClose, targetType, targetId, targetLabel }: ReportModalProps) {
  const { accessToken } = useAuthStore();
  const { toast } = useToast();
  const [reason, setReason] = useState<ReportReason>(ReportReason.INAPPROPRIATE);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      toast.error('Vui lòng đăng nhập để gửi báo cáo');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(
        '/reports',
        { targetType, targetId, reason, description: description.trim() || undefined },
        { token: accessToken },
      );
      toast.success('Đã gửi báo cáo tới ban quản trị. Cảm ơn bạn!');
      setDescription('');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không thể gửi báo cáo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Báo cáo vi phạm"
      description={targetLabel ? `Đối tượng: ${targetLabel}` : 'Thông tin của bạn sẽ được đội ngũ kiểm duyệt xem xét'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-[var(--text-secondary)]">Chọn lý do</label>
          <div className="grid gap-2">
            {REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-sm cursor-pointer transition-colors ${
                  reason === r.value
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)] font-medium'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <input
                  type="radio"
                  name="report_reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-[var(--accent-primary)]"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        <Textarea
          label="Chi tiết bổ sung (tùy chọn)"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả rõ hơn vấn đề bạn gặp phải..."
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" variant="warm" isLoading={submitting}>
            Gửi báo cáo
          </Button>
        </div>
      </form>
    </Modal>
  );
}
