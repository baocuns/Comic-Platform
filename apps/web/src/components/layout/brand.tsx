export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`ow-brand${compact ? ' ow-brand--compact' : ''}`}>
      <span className="ow-brand-word" aria-hidden="true">owoc<span className="ow-brand-spark">✦</span></span>
      {!compact && <span className="ow-brand-caption">THẾ GIỚI TRONG TỪNG TRANG</span>}
      <span className="sr-only">OWOC — Thế giới truyện tranh</span>
    </span>
  );
}
