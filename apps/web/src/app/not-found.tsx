import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mb-4 text-6xl font-bold text-zinc-700">404</div>
        <h1 className="mb-2 text-2xl font-bold text-white">Trang không tồn tại</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Trang bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          ← Về trang chủ
        </Link>
      </div>
    </div>
  );
}
