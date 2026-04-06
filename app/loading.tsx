export default function Loading() {
  return (
    <div className="flex h-screen w-full bg-background">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar-background shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col gap-1 p-3 flex-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md">
              <div className="h-4 w-4 rounded bg-muted animate-pulse" />
              <div
                className="h-3 rounded bg-muted animate-pulse"
                style={{ width: `${55 + (i % 4) * 15}px` }}
              />
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex flex-col gap-1 flex-1">
              <div className="h-3 w-28 rounded bg-muted animate-pulse" />
              <div className="h-2 w-36 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header skeleton */}
        <header className="flex h-16 items-center gap-3 border-b border-border px-4 shrink-0">
          <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-4 w-px bg-border mx-1" />
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        </header>

        {/* Content skeleton */}
        <div className="flex flex-col gap-4 p-6 flex-1 overflow-hidden">
          {/* Toolbar skeleton */}
          <div className="flex items-center justify-between gap-3">
            <div className="h-9 w-64 rounded-md bg-muted animate-pulse" />
            <div className="flex items-center gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-9 w-24 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          </div>

          {/* Table skeleton */}
          <div className="rounded-lg border border-border overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 border-b border-border">
              {[12, 28, 24, 18, 16, 14].map((w, i) => (
                <div
                  key={i}
                  className="h-3 rounded bg-muted animate-pulse"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
            {/* Table rows */}
            {Array.from({ length: 8 }).map((_, row) => (
              <div
                key={row}
                className="flex items-center gap-4 px-4 py-3 border-b border-border/50 last:border-0"
              >
                {[12, 28, 24, 18, 16, 14].map((w, col) => (
                  <div
                    key={col}
                    className="h-3 rounded bg-muted/70 animate-pulse"
                    style={{
                      width: `${w - (row % 3) * 2}%`,
                      animationDelay: `${(row * 6 + col) * 50}ms`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Pagination skeleton */}
          <div className="flex items-center justify-center gap-2 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-8 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}