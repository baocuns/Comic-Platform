'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { NewsItem } from 'shared';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { NewsEditor } from '@/components/studio/news-editor';

export default function EditNewsArticlePage() {
  const params = useParams();
  const id = params?.id as string;
  const { accessToken } = useAuthStore();
  const [article, setArticle] = useState<NewsItem | null>(null);

  useEffect(() => {
    if (!accessToken || !id) return;
    api
      .get<{ data: NewsItem }>(`/news/studio/${id}`, { token: accessToken })
      .then((res) => setArticle(res.data))
      .catch(() => {});
  }, [accessToken, id]);

  if (!article) return <div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />;
  return <NewsEditor initialArticle={article} />;
}
