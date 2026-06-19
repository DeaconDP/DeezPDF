import { getLibraryStats } from '../lib/library';
import { logger } from '../lib/logger';

let visible = false;
let panelEl: HTMLElement | null = null;
let creditClickCount = 0;
let creditResetTimer: ReturnType<typeof setTimeout> | null = null;

function renderPanel(): void {
  if (!panelEl) return;

  const entries = logger.getEntries();
  const statsPromise = getLibraryStats();

  statsPromise.then((stats) => {
    if (!panelEl) return;
    panelEl.innerHTML = `
      <div class="debug-header">
        <span>Debug Log</span>
        <button class="debug-close" aria-label="Close debug panel">&times;</button>
      </div>
      <div class="debug-stats">
        Library: ${stats.count} PDFs (${formatBytes(stats.totalSize)})
      </div>
      <div class="debug-entries">
        ${entries.length === 0
          ? '<div class="debug-entry debug-info">No log entries yet</div>'
          : entries
              .map(
                (e) =>
                  `<div class="debug-entry debug-${e.level}">` +
                  `<span class="debug-time">${e.timestamp.slice(11, 19)}</span> ` +
                  `${escapeHtml(e.message)}</div>`
              )
              .join('')}
      </div>
    `;

    panelEl.querySelector('.debug-close')?.addEventListener('click', hideDebugPanel);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function initDebugPanel(container: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'debug-panel hidden';
  container.appendChild(panelEl);

  logger.subscribe(() => {
    if (visible) renderPanel();
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      toggleDebugPanel();
    }
  });
}

export function onCreditClick(): void {
  if (creditResetTimer) clearTimeout(creditResetTimer);
  creditClickCount++;
  if (creditClickCount >= 3) {
    creditClickCount = 0;
    toggleDebugPanel();
    return;
  }
  creditResetTimer = setTimeout(() => {
    creditClickCount = 0;
  }, 1500);
}

function toggleDebugPanel(): void {
  if (visible) hideDebugPanel();
  else showDebugPanel();
}

function showDebugPanel(): void {
  visible = true;
  if (panelEl) {
    panelEl.classList.remove('hidden');
    renderPanel();
  }
}

function hideDebugPanel(): void {
  visible = false;
  panelEl?.classList.add('hidden');
}
