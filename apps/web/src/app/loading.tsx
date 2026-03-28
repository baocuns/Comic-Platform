export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-violet-500/20 border-t-violet-500" />
        <p className="text-sm text-zinc-500">Đang tải...</p>
      </div>
    </div>
  );
}
