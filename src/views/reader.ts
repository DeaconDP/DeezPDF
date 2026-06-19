import { getPdfBlob, getPdfMeta, updateProgress } from '../lib/library';
import { PdfRenderer, setupSwipe } from '../lib/pdf-renderer';
import { formatError } from '../lib/errors';
import { logger } from '../lib/logger';
import { showLoading } from '../components/loading';

export type ReaderCallbacks = {
  onBack: () => void;
};

export async function createReaderView(pdfId: string, callbacks: ReaderCallbacks): Promise<HTMLElement> {
  const view = document.createElement('div');
  view.className = 'view reader-view';

  view.innerHTML = `
    <header class="reader-header">
      <button class="btn btn-ghost back-btn" aria-label="Back to library">&larr; Library</button>
      <div class="reader-title">
        <span class="pdf-title">Loading...</span>
        <span class="page-indicator">Page 1 / 1</span>
      </div>
      <div class="reader-nav">
        <button class="btn btn-ghost prev-btn" aria-label="Previous page">&larr;</button>
        <button class="btn btn-ghost next-btn" aria-label="Next page">&rarr;</button>
      </div>
    </header>
    <div class="reader-canvas-container">
      <canvas class="reader-canvas"></canvas>
    </div>
    <div class="swipe-hint">Swipe left/right to turn pages</div>
  `;

  const canvas = view.querySelector('.reader-canvas') as HTMLCanvasElement;
  const titleEl = view.querySelector('.pdf-title') as HTMLElement;
  const pageIndicator = view.querySelector('.page-indicator') as HTMLElement;
  const backBtn = view.querySelector('.back-btn') as HTMLButtonElement;
  const prevBtn = view.querySelector('.prev-btn') as HTMLButtonElement;
  const nextBtn = view.querySelector('.next-btn') as HTMLButtonElement;
  const canvasContainer = view.querySelector('.reader-canvas-container') as HTMLElement;

  const renderer = new PdfRenderer(canvas);
  let cleanupSwipe: (() => void) | null = null;
  let cleanupKeydown: (() => void) | null = null;
  let cleanupResize: (() => void) | null = null;

  renderer.setCallbacks(
    (page, total) => {
      pageIndicator.textContent = `Page ${page} / ${total}`;
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

  cleanupSwipe = setupSwipe(
    canvasContainer,
    () => renderer.prevPage(),
    () => renderer.nextPage()
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

  function destroy() {
    cleanupSwipe?.();
    cleanupKeydown?.();
    cleanupResize?.();
    renderer.destroy();
  }

  view.addEventListener('remove', destroy);

  const hideLoading = showLoading(view, 'Opening PDF...');
  try {
    const meta = await getPdfMeta(pdfId);
    if (!meta) throw new Error('PDF not found');

    titleEl.textContent = meta.name;
    const blob = await getPdfBlob(pdfId);
    await renderer.load(blob, pdfId, meta.currentPage);
  } catch (err) {
    logger.logError('Failed to open PDF', err);
    view.innerHTML = `
      <div class="error-state">
        <p>Failed to open PDF</p>
        <p class="error-detail">${escapeHtml(formatError(err))}</p>
        <button class="btn btn-primary back-error-btn">Back to Library</button>
      </div>
    `;
    view.querySelector('.back-error-btn')?.addEventListener('click', () => {
      destroy();
      callbacks.onBack();
    });
  } finally {
    hideLoading();
  }

  return view;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
