// Explicit variants follow the app theme, including an embedded light surface.
export function BrandLogo({ theme = "dark" }: { theme?: "dark" | "light" }) {
  return <img className="brand-logo" src={`/brand/v2/logos/lockup-${theme === "light" ? "ink" : "sage"}.svg`}
    width={178} height={40} alt="Nuelexity" />;
}

export function BrandMark({ size = 24, decorative = true, theme = "dark" }: {
  size?: number; decorative?: boolean; theme?: "dark" | "light";
}) {
  return <img className="brand-mark" src={`/brand/v2/logos/${size <= 32 ? "small-mark" : "mark"}-${theme === "light" ? "ink" : "sage"}.svg`}
    width={size} height={size} alt={decorative ? "" : "Nuelexity"} aria-hidden={decorative || undefined} />;
}

export function WorkspaceSkeleton() {
  return <div className="workspace-pending" role="status" aria-label="Restoring your workspace">
    <BrandLogo /><div className="skeleton skeleton-heading" /><div className="skeleton" /><div className="skeleton" />
    <span className="sr-only">Restoring your workspace…</span>
  </div>;
}

export function ThreadSkeleton() {
  return <div className="thread-skeleton" role="status" aria-label="Loading conversation">
    <div className="skeleton skeleton-question" /><BrandMark /><div className="skeleton" /><div className="skeleton" /><div className="skeleton skeleton-heading" />
    <span className="sr-only">Loading conversation…</span>
  </div>;
}
