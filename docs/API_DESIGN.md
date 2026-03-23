# 🔌 API Design – Comic Reading Platform

> **Phiên bản**: 1.0  
> **API Style**: RESTful + WebSocket  
> **Base URL**: `https://api.comicplatform.vn/v1`  
> **Cập nhật**: 2026-02-10

---

## 1. Nguyên tắc Thiết kế API

### 1.1. General Rules

| Quy tắc | Mô tả |
|---------|-------|
| **RESTful** | Tuân theo REST conventions (resource-based URL, HTTP verbs) |
| **Versioning** | URL-based: `/v1/...`, `/v2/...` |
| **JSON** | Request/Response body luôn là JSON |
| **Pagination** | Cursor-based cho feeds, offset-based cho search |
| **Rate Limiting** | 100 req/min cho authenticated, 30 req/min cho anonymous |
| **CORS** | Whitelist domains, credentials = true |
| **Compression** | Gzip/Brotli cho responses |

### 1.2. HTTP Methods

| Method | Mục đích | Idempotent |
|--------|----------|------------|
| `GET` | Đọc resource | ✅ |
| `POST` | Tạo resource mới | ❌ |
| `PUT` | Cập nhật toàn bộ resource | ✅ |
| `PATCH` | Cập nhật một phần resource | ✅ |
| `DELETE` | Xóa resource (soft delete) | ✅ |

### 1.3. Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "hasNext": true
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

### 1.4. HTTP Status Codes

| Code | Ý nghĩa | Khi nào dùng |
|------|---------|-------------|
| `200` | OK | GET, PUT, PATCH thành công |
| `201` | Created | POST tạo resource thành công |
| `204` | No Content | DELETE thành công |
| `400` | Bad Request | Validation error |
| `401` | Unauthorized | Chưa đăng nhập |
| `403` | Forbidden | Không có quyền |
| `404` | Not Found | Resource không tồn tại |
| `409` | Conflict | Duplicate resource |
| `422` | Unprocessable | Business logic error |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Error | Server error |

---

## 2. Authentication Endpoints

### `POST /v1/auth/register`
Đăng ký tài khoản mới.

```
Request:
{
  "email": "user@example.com",
  "username": "john_doe",
  "password": "SecureP@ss123",
  "display_name": "John Doe"
}

Response (201):
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "username": "..." },
    "access_token": "eyJhbG...",
    "refresh_token": "eyJhbG...",
    "expires_in": 900
  }
}
```

### `POST /v1/auth/login`
Đăng nhập bằng email/password.

```
Request:
{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}

Response (200):
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "username": "...", "role": "READER" },
    "access_token": "eyJhbG...",
    "refresh_token": "eyJhbG...",
    "expires_in": 900
  }
}
```

### `POST /v1/auth/oauth/:provider`
Đăng nhập bằng OAuth (Google, Facebook, GitHub).

```
Request:
{
  "token": "oauth_access_token_from_client"
}
```

### `POST /v1/auth/refresh`
Làm mới access token.

```
Request:
{
  "refresh_token": "eyJhbG..."
}
```

### `POST /v1/auth/logout`
Đăng xuất (invalidate refresh token).

### `POST /v1/auth/forgot-password`
Gửi email reset password.

### `POST /v1/auth/reset-password`
Reset password bằng token.

---

## 3. User Endpoints

### `GET /v1/users/me`
🔐 Lấy thông tin user hiện tại.

```
Response (200):
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "...",
    "username": "...",
    "display_name": "...",
    "avatar_url": "...",
    "role": "READER",
    "bio": "...",
    "coins": 100,
    "level": 5,
    "stats": {
      "comics_read": 42,
      "chapters_read": 350,
      "reviews_written": 15,
      "following": 10,
      "followers": 25
    },
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

### `PATCH /v1/users/me`
🔐 Cập nhật profile.

```
Request:
{
  "display_name": "New Name",
  "bio": "Comic lover",
  "avatar_url": "https://..."
}
```

### `GET /v1/users/:username`
Xem profile công khai của user.

### `GET /v1/users/:id/comics`
Lấy danh sách truyện của tác giả.

### `POST /v1/users/:id/follow`
🔐 Follow một tác giả.

### `DELETE /v1/users/:id/follow`
🔐 Unfollow một tác giả.

### `GET /v1/users/me/followers`
🔐 Danh sách người follow mình.

### `GET /v1/users/me/following`
🔐 Danh sách người mình follow.

---

## 4. Comic Endpoints

### `GET /v1/comics`
Lấy danh sách truyện (có filter & sort).

```
Query Parameters:
  ?page=1
  &limit=20
  &sort=latest|popular|top_rated|trending
  &status=ONGOING|COMPLETED
  &genre=action,romance        (comma-separated slugs)
  &content_rating=EVERYONE|TEEN
  &language=vi|en|ja
  &q=search_keyword             (full-text search)

Response (200):
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Tên Truyện",
      "slug": "ten-truyen",
      "cover_url": "https://...",
      "author": { "id": "uuid", "display_name": "..." },
      "genres": [{ "slug": "action", "name": "Hành động" }],
      "status": "ONGOING",
      "avg_rating": 4.5,
      "total_views": 12500,
      "total_chapters": 45,
      "last_chapter_at": "2026-02-09T00:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 150, "hasNext": true }
}
```

### `GET /v1/comics/:slug`
Lấy chi tiết một truyện.

```
Response (200):
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Tên Truyện",
    "slug": "ten-truyen",
    "description": "Mô tả truyện...",
    "cover_url": "https://...",
    "banner_url": "https://...",
    "author": {
      "id": "uuid",
      "display_name": "Tác giả",
      "avatar_url": "...",
      "is_following": false
    },
    "genres": [{ "slug": "action", "name": "Hành động" }],
    "status": "ONGOING",
    "content_rating": "EVERYONE",
    "original_language": "vi",
    "stats": {
      "total_views": 12500,
      "avg_rating": 4.5,
      "total_ratings": 230,
      "total_bookmarks": 1500,
      "total_chapters": 45,
      "total_comments": 890
    },
    "user_state": {                            // Nếu đã login
      "is_bookmarked": true,
      "is_rated": false,
      "last_read_chapter": 42,
      "last_read_page": 15
    },
    "published_at": "2025-06-01T00:00:00Z",
    "last_chapter_at": "2026-02-09T00:00:00Z"
  }
}
```

### `POST /v1/comics` 🔐 (Author+)
Tạo truyện mới.

```
Request:
{
  "title": "Truyện Mới",
  "description": "Mô tả...",
  "genres": ["action", "fantasy"],
  "content_rating": "TEEN",
  "original_language": "vi"
}
```

### `PUT /v1/comics/:id` 🔐 (Owner)
Cập nhật thông tin truyện.

### `DELETE /v1/comics/:id` 🔐 (Owner/Admin)
Xóa truyện (soft delete).

### `POST /v1/comics/:id/cover` 🔐 (Owner)
Upload ảnh bìa.

```
Request: multipart/form-data
  - file: image (max 5MB, jpg/png/webp)

Response (200):
{
  "success": true,
  "data": {
    "cover_url": "https://cdn.../covers/uuid.webp"
  }
}
```

---

## 5. Chapter Endpoints

### `GET /v1/comics/:comicId/chapters`
Lấy danh sách chương.

```
Query Parameters:
  ?sort=asc|desc
  &page=1
  &limit=50

Response (200):
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "number": 1,
      "title": "Khởi đầu",
      "total_pages": 25,
      "is_premium": false,
      "views": 500,
      "is_read": true,                      // Nếu user đã login
      "published_at": "2025-06-01T00:00:00Z"
    }
  ]
}
```

### `GET /v1/chapters/:id`
Lấy nội dung chương (các trang ảnh).

```
Query Parameters:
  ?language=vi                               // Ngôn ngữ (bilingual mode)

Response (200):
{
  "success": true,
  "data": {
    "id": "uuid",
    "comic": { "id": "uuid", "title": "...", "slug": "..." },
    "number": 1,
    "title": "Khởi đầu",
    "pages": [
      {
        "page_number": 1,
        "image_url": "https://cdn.../original.jpg",
        "image_url_webp": "https://cdn.../optimized.webp",
        "width": 800,
        "height": 1200,
        "blurhash": "LKO2?U%2Tw=w]~RBVZRi..."
      }
    ],
    "navigation": {
      "prev_chapter": { "id": "uuid", "number": 0 },
      "next_chapter": { "id": "uuid", "number": 2 }
    },
    "total_pages": 25
  }
}
```

### `POST /v1/comics/:comicId/chapters` 🔐 (Owner)
Tạo chương mới.

### `PUT /v1/chapters/:id` 🔐 (Owner)
Cập nhật thông tin chương.

### `DELETE /v1/chapters/:id` 🔐 (Owner/Admin)
Xóa chương.

### `POST /v1/chapters/:id/pages` 🔐 (Owner)
Upload trang ảnh cho chương.

```
Request: multipart/form-data
  - files[]: image[] (max 10MB each, jpg/png/webp)
  - page_numbers[]: int[]

Response (201):
{
  "success": true,
  "data": {
    "uploaded": 25,
    "pages": [
      {
        "page_number": 1,
        "image_url": "https://cdn.../page_1.webp",
        "status": "PROCESSING"               // Image optimization đang chạy
      }
    ]
  }
}
```

---

## 6. Bookmark & Reading History Endpoints

### `GET /v1/users/me/bookmarks` 🔐
Lấy danh sách bookmark.

### `POST /v1/comics/:id/bookmark` 🔐
Thêm bookmark.

### `DELETE /v1/comics/:id/bookmark` 🔐
Xóa bookmark.

### `POST /v1/comics/:id/favorite` 🔐
Đánh dấu yêu thích (toggle trạng thái `is_favorite` trên bookmark).

### `GET /v1/users/me/history` 🔐
Lấy lịch sử đọc.

```
Query Parameters:
  ?limit=20
  &cursor=timestamp

Response (200):
{
  "success": true,
  "data": [
    {
      "comic": { "id": "uuid", "title": "...", "slug": "...", "cover_url": "..." },
      "chapter": { "id": "uuid", "number": 42, "title": "..." },
      "last_page": 15,
      "is_completed": false,
      "read_at": "2026-02-10T08:00:00Z"
    }
  ]
}
```

### `POST /v1/chapters/:id/progress` 🔐
Cập nhật tiến độ đọc.

```
Request:
{
  "page": 15,
  "is_completed": false,
  "reading_time": 120               // seconds
}
```

---

## 7. Comment Endpoints

### `GET /v1/chapters/:chapterId/comments`
Lấy bình luận của chương.

```
Query Parameters:
  ?sort=latest|oldest|popular
  &page=1
  &limit=20
```

### `POST /v1/chapters/:chapterId/comments` 🔐
Viết bình luận.

```
Request:
{
  "content": "Chap này hay quá!",
  "parent_id": null,                // null = top-level, uuid = reply
  "is_spoiler": false
}
```

### `PUT /v1/comments/:id` 🔐 (Owner)
Sửa bình luận.

### `DELETE /v1/comments/:id` 🔐 (Owner/Admin)
Xóa bình luận.

### `POST /v1/comments/:id/like` 🔐
Like bình luận.

### `DELETE /v1/comments/:id/like` 🔐
Unlike bình luận.

---

## 8. Rating & Review Endpoints

### `GET /v1/comics/:comicId/ratings`
Lấy danh sách đánh giá.

```
Query Parameters:
  ?sort=latest|helpful
  &page=1
  &limit=10
```

### `POST /v1/comics/:comicId/ratings` 🔐
Đánh giá truyện.

```
Request:
{
  "score": 5,
  "review": "Nội dung hay, art đẹp..."
}
```

### `PUT /v1/ratings/:id` 🔐 (Owner)
Cập nhật đánh giá.

### `DELETE /v1/ratings/:id` 🔐 (Owner/Admin)
Xóa đánh giá.

---

## 9. Notification Endpoints

### `GET /v1/notifications` 🔐
Lấy danh sách thông báo.

```
Query Parameters:
  ?unread_only=true
  &limit=20
  &cursor=timestamp
```

### `GET /v1/notifications/count` 🔐
Đếm thông báo chưa đọc.

```
Response (200):
{
  "success": true,
  "data": { "unread_count": 5 }
}
```

### `PATCH /v1/notifications/:id/read` 🔐
Đánh dấu đã đọc.

### `POST /v1/notifications/read-all` 🔐
Đánh dấu tất cả là đã đọc.

---

## 10. Search Endpoint

### `GET /v1/search`
Tìm kiếm tổng hợp.

```
Query Parameters:
  ?q=keyword
  &type=comic|author|all           (mặc định: all)
  &limit=10

Response (200):
{
  "success": true,
  "data": {
    "comics": [
      { "id": "uuid", "title": "...", "slug": "...", "cover_url": "..." }
    ],
    "authors": [
      { "id": "uuid", "display_name": "...", "avatar_url": "..." }
    ]
  }
}
```

---

## 11. Genre Endpoints

### `GET /v1/genres`
Lấy danh sách thể loại.

```
Response (200):
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Hành động",
      "slug": "action",
      "icon": "⚔️",
      "comic_count": 150
    }
  ]
}
```

---

## 12. Admin Endpoints

> Tất cả cần role `ADMIN` hoặc `MODERATOR`

### `GET /v1/admin/dashboard` 🔐
Lấy thống kê tổng quan.

### `GET /v1/admin/users` 🔐
Quản lý users.

### `PATCH /v1/admin/users/:id/role` 🔐
Thay đổi role user.

### `GET /v1/admin/reports` 🔐
Danh sách reports.

### `PATCH /v1/admin/reports/:id` 🔐
Xử lý report.

### `GET /v1/admin/comics/pending` 🔐
Truyện chờ duyệt.

### `PATCH /v1/admin/comics/:id/approve` 🔐
Duyệt truyện.

### `PATCH /v1/admin/comics/:id/reject` 🔐
Từ chối truyện.

---

## 13. WebSocket Events

### Connection

```javascript
const socket = io('wss://api.comicplatform.vn', {
  auth: { token: 'access_token' }
});
```

### Events

| Event | Direction | Mô tả |
|-------|-----------|-------|
| `notification:new` | Server → Client | Thông báo mới |
| `comment:new` | Server → Client | Comment mới (khi đang đọc chapter) |
| `comment:like` | Server → Client | Ai đó like comment |
| `reading:sync` | Client → Server | Đồng bộ tiến độ đọc |
| `chapter:join` | Client → Server | Join room chapter (để nhận real-time comments) |
| `chapter:leave` | Client → Server | Leave room chapter |
| `online:count` | Server → Client | Số người đang đọc cùng chapter |

---

## 14. Error Codes Reference

| Code | HTTP | Mô tả |
|------|------|-------|
| `AUTH_REQUIRED` | 401 | Chưa đăng nhập |
| `AUTH_INVALID_TOKEN` | 401 | Token không hợp lệ |
| `AUTH_TOKEN_EXPIRED` | 401 | Token hết hạn |
| `AUTH_FORBIDDEN` | 403 | Không có quyền thực hiện |
| `VALIDATION_ERROR` | 400 | Dữ liệu đầu vào không hợp lệ |
| `RESOURCE_NOT_FOUND` | 404 | Resource không tồn tại |
| `RESOURCE_DUPLICATE` | 409 | Resource đã tồn tại |
| `RATE_LIMIT_EXCEEDED` | 429 | Vượt quá giới hạn request |
| `FILE_TOO_LARGE` | 400 | File upload quá lớn |
| `FILE_INVALID_TYPE` | 400 | Loại file không được hỗ trợ |
| `PREMIUM_REQUIRED` | 403 | Cần mua premium chapter |
| `INSUFFICIENT_COINS` | 422 | Không đủ coins |
| `INTERNAL_ERROR` | 500 | Lỗi server không xác định |

---

## 15. API Versioning Strategy

| Phiên bản | Status | Mô tả |
|-----------|--------|-------|
| `v1` | **Active** | API chính, MVP + Growth features |
| `v2` | Planned | GraphQL support, advanced queries |

### Quy tắc deprecation
1. Thông báo deprecation trước **6 tháng**
2. Response header: `Deprecation: true`, `Sunset: <date>`
3. Version cũ vẫn hoạt động ít nhất **3 tháng** sau sunset date
