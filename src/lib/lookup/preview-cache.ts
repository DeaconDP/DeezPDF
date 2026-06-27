const cache = new Map<string, Blob>();

export function cachePreviewBlob(resultId: string, blob: Blob): void {
  cache.set(resultId, blob);
}

export function getCachedPreviewBlob(resultId: string): Blob | undefined {
  return cache.get(resultId);
}

export function clearPreviewCache(): void {
  cache.clear();
}
