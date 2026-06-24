import { getPdfBlob, getPdfMeta, updateProgress } from '../lib/library';
import { PdfRenderer, setupSwipe, setupZoomGestures } from '../lib/pdf-renderer';
import { formatError } from '../lib/errors';
import { logger } from '../lib/logger';
import { loadReaderPrefs, saveReaderPrefs, type TextTheme } from '../lib/reader-prefs';
import { showLoading } from '../components/loading';
import { sym } from '../lib/symbols';

export type ReaderCallbacks = {
  onBack: () => void;
};

export type ReaderView = {
  view: HTMLElement;
  load: () => Promise<void>;
};

export function createReaderView(pdfId: string, callbacks: ReaderCallbacks): ReaderView {
  const view = document.createElement('div');
  view.className = 'view reader-view';

  view.innerHTML = `
    <header class="reader-header">
      <button class="btn-icon back-btn" aria-label="Back to library">
        <span class="icon" aria-hidden="true">${sym.back}</span>
      </button>
      <span class="page-indicator" aria-live="polite">1 / 1</span>
      <div class="reader-toolbar">
        <button class="btn-icon text-mode-btn" aria-pressed="false" aria-label="Text mode" title="Text mode">
          <span class="icon" aria-hidden="true">${sym.text}</span>
        </button>
        <div class="font-size-controls" hidden>
          <button class="btn-icon font-decrease-btn" aria-label="Decrease font size" title="Smaller text">
            <span class="icon" aria-hidden="true">${sym.fontDecrease}</span>
          </button>
          <button class="btn-icon font-increase-btn" aria-label="Increase font size" title="Larger text">
            <span class="icon" aria-hidden="true">${sym.fontIncrease}</span>
          </button>
        </div>
        <button class="btn-icon text-theme-btn" hidden aria-pressed="false" aria-label="Dark mode" title="Dark mode">
          <span class="icon text-theme-icon" aria-hidden="true">${sym.darkMode}</span>
        </button>
        <button class="btn-icon prev-btn" aria-label="Previous page" title="Previous page">
          <span class="icon" aria-hidden="true">${sym.prev}</span>
        </button>
        <button class="btn-icon next-btn" aria-label="Next page" title="Next page">
          <span class="icon" aria-hidden="true">${sym.next}</span>
        </button>
      </div>
    </header>
    <div class="reader-canvas-container">
      <div class="reader-canvas-wrapper">
        <canvas class="reader-canvas"></canvas>
        <div class="reader-text-panel" hidden aria-live="polite"></div>
      </div>
    </div>
    <div class="swipe-hint" aria-hidden="true">
      <span class="icon">${sym.swipe}</span>
    </div>
    <span class="visually-hidden pdf-title">Loading…</span>
  `;

  const canvas = view.querySelector('.reader-canvas') as HTMLCanvasElement;
  const textPanel = view.querySelector('.reader-text-panel') as HTMLElement;
  const titleEl = view.querySelector('.pdf-title') as HTMLElement;
  const pageIndicator = view.querySelector('.page-indicator') as HTMLElement;
  const backBtn = view.querySelector('.back-btn') as HTMLButtonElement;
  const textModeBtn = view.querySelector('.text-mode-btn') as HTMLButtonElement;
  const fontSizeControls = view.querySelector('.font-size-controls') as HTMLElement;
  const fontDecreaseBtn = view.querySelector('.font-decrease-btn') as HTMLButtonElement;
  const fontIncreaseBtn = view.querySelector('.font-increase-btn') as HTMLButtonElement;
  const textThemeBtn = view.querySelector('.text-theme-btn') as HTMLButtonElement;
  const textThemeIcon = view.querySelector('.text-theme-icon') as HTMLElement;
  const prevBtn = view.querySelector('.prev-btn') as HTMLButtonElement;
  const nextBtn = view.querySelector('.next-btn') as HTMLButtonElement;
  const canvasContainer = view.querySelector('.reader-canvas-container') as HTMLElement;
  const canvasWrapper = view.querySelector('.reader-canvas-wrapper') as HTMLElement;

  const renderer = new PdfRenderer(canvas, textPanel, canvasContainer, canvasWrapper);
  const previousTitle = document.title;
  let prefs = loadReaderPrefs();
  let textTheme: TextTheme = prefs.textTheme;
  let cleanupSwipe: (() => void) | null = null;
  let cleanupZoom: (() => void) | null = null;
  let cleanupKeydown: (() => void) | null = null;
  let cleanupResize: (() => void) | null = null;
  let cleanupLayoutObserver: (() => void) | null = null;

  function persistPrefs(updates: Partial<typeof prefs>): void {
    prefs = { ...prefs, ...updates };
    saveReaderPrefs(prefs);
  }

  function applyTextTheme(theme: TextTheme): void {
    textTheme = theme;
    textPanel.classList.toggle('text-theme-dark', theme === 'dark');
    textPanel.classList.toggle('text-theme-light', theme === 'light');
    textThemeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    textThemeBtn.setAttribute('aria-label', theme === 'dark' ? 'Light mode' : 'Dark mode');
    textThemeBtn.setAttribute('title', theme === 'dark' ? 'Light mode' : 'Dark mode');
    textThemeBtn.classList.toggle('active', theme === 'dark');
    textThemeIcon.textContent = theme === 'dark' ? sym.lightMode : sym.darkMode;
    persistPrefs({ textTheme: theme });
  }

  function saveFontScale(): void {
    persistPrefs({ fontScale: renderer.getFontScale() });
  }

  applyTextTheme(textTheme);

  renderer.setCallbacks(
    (page, total) => {
      pageIndicator.textContent = `${page} / ${total}`;
    },
    async (page, total) => {
      try {
        await updateProgress(pdfId, page, total);
        logger.debug(`Saved progress: page ${page}/${total}`);
      } catch (err) {
        logger.logError('Failed to save progress', err);
      }
    }
  );

  backBtn.addEventListener('click', () => {
    destroy();
    callbacks.onBack();
  });

  prevBtn.addEventListener('click', () => renderer.prevPage());
  nextBtn.addEventListener('click', () => renderer.nextPage());

  function updateTextModeUi(enabled: boolean): void {
    view.classList.toggle('text-mode', enabled);
    textModeBtn.setAttribute('aria-pressed', String(enabled));
    textModeBtn.classList.toggle('active', enabled);
    fontSizeControls.hidden = !enabled;
    textThemeBtn.hidden = !enabled;
    canvas.hidden = enabled;
    textPanel.hidden = !enabled;
  }

  textModeBtn.addEventListener('click', async () => {
    const next = !renderer.isTextMode();
    await renderer.setTextMode(next);
    updateTextModeUi(next);
    persistPrefs({ textMode: next });
  });

  textThemeBtn.addEventListener('click', () => {
    applyTextTheme(textTheme === 'dark' ? 'light' : 'dark');
  });

  fontDecreaseBtn.addEventListener('click', () => {
    renderer.adjustFontSize(-1);
    saveFontScale();
  });
  fontIncreaseBtn.addEventListener('click', () => {
    renderer.adjustFontSize(1);
    saveFontScale();
  });

  const onTextFontWheel = (e: WheelEvent) => {
    if (!renderer.isTextMode() || !e.ctrlKey) return;
    e.preventDefault();
    const step = Math.max(-3, Math.min(3, Math.round(-e.deltaY / 15)));
    if (step !== 0) {
      renderer.adjustFontSize(step);
      saveFontScale();
    }
  };
  canvasContainer.addEventListener('wheel', onTextFontWheel, { passive: false });

  cleanupSwipe = setupSwipe(
    canvasContainer,
    () => renderer.nextPage(),
    () => renderer.prevPage(),
    { shouldSwipe: () => renderer.getZoom() <= 1 }
  );

  cleanupZoom = setupZoomGestures(
    canvasContainer,
    () => renderer.getZoom(),
    (zoom, focal) => {
      if (renderer.isTextMode()) return;
      renderer.setZoom(zoom, focal);
    }
  );

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      renderer.nextPage();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      renderer.prevPage();
    } else if (e.key === 'Escape') {
      destroy();
      callbacks.onBack();
    }
  };
  document.addEventListener('keydown', onKeydown);
  cleanupKeydown = () => document.removeEventListener('keydown', onKeydown);

  let resizeTimer: ReturnType<typeof setTimeout>;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderer.resize(), 150);
  };
  window.addEventListener('resize', onResize);
  cleanupResize = () => window.removeEventListener('resize', onResize);

  const layoutObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderer.resize(), 50);
  });
  layoutObserver.observe(canvasContainer);
  cleanupLayoutObserver = () => layoutObserver.disconnect();

  function destroy() {
    document.title = previousTitle;
    cleanupSwipe?.();
    cleanupZoom?.();
    cleanupKeydown?.();
    cleanupResize?.();
    cleanupLayoutObserver?.();
    canvasContainer.removeEventListener('wheel', onTextFontWheel);
    renderer.destroy();
  }

  view.addEventListener('remove', destroy);

  async function load(): Promise<void> {
    const hideLoading = showLoading(view, 'Opening PDF...');
    canvas.classList.remove('rendered');
    textPanel.classList.remove('rendered');
    try {
      const meta = await getPdfMeta(pdfId);
      if (!meta) throw new Error('PDF not found');

      titleEl.textContent = meta.name;
      document.title = `${meta.name} — DeezPDF`;
      const blob = await getPdfBlob(pdfId);
      await renderer.load(blob, pdfId, meta.currentPage);
      renderer.setFontScale(prefs.fontScale);
      if (prefs.textMode) {
        await renderer.setTextMode(true);
        updateTextModeUi(true);
      }
      if (renderer.isTextMode()) {
        textPanel.classList.add('rendered');
      } else {
        canvas.classList.add('rendered');
      }
    } catch (err) {
      logger.logError('Failed to open PDF', err);
      view.innerHTML = `
        <div class="error-state">
          <span class="error-icon icon" aria-hidden="true">${sym.warn}</span>
          <p>Failed to open PDF</p>
          <p class="error-detail">${escapeHtml(formatError(err))}</p>
          <button class="btn-icon back-error-btn" aria-label="Back to library" title="Back to library">
            <span class="icon" aria-hidden="true">${sym.back}</span>
          </button>
        </div>
      `;
      view.querySelector('.back-error-btn')?.addEventListener('click', () => {
        destroy();
        callbacks.onBack();
      });
    } finally {
      hideLoading();
    }
  }

  return { view, load };
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
