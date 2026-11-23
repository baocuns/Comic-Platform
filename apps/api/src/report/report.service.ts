import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ApprovalStatus,
  ComicStatus,
  ContentRating,
  ModerationTargetType,
  NotificationType,
  Prisma,
  ReportReason,
  ReportResolutionAction,
  ReportStatus,
  ReportTargetType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { GenreService } from '../genre/genre.service';
import { CreateReportDto, ReportQueryDto, ResolveReportDto } from './dto/report.dto';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.READER]: 0,
  [UserRole.AUTHOR]: 1,
  [UserRole.MODERATOR]: 2,
  [UserRole.ADMIN]: 3,
};

const ALLOWED_ACTIONS_BY_TARGET: Record<ReportTargetType, ReportResolutionAction[]> = {
  [ReportTargetType.COMIC]: [
    ReportResolutionAction.NONE,
    ReportResolutionAction.WARN_USER,
    ReportResolutionAction.HIDE_CONTENT,
    ReportResolutionAction.MARK_MATURE,
    ReportResolutionAction.DELETE_CONTENT,
    ReportResolutionAction.REVOKE_TRUST,
    ReportResolutionAction.BAN_USER,
  ],
  [ReportTargetType.CHAPTER]: [
    ReportResolutionAction.NONE,
    ReportResolutionAction.WARN_USER,
    ReportResolutionAction.HIDE_CONTENT,
    ReportResolutionAction.DELETE_CONTENT,
    ReportResolutionAction.REVOKE_TRUST,
    ReportResolutionAction.BAN_USER,
  ],
  [ReportTargetType.COMMENT]: [
    ReportResolutionAction.NONE,
    ReportResolutionAction.WARN_USER,
    ReportResolutionAction.MARK_SPOILER,
    ReportResolutionAction.DELETE_CONTENT,
    ReportResolutionAction.BAN_USER,
  ],
  [ReportTargetType.NEWS_COMMENT]: [
    ReportResolutionAction.NONE,
    ReportResolutionAction.WARN_USER,
    ReportResolutionAction.DELETE_CONTENT,
    ReportResolutionAction.BAN_USER,
  ],
  [ReportTargetType.USER]: [
    ReportResolutionAction.NONE,
    ReportResolutionAction.WARN_USER,
    ReportResolutionAction.REVOKE_TRUST,
    ReportResolutionAction.BAN_USER,
  ],
};

const ACTIONS_REQUIRING_NOTE = new Set<ReportResolutionAction>([
  ReportResolutionAction.HIDE_CONTENT,
  ReportResolutionAction.DELETE_CONTENT,
  ReportResolutionAction.WARN_USER,
  ReportResolutionAction.REVOKE_TRUST,
  ReportResolutionAction.BAN_USER,
]);

const ACTION_LABEL_VI: Record<ReportResolutionAction, string> = {
  [ReportResolutionAction.NONE]: 'Ghi nhận xử lý',
  [ReportResolutionAction.WARN_USER]: 'Gửi cảnh cáo tới người vi phạm',
  [ReportResolutionAction.HIDE_CONTENT]: 'Ẩn / gỡ duyệt nội dung',
  [ReportResolutionAction.DELETE_CONTENT]: 'Xóa nội dung vi phạm',
  [ReportResolutionAction.MARK_MATURE]: 'Gắn nhãn giới hạn độ tuổi (18+)',
  [ReportResolutionAction.MARK_SPOILER]: 'Gắn thẻ Spoiler cho bình luận',
  [ReportResolutionAction.REVOKE_TRUST]: 'Thu hồi chứng nhận Tác giả Uy tín',
  [ReportResolutionAction.BAN_USER]: 'Khóa tài khoản vi phạm',
};

const REASON_LABEL_VI: Record<ReportReason, string> = {
  [ReportReason.COPYRIGHT]: 'Vi phạm bản quyền',
  [ReportReason.INAPPROPRIATE]: 'Nội dung phản cảm / không phù hợp',
  [ReportReason.SPAM]: 'Spam / Quảng cáo rác',
  [ReportReason.HARASSMENT]: 'Quấy rối / Công kích cá nhân',
  [ReportReason.OTHER]: 'Lý do khác',
};

const OWNER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  isTrusted: true,
  isBanned: true,
  bannedUntil: true,
} satisfies Prisma.UserSelect;

const REPORT_USER_INCLUDES = {
  reporter: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  resolver: { select: { id: true, username: true, displayName: true } },
} satisfies Prisma.ReportInclude;

type OwnerRow = Prisma.UserGetPayload<{ select: typeof OWNER_SELECT }>;
type ReportWithUsers = Prisma.ReportGetPayload<{ include: typeof REPORT_USER_INCLUDES }>;

interface TargetOwnerPayload {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  isTrusted: boolean;
  isBanned: boolean;
  bannedUntil: string | null;
}

export interface HydratedTargetPreview {
  exists: boolean;
  isDeleted: boolean;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  thumbnailUrl?: string | null;
  linkUrl?: string | null;
  studioUrl?: string | null;
  statusBadge?: string | null;
  contentRating?: ContentRating | null;
  isSpoiler?: boolean;
  pagesPreview?: Array<{ pageNumber: number; imageUrl: string }>;
  owner?: TargetOwnerPayload | null;
}

interface TargetContext {
  targetType: ReportTargetType;
  targetId: string;
  isDeleted: boolean;
  title: string;
  publicUrl: string | null;
  studioUrl: string | null;
  owner: { id: string; role: UserRole; displayName: string } | null;
  comic?: {
    id: string;
    slug: string;
    title: string;
    genreIds: string[];
    deletedAt: Date | null;
  };
  chapter?: {
    id: string;
    comicId: string;
    comicSlug: string;
    comicTitle: string;
    number: number;
    deletedAt: Date | null;
  };
  comment?: {
    id: string;
    comicId: string;
    comicSlug: string;
    deletedAt: Date | null;
  };
  newsComment?: {
    id: string;
    articleId: string;
    deletedAt: Date | null;
  };
}

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationService: NotificationService,
    private readonly genreService: GenreService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private disconnectUserSockets(userId: string) {
    try {
      const gateway = this.moduleRef.get(NotificationGateway, { strict: false });
      gateway?.disconnectUser(userId);
    } catch {
      // Gateway unavailable outside server bootstrap
    }
  }

  async create(reporterId: string, dto: CreateReportDto) {
    if (dto.targetType === ReportTargetType.USER && dto.targetId === reporterId) {
      throw new BadRequestException('Bạn không thể tự báo cáo chính mình');
    }

    await this.assertTargetExists(dto.targetType, dto.targetId);

    const existingOpen = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: ReportStatus.PENDING,
      },
    });

    if (existingOpen) {
      throw new ConflictException('Bạn đã gửi báo cáo cho nội dung này và đang chờ xử lý');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        description: dto.description?.trim() || null,
      },
    });

    this.notifyModeratorsOfNewReport(report, reporterId).catch(() => {});

    return report;
  }

  async findAll(query: ReportQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.ReportWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.targetType) where.targetType = query.targetType;

    const [items, total, statusGroups] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: REPORT_USER_INCLUDES,
      }),
      this.prisma.report.count({ where }),
      this.prisma.report.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const summary = { pending: 0, resolved: 0, dismissed: 0, total: 0 };
    for (const row of statusGroups) {
      const count = row._count._all;
      summary.total += count;
      if (row.status === ReportStatus.PENDING) summary.pending = count;
      else if (row.status === ReportStatus.RESOLVED) summary.resolved = count;
      else if (row.status === ReportStatus.DISMISSED) summary.dismissed = count;
    }

    const hydrated = await this.hydrateReports(items);

    return {
      data: hydrated,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        summary,
      },
    };
  }

  async resolve(
    reportId: string,
    resolverId: string,
    resolverRole: UserRole,
    dto: ResolveReportDto,
  ) {
    if (dto.status === ReportStatus.PENDING) {
      throw new BadRequestException('Trạng thái xử lý phải là RESOLVED hoặc DISMISSED');
    }

    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Không tìm thấy báo cáo');
    }
    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Báo cáo này đã được xử lý trước đó');
    }

    let action = dto.action ?? ReportResolutionAction.NONE;
    const rawNote = dto.resolutionNote?.trim() || '';

    if (dto.status === ReportStatus.DISMISSED) {
      if (dto.action && dto.action !== ReportResolutionAction.NONE) {
        throw new BadRequestException('Khi bỏ qua báo cáo không thể áp dụng biện pháp xử lý');
      }
      action = ReportResolutionAction.NONE;
    } else {
      const allowedActions = ALLOWED_ACTIONS_BY_TARGET[report.targetType] || [];
      if (!allowedActions.includes(action)) {
        throw new BadRequestException('Biện pháp xử lý không phù hợp với loại báo cáo này');
      }
      if (ACTIONS_REQUIRING_NOTE.has(action) && !rawNote) {
        throw new BadRequestException('Vui lòng nhập lý do / ghi chú xử lý');
      }
    }

    const finalNote =
      rawNote ||
      (dto.status === ReportStatus.DISMISSED
        ? 'Không đủ căn cứ vi phạm'
        : 'Đã xem xét và xử lý báo cáo');

    let targetCtx: TargetContext | null = await this.loadTargetContext(
      report.targetType,
      report.targetId,
    );

    if (targetCtx?.owner && targetCtx.owner.id === resolverId) {
      throw new ForbiddenException(
        'Không thể tự xử lý hoặc bỏ qua báo cáo nhắm vào nội dung hoặc tài khoản của chính bạn',
      );
    }

    if (dto.status === ReportStatus.RESOLVED && action !== ReportResolutionAction.NONE) {
      if (!targetCtx) {
        throw new NotFoundException('Đối tượng bị báo cáo không còn tồn tại trong hệ thống');
      }

      if (action === ReportResolutionAction.BAN_USER) {
        if (!targetCtx.owner) {
          throw new BadRequestException('Không xác định được tài khoản vi phạm');
        }
        if (ROLE_HIERARCHY[resolverRole] <= ROLE_HIERARCHY[targetCtx.owner.role]) {
          throw new ForbiddenException(
            'Bạn không đủ quyền hạn để khóa tài khoản có vai trò ngang hoặc cao hơn',
          );
        }
        if (!dto.banDurationDays && resolverRole !== UserRole.ADMIN) {
          throw new ForbiddenException('Chỉ Quản trị viên (ADMIN) mới được khóa tài khoản vĩnh viễn');
        }
        if (resolverRole !== UserRole.ADMIN && dto.banDurationDays && dto.banDurationDays > 30) {
          throw new BadRequestException('Kiểm duyệt viên chỉ có thể tạm khóa tối đa 30 ngày');
        }
      } else {
        if (
          targetCtx.owner &&
          resolverRole !== UserRole.ADMIN &&
          ROLE_HIERARCHY[resolverRole] <= ROLE_HIERARCHY[targetCtx.owner.role]
        ) {
          throw new ForbiddenException(
            'Bạn không đủ quyền hạn để xử lý nội dung hoặc tài khoản có vai trò ngang/cao hơn',
          );
        }
        if (action === ReportResolutionAction.REVOKE_TRUST && !targetCtx.owner) {
          throw new BadRequestException('Không xác định được tài khoản tác giả');
        }
        if (action === ReportResolutionAction.WARN_USER && !targetCtx.owner) {
          throw new BadRequestException('Không xác định được người nhận cảnh cáo');
        }
      }
    }

    const now = new Date();
    const shouldResolveRelated =
      dto.resolveRelated ??
      (dto.status === ReportStatus.RESOLVED && action !== ReportResolutionAction.NONE);

    let affectedGenreIds: string[] = [];
    let comicSlugToInvalidate: string | null = null;
    let shouldInvalidateListings = false;
    let deletedContentApplied = false;
    let bannedUserId: string | null = null;

    const txResult = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.report.updateMany({
        where: { id: reportId, status: ReportStatus.PENDING },
        data: {
          status: dto.status,
          resolutionAction: action,
          resolvedBy: resolverId,
          resolvedAt: now,
          resolutionNote: finalNote,
        },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('Báo cáo này đã được xử lý trước đó');
      }

      if (dto.status === ReportStatus.RESOLVED && action !== ReportResolutionAction.NONE && targetCtx) {
        if (action === ReportResolutionAction.BAN_USER && targetCtx.owner) {
          const bannedUntil = dto.banDurationDays
            ? new Date(now.getTime() + dto.banDurationDays * 86_400_000)
            : null;
          await tx.user.update({
            where: { id: targetCtx.owner.id },
            data: {
              isBanned: true,
              bannedReason: finalNote,
              bannedUntil,
            },
          });
          await tx.refreshSession.updateMany({
            where: { userId: targetCtx.owner.id, revokedAt: null },
            data: { revokedAt: now },
          });
          bannedUserId = targetCtx.owner.id;

          if (dto.alsoDeleteContent && report.targetType !== ReportTargetType.USER) {
            const delMeta = await this.applyDeleteContent(tx, targetCtx, resolverId, finalNote, now);
            affectedGenreIds.push(...delMeta.affectedGenreIds);
            if (delMeta.comicSlug) comicSlugToInvalidate = delMeta.comicSlug;
            if (delMeta.invalidateListings) shouldInvalidateListings = true;
            deletedContentApplied = true;
          }
        } else if (action === ReportResolutionAction.REVOKE_TRUST && targetCtx.owner) {
          await tx.user.update({
            where: { id: targetCtx.owner.id },
            data: { isTrusted: false, trustRevokedAt: now },
          });
        } else if (action === ReportResolutionAction.HIDE_CONTENT) {
          if (targetCtx.comic) {
            await tx.comic.update({
              where: { id: targetCtx.comic.id },
              data: { approvalStatus: ApprovalStatus.REJECTED, rejectionReason: finalNote },
            });
            await tx.moderationLog.create({
              data: {
                targetType: ModerationTargetType.COMIC,
                targetId: targetCtx.comic.id,
                targetTitle: targetCtx.comic.title,
                action: ApprovalStatus.REJECTED,
                reason: finalNote,
                moderatorId: resolverId,
              },
            });
            affectedGenreIds.push(...targetCtx.comic.genreIds);
            comicSlugToInvalidate = targetCtx.comic.slug;
            shouldInvalidateListings = true;
          } else if (targetCtx.chapter) {
            await tx.chapter.update({
              where: { id: targetCtx.chapter.id },
              data: { approvalStatus: ApprovalStatus.REJECTED, rejectionReason: finalNote },
            });
            await this.syncComicChapterCounters(tx, targetCtx.chapter.comicId);
            await tx.moderationLog.create({
              data: {
                targetType: ModerationTargetType.CHAPTER,
                targetId: targetCtx.chapter.id,
                targetTitle: targetCtx.title,
                action: ApprovalStatus.REJECTED,
                reason: finalNote,
                moderatorId: resolverId,
              },
            });
            comicSlugToInvalidate = targetCtx.chapter.comicSlug;
            shouldInvalidateListings = true;
          }
        } else if (action === ReportResolutionAction.MARK_MATURE && targetCtx.comic) {
          await tx.comic.update({
            where: { id: targetCtx.comic.id },
            data: { contentRating: ContentRating.MATURE },
          });
          comicSlugToInvalidate = targetCtx.comic.slug;
          shouldInvalidateListings = true;
        } else if (action === ReportResolutionAction.MARK_SPOILER && targetCtx.comment) {
          await tx.comment.update({
            where: { id: targetCtx.comment.id },
            data: { isSpoiler: true },
          });
        } else if (action === ReportResolutionAction.DELETE_CONTENT) {
          const delMeta = await this.applyDeleteContent(tx, targetCtx, resolverId, finalNote, now);
          affectedGenreIds.push(...delMeta.affectedGenreIds);
          if (delMeta.comicSlug) comicSlugToInvalidate = delMeta.comicSlug;
          if (delMeta.invalidateListings) shouldInvalidateListings = true;
          deletedContentApplied = true;
        }
      }

      const updatedReport = await tx.report.findUniqueOrThrow({
        where: { id: reportId },
        include: REPORT_USER_INCLUDES,
      });

      let relatedPending: Array<{ id: string; reporterId: string }> = [];
      if (shouldResolveRelated) {
        relatedPending = await tx.report.findMany({
          where: {
            targetType: report.targetType,
            targetId: report.targetId,
            status: ReportStatus.PENDING,
            id: { not: report.id },
          },
          select: { id: true, reporterId: true },
        });
        if (relatedPending.length > 0) {
          await tx.report.updateMany({
            where: { id: { in: relatedPending.map((r) => r.id) } },
            data: {
              status: dto.status,
              resolutionAction: action,
              resolvedBy: resolverId,
              resolvedAt: now,
              resolutionNote: finalNote,
            },
          });
        }
      }

      return { updatedReport, relatedPending };
    });

    if (bannedUserId) {
      this.disconnectUserSockets(bannedUserId);
    }

    if (affectedGenreIds.length > 0) {
      await this.genreService.recalculateCounts(Array.from(new Set(affectedGenreIds))).catch(() => {});
    }
    if (comicSlugToInvalidate) {
      await this.redis.del(`comic:${comicSlugToInvalidate}`).catch(() => {});
    }
    if (shouldInvalidateListings) {
      await Promise.all([
        this.redis.deletePattern('homepage*').catch(() => {}),
        this.redis.deletePattern('rankings*').catch(() => {}),
      ]);
    }

    await this.dispatchResolutionNotifications({
      report,
      status: dto.status,
      action,
      note: finalNote,
      resolverId,
      banDurationDays: dto.banDurationDays,
      deletedContentApplied,
      targetCtx,
      relatedReporterIds: txResult.relatedPending.map((r) => r.reporterId),
    }).catch(() => {});

    const [hydrated] = await this.hydrateReports([txResult.updatedReport]);
    return {
      ...hydrated,
      closedRelatedCount: txResult.relatedPending.length,
    };
  }

  private async applyDeleteContent(
    tx: Prisma.TransactionClient,
    ctx: TargetContext,
    resolverId: string,
    note: string,
    now: Date,
  ): Promise<{ affectedGenreIds: string[]; comicSlug?: string; invalidateListings: boolean }> {
    if (ctx.comic) {
      if (!ctx.comic.deletedAt) {
        await tx.comic.update({
          where: { id: ctx.comic.id },
          data: { deletedAt: now },
        });
        await tx.moderationLog.create({
          data: {
            targetType: ModerationTargetType.COMIC,
            targetId: ctx.comic.id,
            targetTitle: ctx.comic.title,
            action: ApprovalStatus.REJECTED,
            reason: note,
            moderatorId: resolverId,
          },
        });
      }
      return {
        affectedGenreIds: ctx.comic.genreIds,
        comicSlug: ctx.comic.slug,
        invalidateListings: true,
      };
    }

    if (ctx.chapter) {
      if (!ctx.chapter.deletedAt) {
        await tx.chapter.update({
          where: { id: ctx.chapter.id },
          data: { deletedAt: now },
        });
        await tx.moderationLog.create({
          data: {
            targetType: ModerationTargetType.CHAPTER,
            targetId: ctx.chapter.id,
            targetTitle: ctx.title,
            action: ApprovalStatus.REJECTED,
            reason: note,
            moderatorId: resolverId,
          },
        });
      }
      await this.syncComicChapterCounters(tx, ctx.chapter.comicId);
      return {
        affectedGenreIds: [],
        comicSlug: ctx.chapter.comicSlug,
        invalidateListings: true,
      };
    }

    if (ctx.comment) {
      if (!ctx.comment.deletedAt) {
        await tx.comment.update({
          where: { id: ctx.comment.id },
          data: { deletedAt: now },
        });
        await tx.comment.updateMany({
          where: { parentId: ctx.comment.id, deletedAt: null },
          data: { deletedAt: now },
        });
      }
      const activeCount = await tx.comment.count({
        where: { comicId: ctx.comment.comicId, deletedAt: null },
      });
      await tx.comic.update({
        where: { id: ctx.comment.comicId },
        data: { totalComments: activeCount },
      });
      return { affectedGenreIds: [], comicSlug: ctx.comment.comicSlug, invalidateListings: false };
    }

    if (ctx.newsComment) {
      if (!ctx.newsComment.deletedAt) {
        await tx.newsComment.update({
          where: { id: ctx.newsComment.id },
          data: { deletedAt: now },
        });
        await tx.newsComment.updateMany({
          where: { parentId: ctx.newsComment.id, deletedAt: null },
          data: { deletedAt: now },
        });
      }
      const activeCount = await tx.newsComment.count({
        where: { articleId: ctx.newsComment.articleId, deletedAt: null },
      });
      await tx.newsArticle.update({
        where: { id: ctx.newsComment.articleId },
        data: { commentsCount: activeCount },
      });
      return { affectedGenreIds: [], invalidateListings: false };
    }

    return { affectedGenreIds: [], invalidateListings: false };
  }

  private async syncComicChapterCounters(tx: Prisma.TransactionClient, comicId: string) {
    const approved = await tx.chapter.findMany({
      where: { comicId, deletedAt: null, approvalStatus: ApprovalStatus.APPROVED },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    });
    await tx.comic.update({
      where: { id: comicId },
      data: {
        totalChapters: approved.length,
        lastChapterAt: approved[0]?.publishedAt || null,
      },
    });
  }

  private async assertTargetExists(targetType: ReportTargetType, targetId: string) {
    if (targetType === ReportTargetType.COMIC) {
      const comic = await this.prisma.comic.findUnique({
        where: { id: targetId },
        select: { id: true, deletedAt: true, approvalStatus: true, status: true },
      });
      if (
        !comic ||
        comic.deletedAt ||
        comic.approvalStatus !== ApprovalStatus.APPROVED ||
        comic.status === ComicStatus.DRAFT
      ) {
        throw new NotFoundException('Không tìm thấy truyện để báo cáo');
      }
      return;
    }
    if (targetType === ReportTargetType.CHAPTER) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          deletedAt: true,
          approvalStatus: true,
          comic: { select: { deletedAt: true, approvalStatus: true, status: true } },
        },
      });
      if (
        !chapter ||
        chapter.deletedAt ||
        chapter.comic.deletedAt ||
        chapter.approvalStatus !== ApprovalStatus.APPROVED ||
        chapter.comic.approvalStatus !== ApprovalStatus.APPROVED ||
        chapter.comic.status === ComicStatus.DRAFT
      ) {
        throw new NotFoundException('Không tìm thấy chương truyện để báo cáo');
      }
      return;
    }
    if (targetType === ReportTargetType.COMMENT) {
      const comment = await this.prisma.comment.findUnique({
        where: { id: targetId },
        select: { id: true, deletedAt: true },
      });
      if (!comment || comment.deletedAt) {
        throw new NotFoundException('Không tìm thấy bình luận để báo cáo');
      }
      return;
    }
    if (targetType === ReportTargetType.NEWS_COMMENT) {
      const nc = await this.prisma.newsComment.findUnique({
        where: { id: targetId },
        select: { id: true, deletedAt: true },
      });
      if (!nc || nc.deletedAt) {
        throw new NotFoundException('Không tìm thấy bình luận tin tức để báo cáo');
      }
      return;
    }
    if (targetType === ReportTargetType.USER) {
      const user = await this.prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true, deletedAt: true },
      });
      if (!user || user.deletedAt) {
        throw new NotFoundException('Không tìm thấy người dùng để báo cáo');
      }
    }
  }

  private async loadTargetContext(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<TargetContext | null> {
    if (targetType === ReportTargetType.COMIC) {
      const c = await this.prisma.comic.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          slug: true,
          title: true,
          deletedAt: true,
          author: { select: { id: true, role: true, displayName: true } },
          genres: { select: { genreId: true } },
        },
      });
      if (!c) return null;
      return {
        targetType,
        targetId,
        isDeleted: Boolean(c.deletedAt),
        title: c.title,
        publicUrl: c.deletedAt ? null : `/comics/${c.slug}`,
        studioUrl: c.deletedAt ? null : `/studio/comics/${c.id}`,
        owner: c.author,
        comic: {
          id: c.id,
          slug: c.slug,
          title: c.title,
          genreIds: c.genres.map((g) => g.genreId),
          deletedAt: c.deletedAt,
        },
      };
    }

    if (targetType === ReportTargetType.CHAPTER) {
      const ch = await this.prisma.chapter.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          comicId: true,
          number: true,
          title: true,
          deletedAt: true,
          comic: {
            select: {
              slug: true,
              title: true,
              deletedAt: true,
              author: { select: { id: true, role: true, displayName: true } },
            },
          },
        },
      });
      if (!ch) return null;
      const chTitle = `Chương ${Number(ch.number)}${ch.title ? `: ${ch.title}` : ''} — ${ch.comic.title}`;
      const isDeleted = Boolean(ch.deletedAt || ch.comic.deletedAt);
      return {
        targetType,
        targetId,
        isDeleted,
        title: chTitle,
        publicUrl: isDeleted ? null : `/read/${ch.id}`,
        studioUrl: isDeleted ? null : `/studio/comics/${ch.comicId}/chapters/${ch.id}`,
        owner: ch.comic.author,
        chapter: {
          id: ch.id,
          comicId: ch.comicId,
          comicSlug: ch.comic.slug,
          comicTitle: ch.comic.title,
          number: Number(ch.number),
          deletedAt: ch.deletedAt,
        },
      };
    }

    if (targetType === ReportTargetType.COMMENT) {
      const cm = await this.prisma.comment.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          comicId: true,
          chapterId: true,
          deletedAt: true,
          user: { select: { id: true, role: true, displayName: true } },
          comic: { select: { title: true, slug: true } },
          chapter: { select: { id: true, number: true } },
        },
      });
      if (!cm) return null;
      return {
        targetType,
        targetId,
        isDeleted: Boolean(cm.deletedAt),
        title: cm.chapter
          ? `Bình luận ở Chương ${Number(cm.chapter.number)} — ${cm.comic.title}`
          : `Bình luận trên "${cm.comic.title}"`,
        publicUrl: cm.chapter ? `/read/${cm.chapter.id}` : `/comics/${cm.comic.slug}`,
        studioUrl: null,
        owner: cm.user,
        comment: { id: cm.id, comicId: cm.comicId, comicSlug: cm.comic.slug, deletedAt: cm.deletedAt },
      };
    }

    if (targetType === ReportTargetType.NEWS_COMMENT) {
      const nc = await this.prisma.newsComment.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          articleId: true,
          deletedAt: true,
          user: { select: { id: true, role: true, displayName: true } },
          article: { select: { title: true, slug: true } },
        },
      });
      if (!nc) return null;
      return {
        targetType,
        targetId,
        isDeleted: Boolean(nc.deletedAt),
        title: `Bình luận tin tức — ${nc.article.title}`,
        publicUrl: `/news/${nc.article.slug}`,
        studioUrl: null,
        owner: nc.user,
        newsComment: { id: nc.id, articleId: nc.articleId, deletedAt: nc.deletedAt },
      };
    }

    const u = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, username: true, displayName: true, role: true, deletedAt: true },
    });
    if (!u) return null;
    return {
      targetType,
      targetId,
      isDeleted: Boolean(u.deletedAt),
      title: u.displayName,
      publicUrl: u.deletedAt ? null : `/@${u.username}`,
      studioUrl: null,
      owner: { id: u.id, role: u.role, displayName: u.displayName },
    };
  }

  private async hydrateReports(reports: ReportWithUsers[]) {
    if (reports.length === 0) return [];

    const comicIds: string[] = [];
    const chapterIds: string[] = [];
    const commentIds: string[] = [];
    const newsCommentIds: string[] = [];
    const userIds: string[] = [];
    const pairMap = new Map<string, { targetType: ReportTargetType; targetId: string }>();

    for (const r of reports) {
      pairMap.set(`${r.targetType}:${r.targetId}`, {
        targetType: r.targetType,
        targetId: r.targetId,
      });
      if (r.targetType === ReportTargetType.COMIC) comicIds.push(r.targetId);
      else if (r.targetType === ReportTargetType.CHAPTER) chapterIds.push(r.targetId);
      else if (r.targetType === ReportTargetType.COMMENT) commentIds.push(r.targetId);
      else if (r.targetType === ReportTargetType.NEWS_COMMENT) newsCommentIds.push(r.targetId);
      else if (r.targetType === ReportTargetType.USER) userIds.push(r.targetId);
    }

    const uniquePairs = Array.from(pairMap.values());

    const [comics, chapters, comments, newsComments, users, pendingGroups] = await Promise.all([
      comicIds.length
        ? this.prisma.comic.findMany({
            where: { id: { in: Array.from(new Set(comicIds)) } },
            select: {
              id: true,
              title: true,
              slug: true,
              coverUrl: true,
              approvalStatus: true,
              status: true,
              contentRating: true,
              deletedAt: true,
              author: { select: OWNER_SELECT },
            },
          })
        : [],
      chapterIds.length
        ? this.prisma.chapter.findMany({
            where: { id: { in: Array.from(new Set(chapterIds)) } },
            select: {
              id: true,
              comicId: true,
              number: true,
              title: true,
              approvalStatus: true,
              deletedAt: true,
              totalPages: true,
              comic: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  coverUrl: true,
                  deletedAt: true,
                  author: { select: OWNER_SELECT },
                },
              },
              pages: {
                orderBy: { pageNumber: 'asc' },
                take: 6,
                select: { pageNumber: true, imageUrl: true },
              },
            },
          })
        : [],
      commentIds.length
        ? this.prisma.comment.findMany({
            where: { id: { in: Array.from(new Set(commentIds)) } },
            select: {
              id: true,
              content: true,
              isSpoiler: true,
              deletedAt: true,
              user: { select: OWNER_SELECT },
              comic: { select: { id: true, title: true, slug: true } },
              chapter: { select: { id: true, number: true } },
            },
          })
        : [],
      newsCommentIds.length
        ? this.prisma.newsComment.findMany({
            where: { id: { in: Array.from(new Set(newsCommentIds)) } },
            select: {
              id: true,
              content: true,
              deletedAt: true,
              user: { select: OWNER_SELECT },
              article: { select: { id: true, title: true, slug: true } },
            },
          })
        : [],
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: Array.from(new Set(userIds)) } },
            select: {
              ...OWNER_SELECT,
              deletedAt: true,
              _count: { select: { comics: true, comments: true } },
            },
          })
        : [],
      uniquePairs.length
        ? this.prisma.report.groupBy({
            by: ['targetType', 'targetId'],
            where: {
              status: ReportStatus.PENDING,
              OR: uniquePairs.map((p) => ({ targetType: p.targetType, targetId: p.targetId })),
            },
            _count: { _all: true },
          })
        : [],
    ]);

    const comicMap = new Map(comics.map((c) => [c.id, c]));
    const chapterMap = new Map(chapters.map((ch) => [ch.id, ch]));
    const commentMap = new Map(comments.map((cm) => [cm.id, cm]));
    const newsCommentMap = new Map(newsComments.map((nc) => [nc.id, nc]));
    const userMap = new Map(users.map((u) => [u.id, u]));
    const pendingCountMap = new Map(
      pendingGroups.map((g) => [`${g.targetType}:${g.targetId}`, g._count._all]),
    );

    const formatOwner = (owner: OwnerRow): TargetOwnerPayload => ({
      id: owner.id,
      username: owner.username,
      displayName: owner.displayName,
      avatarUrl: owner.avatarUrl,
      role: owner.role,
      isTrusted: owner.isTrusted,
      isBanned: owner.isBanned,
      bannedUntil: owner.bannedUntil ? owner.bannedUntil.toISOString() : null,
    });

    const missingTarget = (): HydratedTargetPreview => ({
      exists: false,
      isDeleted: true,
      title: 'Nội dung không còn tồn tại',
      statusBadge: 'Đã xóa / Không tìm thấy',
    });

    return reports.map((r) => {
      let target: HydratedTargetPreview;

      if (r.targetType === ReportTargetType.COMIC) {
        const c = comicMap.get(r.targetId);
        if (!c) {
          target = missingTarget();
        } else {
          const isDeleted = Boolean(c.deletedAt);
          target = {
            exists: true,
            isDeleted,
            title: c.title,
            subtitle: isDeleted ? 'Truyện đã bị xóa' : `Tác giả: ${c.author.displayName}`,
            thumbnailUrl: c.coverUrl,
            linkUrl: isDeleted ? null : `/comics/${c.slug}`,
            studioUrl: isDeleted ? null : `/studio/comics/${c.id}`,
            statusBadge: isDeleted ? 'Đã xóa' : c.approvalStatus,
            contentRating: c.contentRating,
            owner: formatOwner(c.author),
          };
        }
      } else if (r.targetType === ReportTargetType.CHAPTER) {
        const ch = chapterMap.get(r.targetId);
        if (!ch) {
          target = missingTarget();
        } else {
          const isDeleted = Boolean(ch.deletedAt || ch.comic.deletedAt);
          target = {
            exists: true,
            isDeleted,
            title: `Chương ${Number(ch.number)}${ch.title ? `: ${ch.title}` : ''} — ${ch.comic.title}`,
            subtitle: `${ch.totalPages} trang · Tác giả: ${ch.comic.author.displayName}`,
            thumbnailUrl: ch.comic.coverUrl,
            linkUrl: isDeleted ? null : `/read/${ch.id}`,
            studioUrl: isDeleted ? null : `/studio/comics/${ch.comicId}/chapters/${ch.id}`,
            statusBadge: isDeleted ? 'Đã xóa' : ch.approvalStatus,
            pagesPreview: ch.pages.map((p) => ({ pageNumber: p.pageNumber, imageUrl: p.imageUrl })),
            owner: formatOwner(ch.comic.author),
          };
        }
      } else if (r.targetType === ReportTargetType.COMMENT) {
        const cm = commentMap.get(r.targetId);
        if (!cm) {
          target = missingTarget();
        } else {
          const isDeleted = Boolean(cm.deletedAt);
          target = {
            exists: true,
            isDeleted,
            title: cm.chapter
              ? `Bình luận ở Chương ${Number(cm.chapter.number)} — ${cm.comic.title}`
              : `Bình luận trên "${cm.comic.title}"`,
            subtitle: `Người viết: ${cm.user.displayName}`,
            excerpt: cm.content,
            linkUrl: cm.chapter ? `/read/${cm.chapter.id}` : `/comics/${cm.comic.slug}`,
            statusBadge: isDeleted ? 'Đã xóa' : cm.isSpoiler ? 'Đã gắn Spoiler' : 'Đang hiển thị',
            isSpoiler: cm.isSpoiler,
            owner: formatOwner(cm.user),
          };
        }
      } else if (r.targetType === ReportTargetType.NEWS_COMMENT) {
        const nc = newsCommentMap.get(r.targetId);
        if (!nc) {
          target = missingTarget();
        } else {
          const isDeleted = Boolean(nc.deletedAt);
          target = {
            exists: true,
            isDeleted,
            title: `Bình luận tin tức — ${nc.article.title}`,
            subtitle: `Người viết: ${nc.user.displayName}`,
            excerpt: nc.content,
            linkUrl: `/news/${nc.article.slug}`,
            statusBadge: isDeleted ? 'Đã xóa' : 'Đang hiển thị',
            owner: formatOwner(nc.user),
          };
        }
      } else {
        const u = userMap.get(r.targetId);
        if (!u) {
          target = missingTarget();
        } else {
          const isDeleted = Boolean(u.deletedAt);
          target = {
            exists: true,
            isDeleted,
            title: u.displayName,
            subtitle: `@${u.username} · ${u.role} · ${u._count.comics} truyện · ${u._count.comments} bình luận`,
            thumbnailUrl: u.avatarUrl,
            linkUrl: isDeleted ? null : `/@${u.username}`,
            statusBadge: u.isBanned ? 'Đang bị khóa' : u.isTrusted ? 'Tác giả Uy tín' : u.role,
            owner: formatOwner(u),
          };
        }
      }

      return {
        ...r,
        relatedPendingCount: pendingCountMap.get(`${r.targetType}:${r.targetId}`) ?? 0,
        target,
      };
    });
  }

  private async notifyModeratorsOfNewReport(
    report: { id: string; targetType: ReportTargetType; targetId: string; reason: ReportReason; description: string | null },
    reporterId: string,
  ) {
    const moderators = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.MODERATOR] },
        deletedAt: null,
        isBanned: false,
        id: { not: reporterId },
      },
      select: { id: true },
    });

    if (moderators.length === 0) return;

    const reasonText = REASON_LABEL_VI[report.reason] || report.reason;
    const content = report.description
      ? `${reasonText}: ${report.description.slice(0, 140)}`
      : `Lý do: ${reasonText}. Vui lòng kiểm tra và xử lý.`;

    await Promise.allSettled(
      moderators.map((mod) =>
        this.notificationService.createPersonal({
          userId: mod.id,
          actorId: reporterId,
          type: NotificationType.SYSTEM,
          title: `Có báo cáo vi phạm mới (${report.targetType})`,
          content,
          actionUrl: '/studio/moderation?tab=reports',
          data: {
            reportId: report.id,
            targetType: report.targetType,
            targetId: report.targetId,
          },
        }),
      ),
    );
  }

  private async dispatchResolutionNotifications(params: {
    report: { id: string; reporterId: string; targetType: ReportTargetType; targetId: string };
    status: ReportStatus;
    action: ReportResolutionAction;
    note: string;
    resolverId: string;
    banDurationDays?: number;
    deletedContentApplied: boolean;
    targetCtx: TargetContext | null;
    relatedReporterIds: string[];
  }) {
    const {
      report,
      status,
      action,
      note,
      resolverId,
      banDurationDays,
      deletedContentApplied,
      targetCtx,
      relatedReporterIds,
    } = params;

    const tasks: Array<Promise<unknown>> = [];
    const ownerId = targetCtx?.owner?.id;

    if (
      status === ReportStatus.RESOLVED &&
      action !== ReportResolutionAction.NONE &&
      ownerId &&
      ownerId !== resolverId
    ) {
      const targetTitle = targetCtx?.title || 'Nội dung của bạn';
      let type: NotificationType = NotificationType.SYSTEM;
      let title = 'Thông báo từ ban kiểm duyệt';
      let content = note;
      let actionUrl = targetCtx?.studioUrl || targetCtx?.publicUrl || '/notifications';

      if (action === ReportResolutionAction.HIDE_CONTENT) {
        type = NotificationType.CONTENT_REJECTED;
        title = `Nội dung đã bị gỡ hiển thị: "${targetTitle}"`;
        content = `Lý do: ${note}`;
        actionUrl = targetCtx?.studioUrl || '/studio';
      } else if (action === ReportResolutionAction.DELETE_CONTENT) {
        if (
          report.targetType === ReportTargetType.COMIC ||
          report.targetType === ReportTargetType.CHAPTER
        ) {
          type = NotificationType.CONTENT_REJECTED;
        }
        title = `Nội dung vi phạm đã bị xóa: "${targetTitle}"`;
        content = `Lý do: ${note}`;
        actionUrl = '/notifications';
      } else if (action === ReportResolutionAction.MARK_MATURE) {
        title = `Truyện "${targetTitle}" đã được điều chỉnh nhãn 18+`;
        content = note || 'Ban kiểm duyệt đã chuyển xếp hạng nội dung sang Mature (18+).';
        actionUrl = targetCtx?.studioUrl || targetCtx?.publicUrl || '/studio';
      } else if (action === ReportResolutionAction.MARK_SPOILER) {
        title = 'Bình luận của bạn đã được gắn thẻ Spoiler';
        content = note || 'Để tránh tiết lộ nội dung, kiểm duyệt viên đã bật chế độ che Spoiler.';
      } else if (action === ReportResolutionAction.WARN_USER) {
        title = `Cảnh cáo vi phạm cộng đồng — ${targetTitle}`;
        content = `Ban kiểm duyệt đã ghi nhận vi phạm: ${note}`;
      } else if (action === ReportResolutionAction.REVOKE_TRUST) {
        title = 'Quyền Tác giả Uy tín đã bị thu hồi';
        content = `Lý do: ${note}`;
        actionUrl = '/studio';
      } else if (action === ReportResolutionAction.BAN_USER) {
        const durationLabel = banDurationDays ? `trong ${banDurationDays} ngày` : 'vĩnh viễn';
        title = `Tài khoản đã bị khóa ${durationLabel}`;
        content = `Lý do: ${note}${deletedContentApplied ? ' (Nội dung vi phạm đã bị xóa.)' : ''}`;
        actionUrl = '/notifications';
      }

      tasks.push(
        this.notificationService.createPersonal({
          userId: ownerId,
          actorId: resolverId,
          type,
          title,
          content,
          actionUrl,
          data: { reportId: report.id, action, targetType: report.targetType, targetId: report.targetId },
        }),
      );
    }

    const distinctReporters = new Set([report.reporterId, ...relatedReporterIds]);
    const actionLabel = ACTION_LABEL_VI[action] || action;
    for (const repId of distinctReporters) {
      if (repId === resolverId || repId === ownerId) continue;
      tasks.push(
        this.notificationService.createPersonal({
          userId: repId,
          actorId: resolverId,
          type: NotificationType.SYSTEM,
          title:
            status === ReportStatus.DISMISSED
              ? 'Báo cáo vi phạm của bạn đã được xem xét'
              : 'Báo cáo vi phạm của bạn đã được xử lý',
          content:
            status === ReportStatus.DISMISSED
              ? `Kết quả: Bỏ qua. Ghi chú: ${note}`
              : `Biện pháp áp dụng: ${actionLabel}. Ghi chú: ${note}`,
          actionUrl:
            !deletedContentApplied && action !== ReportResolutionAction.HIDE_CONTENT
              ? targetCtx?.publicUrl || '/notifications'
              : '/notifications',
          data: { reportId: report.id, status, action },
        }),
      );
    }

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  }
}
