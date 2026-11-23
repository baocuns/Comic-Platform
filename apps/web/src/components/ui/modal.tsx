'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

const modalStack: symbol[] = [];
let scrollLockCount = 0;
let previousBodyOverflow = '';

export function Modal({
  open,
  onClose,
  title,
  description,
  maxWidthClass = 'max-w-lg',
  children,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const modalId = Symbol('modal');
    modalStack.push(modalId);

    if (scrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLockCount += 1;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === modalId) {
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const idx = modalStack.lastIndexOf(modalId);
      if (idx !== -1) modalStack.splice(idx, 1);

      scrollLockCount = Math.max(0, scrollLockCount - 1);
      if (scrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-fade-in"
      onClick={() => onCloseRef.current()}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[88vh] w-full ${maxWidthClass} flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-2xl animate-slide-up`}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4">
            <div>
              {title && <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>}
              {description && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>}
            </div>
            <button
              type="button"
              onClick={() => onCloseRef.current()}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
