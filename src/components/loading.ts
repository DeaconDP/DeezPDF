import { brandLogoSrc } from '../lib/brand';

export function createLoadingOverlay(message = 'Loading...'): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-orbit">
      <img class="loading-logo" src="${brandLogoSrc}" width="20" height="20" alt="" aria-hidden="true" />
    </div>
    <p class="loading-text">${message}</p>
  `;
  return overlay;
}

export function showLoading(container: HTMLElement, message?: string): () => void {
  const overlay = createLoadingOverlay(message);
  container.appendChild(overlay);
  return () => overlay.remove();
}
