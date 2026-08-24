export const resolveLibraryLoadingState = (hasUsableSnapshot: boolean) => ({
  showSkeleton: !hasUsableSnapshot,
  backgroundRefreshing: hasUsableSnapshot,
});

export const shouldShowLibraryFooter = (_activeCategory?: string) => true;
