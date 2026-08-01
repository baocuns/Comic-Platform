# Thiết kế trang Tin tức (News) cho nền tảng OWOC

Xây dựng hệ thống tin tức hoàn chỉnh bao gồm: database model, backend API (NestJS), frontend pages (Next.js), và tích hợp vào trang chủ hiện tại.

## User Review Required

> [!IMPORTANT]
> **Danh mục tin tức (Category)**: Kế hoạch bao gồm hệ thống phân loại tin tức theo danh mục (ví dụ: Thông báo, Sự kiện, Cập nhật, Cộng đồng). Bạn có muốn thêm/bớt danh mục cụ thể nào không?

> [!IMPORTANT]
> **Quyền đăng tin**: Hiện tại kế hoạch cho phép ADMIN và MODERATOR tạo/chỉnh sửa tin tức. Bạn có muốn AUTHOR cũng có thể đăng tin không?

> [!WARNING]
> **Giao diện quản lý tin tức**: Kế hoạch này chỉ bao gồm trang hiển thị tin tức cho người dùng đọc. Phần quản trị (tạo/sửa/xóa tin tức) tạm thời sẽ chỉ thông qua API. Nếu bạn muốn có trang admin dashboard quản lý tin tức, cần mở rộng thêm.

## Open Questions

> [!NOTE]
> **Ảnh bìa tin tức**: Bạn muốn sử dụng hệ thống upload ảnh hiện có (Cloudflare R2 qua `/upload`) hay dùng URL ảnh bên ngoài? Kế hoạch hiện tại hỗ trợ cả hai.

> [!NOTE]
> **Tương tác tin tức**: Bạn có muốn thêm chức năng bình luận/like cho tin tức không? Kế hoạch hiện tại chưa bao gồm, nhưng có thể mở rộng dễ dàng nhờ mô hình dữ liệu linh hoạt.

---

## Proposed Changes

### 1. Database — Prisma Schema

#### [MODIFY] [schema.prisma](file:///e:/Project/Comics/apps/api/prisma/schema.prisma)

Thêm model `NewsArticle` và enum `NewsCategory`:

```prisma
enum NewsCategory {
  ANNOUNCEMENT   // Thông báo hệ thống
  EVENT          // Sự kiện
  UPDATE         // Cập nhật nền tảng
  COMMUNITY      // Cộng đồng
  FEATURED       // Tin nổi bật
}

model NewsArticle {
  id          String        @id @default(uuid()) @db.Uuid
  authorId    String        @map("author_id") @db.Uuid
  title       String        @db.VarChar(500)
  slug        String        @unique @db.VarChar(600)
  excerpt     String?       @db.VarChar(1000)    // Tóm tắt ngắn
  content     String                              // Nội dung bài viết (Markdown/HTML)
  coverUrl    String?       @map("cover_url") @db.VarChar(500)
  category    NewsCategory  @default(ANNOUNCEMENT)
  tags        String[]      @default([])          // Mảng tags
  isPinned    Boolean       @default(false) @map("is_pinned")
  isPublished Boolean       @default(false) @map("is_published")
  viewCount   Int           @default(0) @map("view_count")

  // Timestamps
  publishedAt DateTime?     @map("published_at")
  createdAt   DateTime      @default(now()) @map("created_at")
  updatedAt   DateTime      @updatedAt @map("updated_at")
  deletedAt   DateTime?     @map("deleted_at")

  // Relations
  author User @relation(fields: [authorId], references: [id])

  @@index([slug])
  @@index([category])
  @@index([isPublished, publishedAt(sort: Desc)])
  @@index([isPinned, publishedAt(sort: Desc)])
  @@map("news_articles")
}
```

Cũng cần thêm relation `newsArticles NewsArticle[]` vào model `User`.

---

### 2. Backend API — NestJS News Module

#### [NEW] [news.module.ts](file:///e:/Project/Comics/apps/api/src/news/news.module.ts)

Module NestJS cho news, follow pattern giống `ComicModule`.

#### [NEW] [news.service.ts](file:///e:/Project/Comics/apps/api/src/news/news.service.ts)

Service xử lý logic nghiệp vụ:

| Method | Mô tả |
|--------|--------|
| `findAll(query)` | Lấy danh sách tin tức có phân trang, lọc theo category, search |
| `findBySlug(slug)` | Lấy chi tiết 1 bài viết theo slug, tăng viewCount |
| `findFeatured()` | Lấy tin tức nổi bật/ghim cho trang chủ (1 featured + 4 latest) |
| `create(userId, dto)` | Tạo bài viết mới (ADMIN/MOD) |
| `update(id, userId, dto)` | Cập nhật bài viết (ADMIN/MOD) |
| `publish(id, userId)` | Xuất bản / hủy xuất bản |
| `remove(id, userId)` | Xóa mềm bài viết |

#### [NEW] [news.controller.ts](file:///e:/Project/Comics/apps/api/src/news/news.controller.ts)

Controller với các endpoint:

| Method | Route | Auth | Mô tả |
|--------|-------|------|--------|
| GET | `/news` | Public | Danh sách tin tức (phân trang, filter) |
| GET | `/news/featured` | Public | Tin tức nổi bật cho trang chủ |
| GET | `/news/:slug` | Public | Chi tiết bài viết |
| POST | `/news` | ADMIN/MOD | Tạo bài viết |
| PUT | `/news/:id` | ADMIN/MOD | Cập nhật bài viết |
| POST | `/news/:id/publish` | ADMIN/MOD | Xuất bản |
| DELETE | `/news/:id` | ADMIN/MOD | Xóa bài viết |

#### [NEW] [news.dto.ts](file:///e:/Project/Comics/apps/api/src/news/dto/news.dto.ts)

DTOs cho create, update, và query.

#### [MODIFY] [app.module.ts](file:///e:/Project/Comics/apps/api/src/app.module.ts)

Import `NewsModule` vào `AppModule`.

---

### 3. Frontend — Trang tin tức

#### [NEW] [page.tsx](file:///e:/Project/Comics/apps/web/src/app/news/page.tsx) — Trang danh sách tin tức `/news`

Giao diện trang tin tức chính với các thành phần:

```
┌─────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════╗  │
│  ║           HERO — BÀI VIẾT NỔI BẬT               ║  │
│  ║   Ảnh bìa lớn + overlay gradient + title         ║  │
│  ║   Category badge + ngày đăng + author            ║  │
│  ╚═══════════════════════════════════════════════════╝  │
│                                                         │
│  ┌──────────── CATEGORY FILTER PILLS ────────────┐     │
│  │ Tất cả │ Thông báo │ Sự kiện │ Cập nhật │ ... │     │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │         DANH SÁCH BÀI VIẾT (GRID LAYOUT)          │ │
│  │                                                    │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│  │  │ Cover    │  │ Cover    │  │ Cover    │        │ │
│  │  │ img      │  │ img      │  │ img      │        │ │
│  │  ├──────────┤  ├──────────┤  ├──────────┤        │ │
│  │  │ Category │  │ Category │  │ Category │        │ │
│  │  │ Title    │  │ Title    │  │ Title    │        │ │
│  │  │ Excerpt  │  │ Excerpt  │  │ Excerpt  │        │ │
│  │  │ Date ·   │  │ Date ·   │  │ Date ·   │        │ │
│  │  │ Author   │  │ Author   │  │ Author   │        │ │
│  │  └──────────┘  └──────────┘  └──────────┘        │ │
│  │                                                    │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│  │  │  ...     │  │  ...     │  │  ...     │        │ │
│  │  └──────────┘  └──────────┘  └──────────┘        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────── PAGINATION ───────────────────────┐     │
│  │         ← 1  2  3  ...  10 →                  │     │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Tính năng chi tiết:**
- **Hero section**: Bài viết ghim/nổi bật nhất hiển thị full-width với ảnh bìa lớn, gradient overlay, tiêu đề lớn
- **Category filter**: Pills filter theo danh mục, style đồng nhất với genre pills trên trang chủ (rounded-full, border, hover effect)
- **Article grid**: Grid responsive (1 col mobile → 2 col tablet → 3 col desktop)
- **Article card**: Cover image (aspect-ratio 16:9) + category badge + title + excerpt (line-clamp-3) + metadata (ngày, tác giả, lượt xem)
- **Skeleton loading**: Animated skeleton cho trải nghiệm mượt
- **Pagination**: Phân trang đơn giản với prev/next + page numbers
- **Empty state**: Thông báo khi chưa có tin tức

---

#### [NEW] [[slug]/page.tsx](file:///e:/Project/Comics/apps/web/src/app/news/[slug]/page.tsx) — Trang chi tiết tin tức `/news/:slug`

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ← Quay lại tin tức                                    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │               CATEGORY BADGE                      │  │
│  │                                                    │  │
│  │        TIÊU ĐỀ BÀI VIẾT LỚN                     │  │
│  │                                                    │  │
│  │  ┌─────────┐  Author Name · 22 tháng 7, 2026     │  │
│  │  │ Avatar  │  1.234 lượt xem                      │  │
│  │  └─────────┘                                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ╔══════════════════════════════════════════════════╗   │
│  ║                 ẢNH BÌA LỚN                     ║   │
│  ║           (rounded, shadow, aspect-auto)         ║   │
│  ╚══════════════════════════════════════════════════╝   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │              NỘI DUNG BÀI VIẾT                    │  │
│  │                                                    │  │
│  │  Rendered từ Markdown/HTML với typography          │  │
│  │  đẹp: headings, paragraphs, images, lists,       │  │
│  │  code blocks, blockquotes...                      │  │
│  │                                                    │  │
│  │  Sử dụng prose styling cho readability tốt        │  │
│  │                                                    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  TAGS: #manga #event #update                      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         BÀI VIẾT LIÊN QUAN (3 cards)              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │  │
│  │  │ Related  │ │ Related  │ │ Related  │          │  │
│  │  │ article  │ │ article  │ │ article  │          │  │
│  │  └──────────┘ └──────────┘ └──────────┘          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Tính năng chi tiết:**
- **Breadcrumb/Back**: Link quay lại trang danh sách tin tức
- **Article header**: Category badge + tiêu đề lớn + author info (avatar, tên, ngày đăng) + lượt xem
- **Cover image**: Hiển thị full-width với rounded corners và shadow
- **Article body**: Render nội dung HTML/Markdown với prose styling (font-size dễ đọc, line-height thoáng, spacing chuẩn)
- **Tags section**: Hiển thị tags dưới dạng pills
- **Related articles**: 3 bài viết cùng category, hiển thị dưới bài chính

---

### 4. Trang chủ — Cập nhật section News

#### [MODIFY] [page.tsx](file:///e:/Project/Comics/apps/web/src/app/page.tsx)

Cập nhật section news (L151-L244):
- Thay đổi tất cả `href="/comics"` → `href="/news"` và `href="/news/{slug}"` 
- Fetch dữ liệu tin tức thực từ API `/news/featured`
- Hiển thị dynamic data thay vì hardcoded content
- Giữ nguyên layout hiện tại (1 ảnh lớn bên trái + 4 card nhỏ bên phải) nhưng bind data từ API
- Thêm skeleton loading state

---

### 5. Header — Thêm link Tin tức

#### [MODIFY] [header.tsx](file:///e:/Project/Comics/apps/web/src/components/layout/header.tsx)

Thêm link "Tin tức" vào navigation:
```tsx
<Link href="/news" ...>Tin tức</Link>
```

---

## Tóm tắt cấu trúc file

```
apps/
├── api/
│   ├── prisma/
│   │   └── schema.prisma          [MODIFY] — Thêm NewsArticle model + NewsCategory enum
│   └── src/
│       ├── app.module.ts          [MODIFY] — Import NewsModule
│       └── news/                  [NEW DIRECTORY]
│           ├── news.module.ts
│           ├── news.controller.ts
│           ├── news.service.ts
│           └── dto/
│               └── news.dto.ts
├── web/
│   └── src/
│       ├── app/
│       │   ├── page.tsx           [MODIFY] — Cập nhật section news, fetch data từ API
│       │   └── news/              [NEW DIRECTORY]
│       │       ├── page.tsx       — Trang danh sách tin tức
│       │       └── [slug]/
│       │           └── page.tsx   — Trang chi tiết tin tức
│       └── components/
│           └── layout/
│               └── header.tsx     [MODIFY] — Thêm link "Tin tức"
```

## Verification Plan

### Automated Tests
```bash
# Chạy Prisma migrate để tạo bảng mới
cd apps/api && npx prisma migrate dev --name add-news-articles

# Build backend để verify TypeScript
cd apps/api && pnpm build

# Chạy dev server
cd . && pnpm dev
```

### Manual Verification
- Truy cập `/news` — kiểm tra trang danh sách tin tức hiển thị đúng layout
- Truy cập `/news/:slug` — kiểm tra trang chi tiết bài viết
- Kiểm tra trang chủ — section "Chuyện gì đang xảy ra vậy?" vẫn hiển thị đúng
- Test responsive trên mobile/tablet/desktop
- Test dark mode
- Test API endpoints qua curl/Postman
