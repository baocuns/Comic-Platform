'use client';

import { Modal } from './modal';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  isDanger?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Xác nhận',
  isDanger = true,
  isLoading = false,
}: ConfirmDialogProps) {
  const handleClose = () => {
    if (!isLoading) onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={title} maxWidthClass="max-w-md">
      <div className="space-y-5">
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
            Hủy bỏ
          </Button>
          <Button
            type="button"
            variant={isDanger ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
