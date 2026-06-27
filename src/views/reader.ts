import { getPdfBlob, getPdfMeta, updateProgress } from '../lib/library';
import { PdfRenderer, setupSwipe, setupZoomGestures } from '../lib/pdf-renderer';
import { formatError } from '../lib/errors';
import { logger } from '../lib/logger';
import { loadReaderPrefs, saveReaderPrefs, type TextTheme } from '../lib/reader-prefs';
import { showLoading } from '../components/loading';
import { sym } from '../lib/symbols';

export type ReaderInput =
  | { mode: 'library'; pdfId: string }
  | { mode: 'preview'; blob: Blob; title: string; pdfUrl: string; resultId: string };

export type ReaderCallbacks = {
  onBack: () => void;
  onAddToLibrary?: () => void | Promise<void>;
};

export type ReaderView = {
  view: HTMLElement;
  load: () => Promise<void>;
};

export function createReaderView(input: ReaderInput, callbacks: ReaderCallbacks): ReaderView {
  const isPreview = input.mode === 'preview';
  const pdfId = input.mode === 'library' ? input.pdfId : `preview:${input.resultId}`;
  const backLabel = 'Back to library';

  const view = document.createElement('div');
  view.className = 'view reader-view';

  view.innerHTML = `
    <div class="reader-progress" role="progressbar" aria-label="Reading progress" aria-valuemin="1" aria-valuenow="1" aria-valuemax="1" hidden>
      <div class="reader-progress-fill"></div>
    </div>
    <header class="reader-header">
      <button class="btn-icon back-btn" aria-label="${backLabel}" title="${backLabel}">
        <span class="icon" aria-hidden="true">${sym.back}</span>
      </button>
      <span class="page-indicator" aria-live="polite">1 / 1</span>
      <div class="reader-toolbar">
        ${
          isPreview
            ? `<button class="btn btn-primary reader-add-btn" type="button">
            <span class="icon" aria-hidden="true">${sym.add}</span>
            <span class="btn-label">Add to library</span>
          </button>`
            : ''
        }
        <div class="reader-toolbar-nav">
          <button class="btn-icon prev-btn" aria-label="Previous page" title="Previous page">
            <span class="icon" aria-hidden="true">${sym.prev}</span>
          </button>
          <button class="btn-icon next-btn" aria-label="Next page" title="Next page">
            <span class="icon" aria-hidden="true">${sym.next}</span>
          </button>
        </div>
        <div class="reader-toolbar-secondary">
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
        </div>
        <div class="reader-toolbar-overflow">
          <button type="button" class="btn-icon reader-overflow-btn" aria-expanded="false" aria-haspopup="menu" aria-label="Reading options">
            <span class="icon" aria-hidden="true">${sym.more}</span>
          </button>
          <div class="reader-overflow-menu hidden" role="menu">
            <button type="button" class="reader-overflow-item reader-overflow-text-mode" role="menuitem">
              <span class="icon" aria-hidden="true">${sym.text}</span>
              Text mode
            </button>
            <button type="button" class="reader-overflow-item reader-overflow-font-decrease" role="menuitem" hidden>
              <span class="icon" aria-hidden="true">${sym.fontDecrease}</span>
              Smaller text
            </button>
            <button type="button" class="reader-overflow-item reader-overflow-font-increase" role="menuitem" hidden>
              <span class="icon" aria-hidden="true">${sym.fontIncrease}</span>
              Larger text
            </button>
            <button type="button" class="reader-overflow-item reader-overflow-theme" role="menuitem" hidden>
              <span class="icon reader-overflow-theme-icon" aria-hidden="true">${sym.darkMode}</span>
              Dark mode
            </button>
          </div>
        </div>
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
  const progressBar = view.querySelector('.reader-progress') as HTMLElement;
  const progressFill = view.querySelector('.reader-progress-fill') as HTMLElement;
  const backBtn = view.querySelector('.back-btn') as HTMLButtonElement;
  const addLibraryBtn = view.querySelector('.reader-add-btn') as HTMLButtonElement | null;
  const textModeBtn = view.querySelector('.text-mode-btn') as HTMLButtonElement;
  const fontSizeControls = view.querySelector('.font-size-controls') as HTMLElement;
  const fontDecreaseBtn = view.querySelector('.font-decrease-btn') as HTMLButtonElement;
  const fontIncreaseBtn = view.querySelector('.font-increase-btn') as HTMLButtonElement;
  const textThemeBtn = view.querySelector('.text-theme-btn') as HTMLButtonElement;
  const textThemeIcon = view.querySelector('.text-theme-icon') as HTMLElement;
  const prevBtn = view.querySelector('.prev-btn') as HTMLButtonElement;
  const nextBtn = view.querySelector('.next-btn') as HTMLButtonElement;
  const readerOverflowBtn = view.querySelector('.reader-overflow-btn') as HTMLButtonElement;
  const readerOverflowMenu = view.querySelector('.reader-overflow-menu') as HTMLElement;
  const readerOverflowTextMode = view.querySelector('.reader-overflow-text-mode') as HTMLButtonElement;
  const readerOverflowFontDecrease = view.querySelector('.reader-overflow-font-decrease') as HTMLButtonElement;
  const readerOverflowFontIncrease = view.querySelector('.reader-overflow-font-increase') as HTMLButtonElement;
  const readerOverflowTheme = view.querySelector('.reader-overflow-theme') as HTMLButtonElement;
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
    const themeLabel = theme === 'dark' ? 'Light mode' : 'Dark mode';
    const themeIcon = theme === 'dark' ? sym.lightMode : sym.darkMode;
    textThemeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    textThemeBtn.setAttribute('aria-label', themeLabel);
    textThemeBtn.setAttribute('title', themeLabel);
    textThemeBtn.classList.toggle('active', theme === 'dark');
    textThemeIcon.textContent = themeIcon;
    readerOverflowTheme.innerHTML = `<span class="icon reader-overflow-theme-icon" aria-hidden="true">${themeIcon}</span>${themeLabel}`;
    persistPrefs({ textTheme: theme });
  }

  function saveFontScale(): void {
    persistPrefs({ fontScale: renderer.getFontScale() });
  }

  applyTextTheme(textTheme);

  function updatePageProgress(page: number, total: number): void {
    pageIndicator.textContent = `${page} / ${total}`;
    if (total > 0) {
      progressFill.style.width = `${(page / total) * 100}%`;
      progressBar.setAttribute('aria-valuenow', String(page));
      progressBar.setAttribute('aria-valuemax', String(total));
      progressBar.hidden = false;
    } else {
      progressBar.hidden = true;
    }
  }

  renderer.setCallbacks(
    (page, total) => {
      updatePageProgress(page, total);
    },
    async (page, total) => {
      if (isPreview) return;
      try {
        await updateProgress(pdfId, page, total);
        logger.debug(`Saved progress: page ${page}/${total}`);
      } catch (err) {
        logger.logError('Failed to save progress', err);
      }
    },
  );

  backBtn.addEventListener('click', () => {
    destroy();
    callbacks.onBack();
  });

  addLibraryBtn?.addEventListener('click', () => {
    void callbacks.onAddToLibrary?.();
  });

  prevBtn.addEventListener('click', () => renderer.prevPage());
  nextBtn.addEventListener('click', () => renderer.nextPage());

  function closeReaderOverflowMenu() {
    readerOverflowMenu.classList.add('hidden');
    readerOverflowBtn.setAttribute('aria-expanded', 'false');
  }

  function openReaderOverflowMenu() {
    readerOverflowMenu.classList.remove('hidden');
    readerOverflowBtn.setAttribute('aria-expanded', 'true');
    readerOverflowMenu.querySelector<HTMLElement>('[role="menuitem"]:not([hidden])')?.focus();
  }

  readerOverflowBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (readerOverflowMenu.classList.contains('hidden')) {
      openReaderOverflowMenu();
    } else {
      closeReaderOverflowMenu();
    }
  });

  view.addEventListener('click', (e) => {
    if (!readerOverflowBtn.contains(e.target as Node) && !readerOverflowMenu.contains(e.target as Node)) {
      closeReaderOverflowMenu();
    }
  });

  function updateTextModeUi(enabled: boolean): void {
    view.classList.toggle('text-mode', enabled);
    textModeBtn.setAttribute('aria-pressed', String(enabled));
    textModeBtn.classList.toggle('active', enabled);
    fontSizeControls.hidden = !enabled;
    textThemeBtn.hidden = !enabled;
    readerOverflowFontDecrease.hidden = !enabled;
    readerOverflowFontIncrease.hidden = !enabled;
    readerOverflowTheme.hidden = !enabled;
    canvas.hidden = enabled;
    textPanel.hidden = !enabled;
  }

  async function toggleTextMode(): Promise<void> {
    const next = !renderer.isTextMode();
    await renderer.setTextMode(next);
    updateTextModeUi(next);
    persistPrefs({ textMode: next });
  }

  textModeBtn.addEventListener('click', () => {
    void toggleTextMode();
  });

  readerOverflowTextMode.addEventListener('click', () => {
    closeReaderOverflowMenu();
    void toggleTextMode();
  });

  textThemeBtn.addEventListener('click', () => {
    applyTextTheme(textTheme === 'dark' ? 'light' : 'dark');
  });

  readerOverflowTheme.addEventListener('click', () => {
    closeReaderOverflowMenu();
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

  readerOverflowFontDecrease.addEventListener('click', () => {
    closeReaderOverflowMenu();
    renderer.adjustFontSize(-1);
    saveFontScale();
  });
  readerOverflowFontIncrease.addEventListener('click', () => {
    closeReaderOverflowMenu();
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
    { shouldSwipe: () => renderer.getZoom() <= 1 },
  );

  cleanupZoom = setupZoomGestures(
    canvasContainer,
    () => renderer.getZoom(),
    (zoom, focal) => {
      if (renderer.isTextMode()) return;
      renderer.setZoom(zoom, focal);
    },
  );

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      renderer.nextPage();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      renderer.prevPage();
    } else if (e.key === 'Escape') {
      if (!readerOverflowMenu.classList.contains('hidden')) {
        closeReaderOverflowMenu();
        readerOverflowBtn.focus();
        return;
      }
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
    const hideLoading = showLoading(view, isPreview ? 'Loading preview...' : 'Opening PDF...');
    canvas.classList.remove('rendered');
    textPanel.classList.remove('rendered');
    try {
      let blob: Blob;
      let title: string;
      let startPage = 1;

      if (input.mode === 'library') {
        const meta = await getPdfMeta(input.pdfId);
        if (!meta) throw new Error('PDF not found');
        title = meta.name;
        startPage = meta.currentPage;
        blob = await getPdfBlob(input.pdfId);
      } else {
        title = input.title;
        blob = input.blob;
      }

      titleEl.textContent = title;
      document.title = `${title} — DeezPDF`;
      await renderer.load(blob, pdfId, startPage);
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
          <button class="btn-icon back-error-btn" aria-label="${backLabel}" title="${backLabel}">
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
