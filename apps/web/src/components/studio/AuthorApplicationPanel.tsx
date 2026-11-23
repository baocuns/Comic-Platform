'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  PenTool,
  RefreshCw,
  Send,
} from 'lucide-react';
import { AuthorApplicationStatus, type AuthorApplicationItem } from 'shared';
import { api, ApiError } from '@/lib/api-client';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/providers/toast-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';

export function AuthorApplicationPanel() {
  const { user, accessToken, fetchProfile } = useAuthStore();
  const { toast } = useToast();

  const [application, setApplication] = useState<AuthorApplicationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);

  // Form fields
  const [penName, setPenName] = useState('');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [sampleWorkTitle, setSampleWorkTitle] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [sampleWorkLink, setSampleWorkLink] = useState('');
  const [formError, setFormError] = useState('');

  const loadApplication = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<{ data: AuthorApplicationItem | null }>(
        '/users/me/author-application',
        { token: accessToken },
      );
      const data = res.data || null;
      setApplication(data);
      if (
        data?.status === AuthorApplicationStatus.REJECTED ||
        (data?.status === AuthorApplicationStatus.APPROVED && user?.role === 'READER')
      ) {
        setPenName(data.penName || user?.displayName || '');
        setBio(data.bio || '');
        setExperience(data.experience || '');
        setSampleWorkTitle(data.sampleWorkTitle || '');
        setPortfolioUrl(data.portfolioUrl || '');
        setSampleWorkLink(data.sampleWorkLink || '');
      } else if (!data && user?.displayName) {
        setPenName((prev) => prev || user.displayName);
      }
    } catch {
      // Ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.displayName]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  const handleRefreshStatus = async () => {
    setChecking(true);
    try {
      await Promise.all([fetchProfile(), loadApplication()]);
      toast.info('Đã cập nhật trạng thái xét duyệt mới nhất');
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setFormError('');

    if (penName.trim().length < 2) {
      setFormError('Bút danh cần tối thiểu 2 ký tự.');
      return;
    }
    if (bio.trim().length < 20) {
      setFormError('Phần giới thiệu bản thân & định hướng sáng tác cần tối thiểu 20 ký tự.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ data: AuthorApplicationItem }>(
        '/users/me/author-application',
        {
          penName: penName.trim(),
          bio: bio.trim(),
          experience: experience.trim() || undefined,
          sampleWorkTitle: sampleWorkTitle.trim() || undefined,
          portfolioUrl: portfolioUrl.trim() || undefined,
          sampleWorkLink: sampleWorkLink.trim() || undefined,
        },
        { token: accessToken },
      );
      setApplication(res.data);
      toast.success('Đã gửi đơn đăng ký Tác giả! Vui lòng chờ Admin xét duyệt.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Gửi đơn thất bại, vui lòng thử lại.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl p-6 space-y-4">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-[var(--bg-subtle)]" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
      </Card>
    );
  }

  if (application?.status === AuthorApplicationStatus.PENDING) {
    return (
      <Card className="w-full max-w-2xl space-y-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
                Đơn đăng ký đang chờ phê duyệt
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Gửi lúc {formatDate(application.createdAt)} ({formatRelativeTime(application.createdAt)})
              </p>
            </div>
          </div>
          <Badge variant="warning">Chờ Admin duyệt</Badge>
        </div>

        <div className="rounded-2xl border border-[var(--accent-primary)]/25 bg-[var(--accent-primary-soft)]/50 p-4 text-sm text-[var(--text-secondary)] leading-relaxed">
          Hồ sơ của bạn đã được chuyển tới đội ngũ Quản trị viên OWOC. Ngay khi Admin phê duyệt, bạn sẽ nhận thông báo và có thể mở Author Studio để đăng truyện.
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4 space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)]">Bút danh</p>
              <p className="font-bold text-[var(--text-primary)]">{application.penName}</p>
            </div>
            {application.sampleWorkTitle && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)]">Tác phẩm dự kiến</p>
                <p className="font-medium text-[var(--text-primary)]">{application.sampleWorkTitle}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)]">Giới thiệu & định hướng</p>
            <p className="mt-1 whitespace-pre-line text-[var(--text-primary)]">{application.bio}</p>
          </div>

          {application.experience && (
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)]">Kinh nghiệm sáng tác</p>
              <p className="mt-1 whitespace-pre-line text-[var(--text-secondary)]">
                {application.experience}
              </p>
            </div>
          )}

          {(application.portfolioUrl || application.sampleWorkLink) && (
            <div className="flex flex-wrap gap-3 pt-1">
              {application.portfolioUrl &&
                (/^https?:\/\//i.test(application.portfolioUrl) ? (
                  <a
                    href={application.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Portfolio / Trang cá nhân
                  </a>
                ) : (
                  <span className="text-xs text-[var(--text-secondary)]">
                    Portfolio: {application.portfolioUrl}
                  </span>
                ))}
              {application.sampleWorkLink &&
                (/^https?:\/\//i.test(application.sampleWorkLink) ? (
                  <a
                    href={application.sampleWorkLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-warm)] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Liên kết bản mẫu
                  </a>
                ) : (
                  <span className="text-xs text-[var(--text-secondary)]">
                    Bản mẫu: {application.sampleWorkLink}
                  </span>
                ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Link href="/">
            <Button variant="ghost">Quay lại trang chủ</Button>
          </Link>
          <Button variant="primary" isLoading={checking} onClick={handleRefreshStatus}>
            <RefreshCw className="h-4 w-4" />
            <span>Kiểm tra trạng thái duyệt</span>
          </Button>
        </div>
      </Card>
    );
  }

  if (application?.status === AuthorApplicationStatus.APPROVED && user?.role !== 'READER') {
    return (
      <Card className="w-full max-w-lg text-center space-y-4 p-6 sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--success-soft)] text-[var(--success)]">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
          Đơn đăng ký Tác giả đã được duyệt!
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Nhấn nút bên dưới để đồng bộ lại phiên tài khoản và bước vào Author Studio.
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="warm" isLoading={checking} onClick={handleRefreshStatus}>
            Mở Author Studio
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl space-y-5 p-6 sm:p-8">
      <div className="flex items-start gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]">
          <PenTool className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
            Đăng ký trở thành Tác giả OWOC
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Điền thông tin hồ sơ sáng tác bên dưới. Quản trị viên sẽ xem xét và phê duyệt trước khi mở quyền Author Studio.
          </p>
        </div>
      </div>

      {application?.status === AuthorApplicationStatus.APPROVED && user?.role === 'READER' && (
        <div className="rounded-2xl border border-[var(--warning)]/35 bg-[var(--warning-soft)] p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--warning)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Quyền Tác giả hiện đang tạm ngưng hoặc đã được điều chỉnh về Độc giả</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Bạn có thể cập nhật thông tin và gửi lại đơn đăng ký xét duyệt Tác giả bên dưới.
          </p>
        </div>
      )}

      {application?.status === AuthorApplicationStatus.REJECTED && (
        <div className="rounded-2xl border border-[var(--danger)]/35 bg-[var(--danger-soft)] p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--danger)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Đơn trước đó chưa được chấp thuận
              {application.reviewer ? ` (${application.reviewer.displayName})` : ''}
            </span>
          </div>
          {application.reviewNote && (
            <p className="text-sm text-[var(--text-primary)]">Lý do: {application.reviewNote}</p>
          )}
          <p className="text-xs text-[var(--text-secondary)]">
            Bạn có thể chỉnh sửa hồ sơ và gửi lại để Admin xem xét.
          </p>
        </div>
      )}

      {formError && (
        <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3.5 py-2.5 text-xs font-semibold text-[var(--danger)]">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Bút danh sáng tác *"
            value={penName}
            onChange={(e) => setPenName(e.target.value)}
            placeholder="Ví dụ: Mặc Vân Sư"
            required
          />
          <Input
            label="Tên tác phẩm dự kiến (tùy chọn)"
            value={sampleWorkTitle}
            onChange={(e) => setSampleWorkTitle(e.target.value)}
            placeholder="Ví dụ: Vân Sơn Kiếm Lộ"
          />
        </div>

        <Textarea
          label={`Giới thiệu bản thân & kế hoạch sáng tác * (${bio.trim().length}/20+ ký tự)`}
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Chia sẻ phong cách vẽ/kịch bản, thể loại sở trường và dự định ra mắt truyện trên OWOC..."
          required
        />

        <Textarea
          label="Kinh nghiệm sáng tác / Nhóm dịch (tùy chọn)"
          rows={2}
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          placeholder="Từng tham gia sáng tác, minh họa webtoon/truyện tranh hoặc biên tập truyện..."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Link Portfolio / Mạng xã hội (tùy chọn)"
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
            placeholder="https://behance.net/... hoặc Facebook/X"
          />
          <Input
            label="Link bản thảo / Tranh mẫu (tùy chọn)"
            value={sampleWorkLink}
            onChange={(e) => setSampleWorkLink(e.target.value)}
            placeholder="https://drive.google.com/..."
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Link href="/">
            <Button type="button" variant="ghost">
              Quay lại
            </Button>
          </Link>
          <Button type="submit" variant="warm" isLoading={submitting}>
            <Send className="h-4 w-4" />
            <span>Gửi hồ sơ chờ Admin phê duyệt</span>
          </Button>
        </div>
      </form>
    </Card>
  );
}
