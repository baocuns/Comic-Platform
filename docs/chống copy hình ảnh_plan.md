# Chiến Lược Bảo Vệ Hình Ảnh Truyện Tranh

## Bối cảnh

Hệ thống hiện tại:
- **Frontend**: Next.js — hiển thị ảnh qua `<img src={page.imageUrl}>` với URL công khai từ R2
- **Backend**: NestJS — API trả về trực tiếp `imageUrl` (public URL) trong response
- **Storage**: Cloudflare R2 — ảnh lưu tại `pages/{chapterId}/{number}.webp` với public URL
- **Vấn đề**: Ảnh hiện đang hoàn toàn public, ai có URL đều download được

## Thực tế cần chấp nhận

> [!IMPORTANT]
> **Không có giải pháp nào bảo vệ 100%.** Nếu người dùng nhìn thấy ảnh trên màn hình, họ luôn có thể chụp screenshot. Mục tiêu là làm cho việc sao chép **đủ khó** để không đáng công sức, đặc biệt là chống lại **bulk scraping** (crawl hàng loạt).

---

## Phân Tầng Bảo Vệ

### Tầng 1: Frontend Deterrents (Dễ, nhanh — chống user bình thường)

Những biện pháp này dễ bypass nhưng ngăn được 90% người dùng thông thường:

| Biện pháp | Chống được | Bypass bằng |
|-----------|-----------|-------------|
| Disable right-click trên ảnh | Save As | DevTools |
| Disable drag & drop | Kéo thả ra desktop | DevTools |
| CSS `pointer-events: none` | Click vào ảnh | Inspect element |
| Render ảnh trong `<canvas>` | Đơn giản copy URL | Screenshot, nhưng mất chất lượng |
| Invisible overlay `<div>` trên ảnh | Right-click save | Inspect → tìm URL |

**Đề xuất cho project**: Áp dụng tất cả vì chi phí implement rất thấp.

---

### Tầng 2: Signed URLs / Presigned URLs (⭐ Quan trọng nhất)

Đây là biện pháp **hiệu quả nhất** cho hệ thống hiện tại.

#### Cách hoạt động:
```
Hiện tại:  Client → GET /chapters/:id → { imageUrl: "https://r2.../pages/ch1/001.webp" }
                                          ↑ URL này public, không hết hạn

Cải tiến:  Client → GET /chapters/:id → { imageUrl: "https://r2.../pages/ch1/001.webp?X-Amz-Signature=abc&X-Amz-Expires=300" }
                                          ↑ URL có chữ ký, hết hạn sau 5 phút
```

#### Lợi ích:
- Ảnh **không thể truy cập trực tiếp** — bucket R2 chuyển sang private
- URL hết hạn sau N phút → không thể bookmark/share URL ảnh
- Mỗi request tạo URL mới → khó crawl tự động
- **Cloudflare R2 hỗ trợ presigned URL** sẵn qua AWS SDK

#### Thay đổi cần thiết:

##### [MODIFY] [storage.service.ts](file:///e:/Project/Comics/apps/api/src/storage/storage.service.ts)
- Thêm method `getSignedUrl(key, expiresIn)` sử dụng `@aws-sdk/s3-request-presigner`
- R2 bucket chuyển từ public → private (chỉ còn truy cập qua API)

##### [MODIFY] [chapter.service.ts](file:///e:/Project/Comics/apps/api/src/chapter/chapter.service.ts)
- Khi trả về chapter pages, thay `imageUrl` bằng signed URL có thời hạn 5-10 phút

##### [MODIFY] [page.tsx (reader)](file:///e:/Project/Comics/apps/web/src/app/read/%5BchapterId%5D/page.tsx)
- Không cần thay đổi logic render, chỉ URL sẽ khác format

---

### Tầng 3: Visible Watermark (Watermark hiển thị)

Đóng dấu watermark lên ảnh khi upload hoặc khi serve.

#### Option A: Watermark khi upload (tĩnh)
- Thêm watermark "© TênTruyện" mờ nhạt vào ảnh khi upload
- **Ưu**: Không tốn tài nguyên khi serve
- **Nhược**: Không personalize cho từng user

#### Option B: Watermark khi serve (động, per-user)
- Server render watermark có username/userId của người đọc lên ảnh
- **Ưu**: Nếu ảnh bị leak, biết ai leak
- **Nhược**: Tốn CPU rất nhiều, cần cache

#### Đề xuất: **Option A** cho giai đoạn hiện tại

##### [MODIFY] [upload.service.ts](file:///e:/Project/Comics/apps/api/src/upload/upload.service.ts)
- Thêm watermark vào `processImage()` khi upload chapter pages
- Sử dụng `sharp.composite()` để overlay watermark text/image

---

### Tầng 4: Image Fragmentation (Chia nhỏ ảnh)

Chia mỗi trang truyện thành nhiều mảnh nhỏ, render ghép lại bằng CSS/Canvas trên frontend.

```
Thay vì:  1 ảnh page-001.webp
Thành:    page-001-tile-0.webp, page-001-tile-1.webp, ... page-001-tile-8.webp
          ↓ Ghép lại bằng CSS Grid hoặc Canvas trên client
```

#### Lợi ích:
- Download 1 tile vô nghĩa — phải biết thuật toán ghép
- Mỗi tile có thể có transform khác nhau (offset, rotation nhỏ)
- Rất khó cho bot/scraper tự động

#### Nhược điểm:
- Tăng số request (mỗi trang 6-9 requests thay vì 1)
- Phức tạp hóa upload pipeline
- Cần logic ghép ảnh ở client

> [!WARNING]
> Tầng này phức tạp đáng kể. Chỉ nên triển khai khi các tầng trước đã xong và có nhu cầu bảo vệ cao hơn.

---

### Tầng 5: Rate Limiting & Abuse Detection

Chống scraper/bot crawl hàng loạt:

| Biện pháp | Mô tả |
|-----------|--------|
| Rate limit per user | Tối đa N trang/phút |
| Rate limit per IP | Chống truy cập anonymous hàng loạt |
| Sequential access check | Không cho đọc page 50 nếu chưa đọc page 1-49 |
| Honeypot URLs | URL ảnh giả, ai truy cập = bot → ban |
| Cloudflare WAF rules | Block user-agent scraper, rate limit tại edge |

##### [NEW] API middleware: Rate limiting guard cho chapter pages endpoint

---

### Tầng 6: Require Authentication to Read

Hiện tại endpoint `GET /chapters/:id` là `@Public()`. Có thể:

- **Free chapters**: Giữ public nhưng dùng signed URL
- **Premium chapters**: Yêu cầu auth + kiểm tra quyền truy cập
- **Tất cả chapters**: Yêu cầu đăng nhập mới xem → giảm anonymous scraping

##### [MODIFY] [chapter.controller.ts](file:///e:/Project/Comics/apps/api/src/chapter/chapter.controller.ts)
- Endpoint `findOne` chuyển từ `@Public()` sang optional auth hoặc required auth

---

## So Sánh & Đề Xuất Ưu Tiên

| Tầng | Độ khó | Hiệu quả | Ưu tiên |
|------|--------|-----------|---------|
| 1. Frontend Deterrents | ⭐ | 🛡️🛡️ | **Làm ngay** |
| 2. Signed URLs | ⭐⭐ | 🛡️🛡️🛡️🛡️🛡️ | **Làm ngay** |
| 3. Visible Watermark | ⭐⭐ | 🛡️🛡️🛡️ | **Nên làm** |
| 5. Rate Limiting | ⭐⭐ | 🛡️🛡️🛡️🛡️ | **Nên làm** |
| 6. Require Auth | ⭐ | 🛡️🛡️🛡️ | Tùy business logic |
| 4. Image Fragmentation | ⭐⭐⭐⭐⭐ | 🛡️🛡️🛡️🛡️ | Sau này |

## Đề Xuất Lộ Trình Triển Khai

### Phase 1 — Nền tảng (Nên làm trước)
1. ✅ Chuyển R2 bucket sang **private**
2. ✅ Implement **Signed URLs** trong `StorageService`
3. ✅ Thêm **frontend deterrents** (disable right-click, overlay, v.v.)

### Phase 2 — Tăng cường
4. Thêm **static watermark** khi upload
5. Thêm **rate limiting** cho page endpoints
6. Xem xét **require auth** cho nội dung

### Phase 3 — Nâng cao (nếu cần)
7. Image fragmentation
8. Dynamic per-user watermark
9. Abuse detection / honeypots

---

## Open Questions

> [!IMPORTANT]
> 1. **Bạn muốn bắt đầu triển khai ngay Phase 1 không?** (Signed URLs + Frontend deterrents)
> 2. **Chapters có cần phân loại free/premium không?** (Hiện đã có `isPremium` field — nếu free thì bảo vệ nhẹ, premium thì bảo vệ mạnh hơn?)
> 3. **Có muốn yêu cầu đăng nhập để đọc truyện không?** Hay giữ cho guest đọc free chapters?

## Verification Plan

### Automated Tests
- Test signed URL generation: đúng format, hết hạn đúng thời gian
- Test signed URL expired: trả 403 khi truy cập URL quá hạn
- Test rate limiting: quá N requests/phút → 429

### Manual Verification
- Thử right-click → xác nhận không save được ảnh
- Thử copy URL ảnh từ DevTools → paste vào tab mới → kiểm tra hết hạn
- Thử dùng `wget`/`curl` crawl pages → xác nhận bị chặn
