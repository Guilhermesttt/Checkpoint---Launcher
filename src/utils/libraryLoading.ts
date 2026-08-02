export const resolveLibraryLoadingState = (hasUsableSnapshot: boolean) => ({
  showSkeleton: !hasUsableSnapshot,
  backgroundRefreshing: hasUsableSnapshot,
});

export const shouldShowLibraryFooter = (activeCategory: string) =>
  activeCategory !== "SPOTIFY";
