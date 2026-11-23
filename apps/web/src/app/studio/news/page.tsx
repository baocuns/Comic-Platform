'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Edit3, Trash2, Eye } from 'lucide-react';
import type { NewsItem } from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { APPROVAL_STATUS_LABEL, NEWS_CATEGORY_LABEL, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function StudioNewsPage() {
  const { accessToken } = useAuthStore();
  const { toast } = useToast();
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: NewsItem[] }>('/news/studio?limit=30', { token: accessToken });
      setArticles(res.data || []);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!accessToken || !deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/news/${deleteId}`, { token: accessToken });
      toast.info('Đã xóa bài viết');
      setDeleteId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xóa bài viết thất bại');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">Quản lý Tin tức</h1>
          <p className="text-sm text-[var(--text-secondary)]">Viết bài chia sẻ cộng đồng, sự kiện hoặc hậu trường tác phẩm.</p>
        </div>
        <Link href="/studio/news/new">
          <Button variant="warm">
            <Plus className="h-4 w-4" /> Soạn bài viết mới
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
      ) : articles.length === 0 ? (
        <Card className="py-12 text-center text-sm text-[var(--text-muted)]">Chưa có bài viết nào.</Card>
      ) : (
        <Card padded={false} className="divide-y divide-[var(--border-subtle)] overflow-hidden">
          {articles.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={a.isPublished ? 'success' : 'warning'}>
                    {a.isPublished ? 'Đã xuất bản' : APPROVAL_STATUS_LABEL[a.approvalStatus]}
                  </Badge>
                  <Badge variant="outline">{NEWS_CATEGORY_LABEL[a.category]}</Badge>
                </div>
                <p className="mt-1 truncate text-sm font-bold text-[var(--text-primary)]">{a.title}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {formatDate(a.createdAt)} · <Eye className="inline h-3 w-3" /> {a.viewCount} lượt xem
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/studio/news/${a.id}`}>
                  <Button size="xs" variant="secondary">
                    <Edit3 className="h-3.5 w-3.5" /> Sửa
                  </Button>
                </Link>
                <Button size="xs" variant="ghost" onClick={() => setDeleteId(a.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-[var(--danger)]" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Xóa bài viết?"
        description="Bài viết này sẽ bị gỡ khỏi hệ thống và không thể khôi phục từ Studio."
        confirmLabel="Xóa bài viết"
        isLoading={deleting}
      />
    </div>
  );
}
