# 📖 Glossary – Comic Reading Platform

> Bảng thuật ngữ cho dự án Nền tảng Đọc Truyện Tranh Online.  
> Cập nhật: 2026-02-10

---

## A

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **ACID** | Atomicity, Consistency, Isolation, Durability — 4 thuộc tính đảm bảo database transactions tin cậy |
| **API (Application Programming Interface)** | Giao diện lập trình ứng dụng — cách frontend và backend giao tiếp |
| **AVIF** | AV1 Image File Format — định dạng ảnh nén mới, nhỏ hơn WebP 20-30% |
| **Access Token** | Token ngắn hạn (15 phút) để xác thực mỗi API request |
| **App Router** | Hệ thống routing mới của Next.js 13+ dựa trên file system |

## B

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **BFF (Backend For Frontend)** | Pattern nơi frontend có API layer riêng để tổng hợp dữ liệu từ backend |
| **Blurhash** | Thuật toán tạo placeholder mờ cho ảnh, hiển thị trong khi ảnh thật đang tải |
| **Bookmark** | Đánh dấu truyện để đọc lại sau, lưu tiến độ đọc |
| **BullMQ** | Thư viện job queue dựa trên Redis, xử lý tác vụ nền (background jobs) |
| **Brute Force** | Tấn công thử nhiều mật khẩu liên tục — chống bằng rate limiting |

## C

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **CDN (Content Delivery Network)** | Mạng phân phối nội dung — cache ảnh/files tại edge servers gần user |
| **CI/CD** | Continuous Integration / Continuous Deployment — tự động test và deploy code |
| **CORS (Cross-Origin Resource Sharing)** | Chính sách cho phép/chặn requests từ domain khác |
| **CSP (Content Security Policy)** | Header bảo mật kiểm soát resources nào được phép load |
| **CSR (Client-Side Rendering)** | Render trang ở browser bằng JavaScript |
| **CSRF (Cross-Site Request Forgery)** | Kiểu tấn công giả mạo request từ site khác |
| **Cache** | Bộ nhớ đệm — lưu tạm dữ liệu để truy cập nhanh hơn |
| **Chapter** | Chương truyện — đơn vị nội dung chính, chứa nhiều pages |
| **Comic** | Truyện tranh — entity chính của nền tảng |
| **Content Rating** | Mức phân loại nội dung: Everyone, Teen, Mature |

## D

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **DDoS** | Distributed Denial of Service — tấn công từ chối dịch vụ phân tán |
| **DMCA** | Digital Millennium Copyright Act — quy trình xử lý vi phạm bản quyền |
| **DTO (Data Transfer Object)** | Object chuyển dữ liệu giữa các tầng, có validation rules |
| **Dark Mode** | Chế độ tối — giảm mỏi mắt khi đọc trong môi trường thiếu sáng |
| **Denormalization** | Lưu dữ liệu trùng lặp có chủ đích để tăng tốc query (ví dụ: total_views trong bảng comics) |
| **DI (Dependency Injection)** | Pattern inject dependencies thay vì khởi tạo trực tiếp — NestJS dùng pattern này |

## E

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **E2E Testing** | End-to-End Testing — test toàn bộ luồng từ UI đến database |
| **Edge** | Server ở gần user nhất trong CDN network |
| **Egress** | Data transfer ra ngoài — Cloudflare R2 miễn phí egress |

## F

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **Favorite** | Truyện yêu thích — subset đặc biệt của bookmarks |
| **Freemium** | Mô hình miễn phí + trả phí — đọc free có ads, premium không ads |

## G

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **Genre** | Thể loại truyện (Action, Romance, Fantasy...) |
| **Guard** | NestJS Guard — middleware kiểm tra auth/permission trước khi vào controller |

## H

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **Helmet.js** | Middleware bảo mật, tự động set các HTTP security headers |
| **Hotlinking** | Khi site khác embed trực tiếp ảnh từ server của mình — cần chặn |
| **Hydration** | Quá trình React "gắn" event listeners vào HTML được render từ server |

## I

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **ISR (Incremental Static Regeneration)** | Next.js tạo lại static pages theo interval mà không cần redeploy |
| **Idempotent** | Gọi nhiều lần cho kết quả giống nhau — GET, PUT, DELETE là idempotent |

## J

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **JSONB** | Binary JSON trong PostgreSQL — có thể query, index bên trong |
| **JWT (JSON Web Token)** | Token chứa thông tin user dưới dạng JSON đã mã hóa, dùng để xác thực |

## L

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **Lazy Loading** | Kỹ thuật chỉ tải ảnh/data khi user scroll đến gần — tiết kiệm bandwidth |
| **Lint** | Kiểm tra code tự động tìm lỗi cú pháp, style, best practices |

## M

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **MAR (Monthly Active Readers)** | Số độc giả hoạt động hàng tháng — North Star metric |
| **MRR (Monthly Recurring Revenue)** | Doanh thu định kỳ hàng tháng |
| **MVP (Minimum Viable Product)** | Sản phẩm tối thiểu đủ để ra mắt và thu thập feedback |
| **Manga** | Truyện tranh Nhật Bản — đọc từ phải sang trái, theo trang |
| **Meilisearch** | Search engine nhanh, typo-tolerant, dễ dùng hơn Elasticsearch |
| **Migration** | Script thay đổi database schema — quản lý bởi Prisma |
| **Modular Monolith** | Kiến trúc monolith nhưng chia thành modules rõ ràng, dễ tách microservice sau |

## N

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **NestJS** | Backend framework Node.js, TypeScript-first, dùng DI pattern |
| **Next.js** | React meta-framework hỗ trợ SSR, SSG, ISR, App Router |

## O

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **OAuth** | Giao thức ủy quyền — cho phép login bằng Google, Facebook mà không cần password |
| **ORM (Object-Relational Mapping)** | Map database tables thành TypeScript objects — Prisma là ORM |
| **Optimistic Update** | Cập nhật UI ngay lập tức trước khi server confirm — TanStack Query hỗ trợ |

## P

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **Page** | Trang truyện — 1 ảnh trong chapter |
| **Pagination** | Phân trang — chia kết quả thành nhiều trang, hỗ trợ cursor-based và offset-based |
| **Prisma** | ORM cho Node.js/TypeScript — type-safe, auto-generate types từ schema |
| **PWA (Progressive Web App)** | Web app có thể cài đặt như native app, hỗ trợ offline |

## R

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **R2 (Cloudflare R2)** | Object storage tương thích S3, không tính phí egress |
| **RBAC (Role-Based Access Control)** | Phân quyền dựa trên vai trò: Reader, Author, Moderator, Admin |
| **Rate Limiting** | Giới hạn số requests trong khoảng thời gian — chống DDoS, brute force |
| **Redis** | In-memory database — dùng cho caching, session, job queue |
| **Refresh Token** | Token dài hạn (7 ngày) để lấy access token mới mà không cần login lại |
| **Responsive Design** | Thiết kế tương thích mọi kích thước màn hình |

## S

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **SEO (Search Engine Optimization)** | Tối ưu để xuất hiện trên Google Search |
| **SRP (Single Responsibility Principle)** | Mỗi class/function chỉ có 1 nhiệm vụ |
| **SSR (Server-Side Rendering)** | Render trang trên server, gửi HTML hoàn chỉnh — tốt cho SEO |
| **Seed Data** | Dữ liệu mẫu ban đầu (genres, admin account, sample comics) |
| **Sentry** | Dịch vụ theo dõi lỗi (error tracking) và hiệu suất trong production |
| **Service Worker** | Script chạy background trong browser — hỗ trợ PWA, offline cache |
| **Signed URL** | URL có token bảo mật, hết hạn sau thời gian — dùng cho premium content |
| **Slug** | Phiên bản URL-friendly của title: "Truyện Hay" → "truyen-hay" |
| **Soft Delete** | Đánh dấu `deleted_at` thay vì xóa hẳn khỏi database |

## T

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **TTL (Time To Live)** | Thời gian sống của cache/token trước khi hết hạn |
| **TanStack Query** | Thư viện quản lý server state — caching, auto refetch, optimistic updates |
| **Tipping** | Donate tiền trực tiếp cho tác giả |
| **Token Rotation** | Mỗi lần refresh tạo refresh token mới, vô hiệu hóa token cũ |

## U

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **USP (Unique Selling Point)** | Điểm bán hàng độc nhất — lý do user chọn platform này |
| **UUID** | Universally Unique Identifier — ID duy nhất toàn cầu, dùng làm primary key |

## V

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **Validation** | Kiểm tra dữ liệu đầu vào có hợp lệ không — class-validator ở backend |
| **Virtualized List** | Chỉ render các items trong viewport — react-virtuoso cho reading view |

## W

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **WAF (Web Application Firewall)** | Tường lửa ứng dụng web — Cloudflare WAF chống tấn công |
| **WCAG** | Web Content Accessibility Guidelines — tiêu chuẩn accessibility |
| **WebP** | Định dạng ảnh của Google — nhỏ hơn JPEG 25-30%, hỗ trợ rộng |
| **WebSocket** | Kết nối hai chiều liên tục giữa client-server — dùng cho real-time features |
| **Webtoon** | Truyện tranh dạng cuộn dọc — phổ biến ở Hàn Quốc và toàn cầu |
| **Webhook** | HTTP callback — server gửi thông báo tự động khi có sự kiện (ví dụ: thanh toán thành công) |

## Z

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **Zustand** | State management library cho React — nhẹ, đơn giản, không boilerplate |
