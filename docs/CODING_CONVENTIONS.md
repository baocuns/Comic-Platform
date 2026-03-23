# 📏 Coding Conventions – Comic Reading Platform

> **Phiên bản**: 1.0  
> **Languages**: TypeScript (Frontend + Backend)  
> **Cập nhật**: 2026-02-10

---

## 1. Quy tắc Chung

### 1.1. Nguyên tắc

| # | Nguyên tắc | Mô tả |
|---|-----------|-------|
| 1 | **DRY** | Don't Repeat Yourself — tránh duplicate code |
| 2 | **KISS** | Keep It Simple, Stupid — giữ đơn giản |
| 3 | **YAGNI** | You Aren't Gonna Need It — chỉ code khi cần |
| 4 | **SRP** | Single Responsibility Principle — mỗi function/class 1 nhiệm vụ |
| 5 | **Readable** | Code là để đọc — viết rõ ràng hơn viết ngắn |

### 1.2. Formatting Tools

| Tool | Config File | Mô tả |
|------|------------|-------|
| **ESLint** | `.eslintrc.json` | Linting rules |
| **Prettier** | `.prettierrc` | Code formatting |
| **Husky** | `.husky/` | Git hooks |
| **lint-staged** | `package.json` | Run lint on staged files |

### 1.3. Prettier Config

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

---

## 2. TypeScript Conventions

### 2.1. Naming Conventions

| Element | Convention | Ví dụ |
|---------|-----------|-------|
| **Variables** | camelCase | `userName`, `totalChapters` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_UPLOAD_SIZE`, `API_BASE_URL` |
| **Functions** | camelCase | `getComicById()`, `handleSubmit()` |
| **Classes** | PascalCase | `ComicService`, `UserController` |
| **Interfaces** | PascalCase (no prefix) | `User`, `Comic` (không dùng `IUser`) |
| **Types** | PascalCase | `ComicStatus`, `CreateComicDto` |
| **Enums** | PascalCase + members UPPER_SNAKE | `enum Role { READER, AUTHOR }` |
| **Files** | kebab-case | `comic-service.ts`, `create-comic.dto.ts` |
| **React Components** | PascalCase file + export | `ComicCard.tsx` → `export function ComicCard()` |
| **Hooks** | camelCase, prefix `use` | `useComics.ts` → `export function useComics()` |
| **Test files** | `*.test.ts` / `*.spec.ts` | `comic-service.spec.ts` |

### 2.2. Type Safety Rules

```typescript
// ✅ DO: Sử dụng type khi khai báo
const comics: Comic[] = await fetchComics();
function getComic(id: string): Promise<Comic | null> { ... }

// ❌ DON'T: Sử dụng `any`
const data: any = response.body;       // BAD!

// ✅ DO: Sử dụng `unknown` nếu chưa biết type
const data: unknown = response.body;    // GOOD
if (isComic(data)) { /* use data as Comic */ }

// ✅ DO: Sử dụng type narrowing
function processInput(input: string | number) {
  if (typeof input === 'string') {
    return input.trim();
  }
  return input.toFixed(2);
}

// ✅ DO: Sử dụng discriminated unions
type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: ApiError };
```

### 2.3. Import Order

```typescript
// 1. Node built-in modules
import path from 'path';

// 2. External packages
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// 3. Internal modules (absolute imports)
import { ComicService } from '@/services/comic-service';
import { User } from '@/types/user';

// 4. Relative imports
import { formatDate } from './utils';
import { ComicCard } from './ComicCard';

// 5. Type imports
import type { Comic, Chapter } from '@/types';
```

---

## 3. Frontend Conventions (Next.js)

### 3.1. Folder Structure

```
src/
├── app/                          # Next.js App Router (pages)
│   ├── (public)/                 # Public routes
│   │   ├── page.tsx              # Homepage
│   │   ├── comics/
│   │   │   ├── page.tsx          # Comics list
│   │   │   └── [slug]/
│   │   │       ├── page.tsx      # Comic detail
│   │   │       └── chapters/
│   │   │           └── [id]/
│   │   │               └── page.tsx  # Reading page
│   │   └── search/
│   │       └── page.tsx
│   ├── (auth)/                   # Auth routes
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/              # Protected routes
│   │   ├── library/page.tsx
│   │   ├── profile/page.tsx
│   │   └── author/              # Author dashboard
│   ├── (admin)/                  # Admin routes
│   ├── api/                      # API routes (BFF)
│   ├── layout.tsx                # Root layout
│   └── not-found.tsx
│
├── components/
│   ├── ui/                       # Base UI (shadcn)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── layout/                   # Layout components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Sidebar.tsx
│   │   └── MobileNav.tsx
│   ├── comic/                    # Comic domain components
│   │   ├── ComicCard.tsx
│   │   ├── ComicGrid.tsx
│   │   ├── ComicDetail.tsx
│   │   └── ChapterList.tsx
│   ├── reader/                   # Reader components
│   │   ├── ReaderView.tsx
│   │   ├── PageImage.tsx
│   │   └── ReaderControls.tsx
│   └── shared/                   # Shared components
│       ├── Avatar.tsx
│       ├── Rating.tsx
│       └── SearchBar.tsx
│
├── hooks/                        # Custom hooks
│   ├── useAuth.ts
│   ├── useComic.ts
│   ├── useInfiniteScroll.ts
│   └── useDebounce.ts
│
├── lib/                          # Utilities
│   ├── api-client.ts             # API client (fetch wrapper)
│   ├── utils.ts                  # General utils
│   ├── cn.ts                     # className merger
│   └── constants.ts
│
├── stores/                       # Zustand stores
│   ├── auth-store.ts
│   ├── reader-store.ts
│   └── ui-store.ts
│
├── types/                        # TypeScript types
│   ├── comic.ts
│   ├── user.ts
│   ├── chapter.ts
│   └── api.ts
│
└── styles/
    └── globals.css               # Global styles + Tailwind
```

### 3.2. Component Patterns

```tsx
// ✅ Prefer function components
export function ComicCard({ comic, onBookmark }: ComicCardProps) {
  // hooks first
  const { user } = useAuth();
  const [isHovered, setIsHovered] = useState(false);

  // handlers
  const handleBookmark = useCallback(() => {
    onBookmark(comic.id);
  }, [comic.id, onBookmark]);

  // early returns
  if (!comic) return null;

  // render
  return (
    <article className="comic-card" onMouseEnter={() => setIsHovered(true)}>
      {/* JSX */}
    </article>
  );
}

// ✅ Type props separately
interface ComicCardProps {
  comic: Comic;
  onBookmark: (comicId: string) => void;
  className?: string;
}
```

### 3.3. Server vs Client Components

```tsx
// Server Component (default) — dùng cho data fetching, SEO
// app/comics/page.tsx
export default async function ComicsPage() {
  const comics = await fetchComics(); // Server-side fetch
  return <ComicGrid comics={comics} />;
}

// Client Component — dùng cho interactivity
// components/comic/ComicCard.tsx
'use client';

import { useState } from 'react';

export function ComicCard({ comic }: { comic: Comic }) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  // ...interactive logic
}
```

---

## 4. Backend Conventions (NestJS)

### 4.1. Module Structure

```
src/
├── main.ts                       # Entry point
├── app.module.ts                 # Root module
│
├── common/                       # Shared utilities
│   ├── decorators/               # Custom decorators
│   │   ├── current-user.decorator.ts
│   │   ├── public.decorator.ts
│   │   └── roles.decorator.ts
│   ├── filters/                  # Exception filters
│   │   └── http-exception.filter.ts
│   ├── guards/                   # Auth guards
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── interceptors/
│   │   ├── transform.interceptor.ts
│   │   └── cache.interceptor.ts
│   ├── pipes/
│   │   └── validation.pipe.ts
│   └── types/
│       └── index.ts
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── google.strategy.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── register.dto.ts
│   │
│   ├── comic/
│   │   ├── comic.module.ts
│   │   ├── comic.controller.ts
│   │   ├── comic.service.ts
│   │   ├── comic.repository.ts
│   │   └── dto/
│   │       ├── create-comic.dto.ts
│   │       ├── update-comic.dto.ts
│   │       └── comic-query.dto.ts
│   │
│   ├── chapter/
│   ├── user/
│   ├── comment/
│   ├── rating/
│   ├── notification/
│   ├── search/
│   └── media/
│
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
│
└── config/
    ├── app.config.ts
    ├── database.config.ts
    └── auth.config.ts
```

### 4.2. Service / Repository Pattern

```typescript
// ✅ Controller → Service → Repository

// comic.controller.ts (HTTP layer)
@Controller('comics')
export class ComicController {
  constructor(private readonly comicService: ComicService) {}

  @Get()
  findAll(@Query() query: ComicQueryDto) {
    return this.comicService.findAll(query);
  }
}

// comic.service.ts (Business logic)
@Injectable()
export class ComicService {
  constructor(private readonly comicRepo: ComicRepository) {}

  async findAll(query: ComicQueryDto) {
    const comics = await this.comicRepo.findMany(query);
    return comics.map(this.toResponse);
  }
}

// comic.repository.ts (Data access)
@Injectable()
export class ComicRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: ComicQueryDto) {
    return this.prisma.comic.findMany({
      where: this.buildWhere(query),
      orderBy: this.buildOrderBy(query.sort),
      take: query.limit,
      skip: query.offset,
    });
  }
}
```

### 4.3. DTO Validation

```typescript
// create-comic.dto.ts
import { IsString, IsNotEmpty, IsArray, IsOptional, MaxLength, IsEnum } from 'class-validator';

export class CreateComicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  genres: string[];

  @IsEnum(ContentRating)
  contentRating: ContentRating;
}
```

---

## 5. Git Workflow

### 5.1. Branching Strategy (Git Flow Simplified)

```
main ─────────●────────●──────────── production releases
               ↑        ↑
develop ──●──●──●──●──●──●──●─────── staging
           ↑  ↑     ↑
feature/* ─●  ●     ●                feature branches
           │
hotfix/*  ─────────────────●──●───── emergency fixes
                            ↑  ↑
                          main develop
```

### 5.2. Branch Naming

| Type | Pattern | Ví dụ |
|------|---------|-------|
| Feature | `feature/short-description` | `feature/comic-upload` |
| Bug fix | `fix/short-description` | `fix/login-redirect` |
| Hotfix | `hotfix/short-description` | `hotfix/payment-crash` |
| Chore | `chore/short-description` | `chore/update-deps` |
| Docs | `docs/short-description` | `docs/api-guide` |

### 5.3. Commit Messages (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

| Type | Mô tả | Ví dụ |
|------|-------|-------|
| `feat` | Tính năng mới | `feat(comic): add upload chapter flow` |
| `fix` | Sửa bug | `fix(auth): handle expired refresh token` |
| `docs` | Documentation | `docs(api): update endpoint descriptions` |
| `style` | Formatting, no logic change | `style: fix eslint warnings` |
| `refactor` | Restructure code | `refactor(reader): extract PageImage component` |
| `perf` | Performance improvement | `perf(images): lazy load below-fold images` |
| `test` | Add/update tests | `test(comic-service): add unit tests` |
| `chore` | Build, deps, config | `chore: update next.js to 14.2` |

### 5.4. Pull Request Template

```markdown
## Mô tả
<!-- Mô tả ngắn gọn thay đổi -->

## Loại thay đổi
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Docs

## Checklist
- [ ] Self-review đã done
- [ ] Code follows coding conventions
- [ ] Tests thêm/cập nhật
- [ ] No console.log hoặc debug code
- [ ] Responsive trên mobile

## Screenshots (nếu UI change)
```

---

## 6. Testing Conventions

### 6.1. Testing Stack

| Tool | Mô tả |
|------|-------|
| **Vitest** | Unit tests (frontend + backend) |
| **React Testing Library** | Component tests |
| **Playwright** | E2E tests |
| **MSW** | API mocking |

### 6.2. Test File Naming

```
# Co-located tests
components/comic/ComicCard.tsx
components/comic/ComicCard.test.tsx

# Or in __tests__ folder
modules/comic/comic.service.ts
modules/comic/__tests__/comic.service.spec.ts
```

### 6.3. Test Structure

```typescript
describe('ComicService', () => {
  describe('findAll', () => {
    it('should return paginated comics', async () => {
      // Arrange
      const query = { page: 1, limit: 10, sort: 'latest' };
      
      // Act
      const result = await service.findAll(query);
      
      // Assert
      expect(result.data).toHaveLength(10);
      expect(result.meta.hasNext).toBe(true);
    });

    it('should filter by genre', async () => {
      // ...
    });
  });
});
```

### 6.4. Coverage Targets

| Area | Target |
|------|--------|
| Services (business logic) | ≥ 80% |
| Repositories (data access) | ≥ 70% |
| Controllers | ≥ 60% |
| React components (critical) | ≥ 60% |
| E2E (critical flows) | 100% covered |

---

## 7. Error Handling

### 7.1. Frontend

```typescript
// ✅ Sử dụng Error Boundaries cho UI
// app/error.tsx
'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### 7.2. Backend

```typescript
// ✅ Custom exception với error code
export class ComicNotFoundException extends NotFoundException {
  constructor(id: string) {
    super({
      code: 'RESOURCE_NOT_FOUND',
      message: `Comic with id ${id} not found`,
    });
  }
}

// ✅ Global exception filter xử lý tất cả errors
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Log, format, respond
  }
}
```

---

## 8. Documentation Standards

### 8.1. Code Comments

```typescript
// ✅ DO: Comment WHY, not WHAT
// Cache invalidation is needed here because comic stats are 
// denormalized in the comics table for performance
await this.cacheService.invalidate(`comic:${id}`);

// ❌ DON'T: Obvious comments
// Set the user name   ← BAD, obvious
user.name = newName;
```

### 8.2. JSDoc cho Public APIs

```typescript
/**
 * Finds comics matching the given query criteria.
 * Results are paginated using cursor-based pagination.
 * 
 * @param query - Filter and sort options
 * @returns Paginated list of comics with metadata
 * @throws {BadRequestException} If query parameters are invalid
 */
async findAll(query: ComicQueryDto): Promise<PaginatedResponse<Comic>> {
  // ...
}
```
