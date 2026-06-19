export function createLoadingOverlay(message = 'Loading...'): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <p class="loading-text">${message}</p>
  `;
  return overlay;
}

export function showLoading(container: HTMLElement, message?: string): () => void {
  const overlay = createLoadingOverlay(message);
  container.appendChild(overlay);
  return () => overlay.remove();
}
