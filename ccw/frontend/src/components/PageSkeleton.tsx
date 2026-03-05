// ========================================
// Page Skeleton
// ========================================
// Loading fallback component for lazy-loaded routes

export function PageSkeleton() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}
