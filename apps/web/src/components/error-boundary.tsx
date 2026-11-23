'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] px-4 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Đã có sự cố hiển thị</h2>
          <p className="mt-1 max-w-md text-sm text-[var(--text-secondary)]">
            Vui lòng tải lại trang để khôi phục phiên làm việc.
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Tải lại trang
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
