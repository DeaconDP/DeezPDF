import * as pdfjsLib from 'pdfjs-dist';
import { AppError, ErrorCodes } from './errors';
import { logger } from './logger';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

async function waitForContainerSize(container: HTMLElement): Promise<{ width: number; height: number }> {
  for (let i = 0; i < 20; i++) {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width > 0 && height > 0) {
      return { width, height };
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  return {
    width: container.clientWidth || window.innerWidth,
    height: container.clientHeight || window.innerHeight - 120,
  };
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const MIN_FONT_PX = 6;
export const MAX_FONT_PX = 96;
export const DEFAULT_TEXT_FONT_PX = 16;
const PAGE_PADDING = 32;

function normalizePdfTextLineBreaks(text: string): string {
  return text
    .replace(/(?<!\.)[ \t]*\r?\n[ \t]*/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function textFromContent(
  content: Awaited<ReturnType<pdfjsLib.PDFPageProxy['getTextContent']>>
): string {
  let result = '';
  for (const item of content.items) {
    if (!('str' in item)) continue;
    result += item.str;
    if ('hasEOL' in item && item.hasEOL) {
      result += '\n';
    } else if (!item.str.endsWith('-')) {
      result += ' ';
    }
  }
  return normalizePdfTextLineBreaks(result);
}

function computePageDimensions(
  viewport: pdfjsLib.PageViewport,
  containerWidth: number,
  containerHeight: number
): { baseWidth: number; baseHeight: number; scale: number } {
  const scaleX = (containerWidth - PAGE_PADDING) / viewport.width;
  const scaleY = (containerHeight - PAGE_PADDING) / viewport.height;
  const scale = Math.max(0.1, Math.min(scaleX, scaleY, 2.5));
  return {
    baseWidth: Math.floor(viewport.width * scale),
    baseHeight: Math.floor(viewport.height * scale),
    scale,
  };
}

export class PdfRenderer {
  private doc: pdfjsLib.PDFDocumentProxy | null = null;
  private canvas: HTMLCanvasElement;
  private textPanel: HTMLElement;
  private container: HTMLElement;
  private wrapper: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private currentPage = 1;
  private totalPages = 0;
  private pdfId = '';
  private baseWidth = 0;
  private baseHeight = 0;
  private userZoom = 1;
  private textMode = false;
  private fontScale = 1;
  private baseFitFontSize = 0;
  private pageText = '';
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private onPageChange?: (page: number, total: number) => void;
  private onSave?: (page: number, total: number) => void;
  private renderGeneration = 0;

  constructor(
    canvas: HTMLCanvasElement,
    textPanel: HTMLElement,
    container: HTMLElement,
    wrapper: HTMLElement
  ) {
    this.canvas = canvas;
    this.textPanel = textPanel;
    this.container = container;
    this.wrapper = wrapper;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new AppError(ErrorCodes.PDF_002, 'canvas context unavailable');
    this.ctx = ctx;
  }

  setCallbacks(
    onPageChange: (page: number, total: number) => void,
    onSave: (page: number, total: number) => void
  ) {
    this.onPageChange = onPageChange;
    this.onSave = onSave;
  }

  async load(blob: Blob, pdfId: string, startPage = 1): Promise<void> {
    this.destroy();
    this.pdfId = pdfId;

    try {
      const data = await blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data });
      this.doc = await loadingTask.promise;
      this.totalPages = this.doc.numPages;
      this.currentPage = Math.min(Math.max(1, startPage), this.totalPages);
      logger.info(`PDF loaded: ${this.totalPages} pages, resuming at page ${this.currentPage}`);
      await this.renderCurrentPage();
      this.onPageChange?.(this.currentPage, this.totalPages);
      this.scheduleSave();
    } catch (err) {
      throw new AppError(ErrorCodes.PDF_001, this.pdfId);
    }
  }

  private async renderCurrentPage(): Promise<void> {
    if (!this.doc) return;

    if (this.textMode) {
      await this.renderTextPage();
      return;
    }

    const generation = ++this.renderGeneration;

    try {
      const page = await this.doc.getPage(this.currentPage);
      if (generation !== this.renderGeneration) return;

      const { width: containerWidth, height: containerHeight } = await waitForContainerSize(this.container);

      const viewport = page.getViewport({ scale: 1 });
      const { baseWidth, baseHeight, scale } = computePageDimensions(viewport, containerWidth, containerHeight);

      const outputScale = window.devicePixelRatio || 1;
      const scaledViewport = page.getViewport({ scale: scale * outputScale });

      this.baseWidth = baseWidth;
      this.baseHeight = baseHeight;

      this.canvas.width = Math.floor(scaledViewport.width);
      this.canvas.height = Math.floor(scaledViewport.height);
      this.canvas.style.width = `${this.baseWidth}px`;
      this.canvas.style.height = `${this.baseHeight}px`;

      this.resetZoom();

      const ctx = this.canvas.getContext('2d');
      if (!ctx) throw new AppError(ErrorCodes.PDF_002, 'canvas context unavailable');
      this.ctx = ctx;

      if (generation !== this.renderGeneration) return;

      await page.render({
        canvasContext: this.ctx,
        viewport: scaledViewport,
      }).promise;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(ErrorCodes.PDF_002, `page ${this.currentPage}`);
    }
  }

  private async renderTextPage(): Promise<void> {
    if (!this.doc) return;

    const generation = ++this.renderGeneration;

    try {
      const page = await this.doc.getPage(this.currentPage);
      if (generation !== this.renderGeneration) return;

      const { width: containerWidth, height: containerHeight } = await waitForContainerSize(this.container);

      const viewport = page.getViewport({ scale: 1 });
      const { baseWidth, baseHeight } = computePageDimensions(viewport, containerWidth, containerHeight);

      this.baseWidth = baseWidth;
      this.baseHeight = baseHeight;

      this.textPanel.style.width = `${this.baseWidth}px`;
      this.textPanel.style.height = `${this.baseHeight}px`;
      this.wrapper.style.width = `${this.baseWidth}px`;
      this.wrapper.style.height = `${this.baseHeight}px`;

      this.container.classList.remove('zoomed');
      this.container.scrollLeft = 0;
      this.container.scrollTop = 0;

      const content = await page.getTextContent();
      if (generation !== this.renderGeneration) return;

      this.pageText = textFromContent(content) || 'No extractable text on this page.';
      this.baseFitFontSize = DEFAULT_TEXT_FONT_PX;
      this.textPanel.textContent = this.pageText;
      this.applyTextFontSize();
      this.textPanel.scrollTop = 0;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(ErrorCodes.PDF_002, `page ${this.currentPage}`);
    }
  }

  private applyTextFontSize(): void {
    if (this.baseFitFontSize <= 0) return;
    this.textPanel.style.fontSize = `${this.baseFitFontSize * this.fontScale}px`;
  }

  async nextPage(): Promise<void> {
    if (!this.doc || this.currentPage >= this.totalPages) return;
    this.currentPage++;
    await this.renderCurrentPage();
    this.onPageChange?.(this.currentPage, this.totalPages);
    this.scheduleSave();
  }

  async prevPage(): Promise<void> {
    if (!this.doc || this.currentPage <= 1) return;
    this.currentPage--;
    await this.renderCurrentPage();
    this.onPageChange?.(this.currentPage, this.totalPages);
    this.scheduleSave();
  }

  getCurrentPage(): number {
    return this.currentPage;
  }

  getTotalPages(): number {
    return this.totalPages;
  }

  getZoom(): number {
    return this.textMode ? MIN_ZOOM : this.userZoom;
  }

  isTextMode(): boolean {
    return this.textMode;
  }

  async setTextMode(enabled: boolean): Promise<void> {
    if (this.textMode === enabled) return;
    this.textMode = enabled;
    this.resetZoom();
    this.canvas.classList.toggle('rendered', !enabled);
    this.textPanel.classList.toggle('rendered', enabled);
    if (this.doc) await this.renderCurrentPage();
  }

  adjustFontSize(deltaPx: number): void {
    if (!this.textMode || this.baseFitFontSize <= 0) return;
    const currentPx = this.baseFitFontSize * this.fontScale;
    const nextPx = Math.max(MIN_FONT_PX, Math.min(MAX_FONT_PX, currentPx + deltaPx));
    this.fontScale = nextPx / this.baseFitFontSize;
    this.textPanel.style.fontSize = `${nextPx}px`;
  }

  setZoom(zoom: number, focal?: { clientX: number; clientY: number }): void {
    if (this.textMode) return;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    const prevZoom = this.userZoom;

    if (focal && prevZoom !== nextZoom) {
      const rect = this.container.getBoundingClientRect();
      const contentX = (this.container.scrollLeft + focal.clientX - rect.left) / prevZoom;
      const contentY = (this.container.scrollTop + focal.clientY - rect.top) / prevZoom;
      this.userZoom = nextZoom;
      this.applyZoomTransform();
      this.container.scrollLeft = Math.max(0, contentX * nextZoom - (focal.clientX - rect.left));
      this.container.scrollTop = Math.max(0, contentY * nextZoom - (focal.clientY - rect.top));
      return;
    }

    if (nextZoom === prevZoom) return;
    this.userZoom = nextZoom;
    this.applyZoomTransform();
  }

  resetZoom(): void {
    this.userZoom = MIN_ZOOM;
    this.applyZoomTransform();
  }

  private applyZoomTransform(): void {
    if (this.baseWidth <= 0 || this.baseHeight <= 0) return;

    const scaledWidth = this.baseWidth * this.userZoom;
    const scaledHeight = this.baseHeight * this.userZoom;

    this.wrapper.style.width = `${scaledWidth}px`;
    this.wrapper.style.height = `${scaledHeight}px`;

    if (this.userZoom === MIN_ZOOM) {
      this.canvas.style.transform = '';
      this.canvas.style.transformOrigin = '';
      this.container.classList.remove('zoomed');
      this.container.scrollLeft = 0;
      this.container.scrollTop = 0;
      return;
    }

    this.canvas.style.transform = `scale(${this.userZoom})`;
    this.canvas.style.transformOrigin = '0 0';
    this.container.classList.add('zoomed');
  }

  private scheduleSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.onSave?.(this.currentPage, this.totalPages);
    }, 300);
  }

  async resize(): Promise<void> {
    if (this.doc) await this.renderCurrentPage();
  }

  destroy(): void {
    this.renderGeneration++;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }
  }
}

export const SWIPE_THRESHOLD = 50;

export function setupSwipe(
  element: HTMLElement,
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  options?: { shouldSwipe?: () => boolean }
): () => void {
  let startX = 0;
  let startY = 0;
  let touchCount = 0;

  const onTouchStart = (e: TouchEvent) => {
    touchCount = e.touches.length;
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (touchCount !== 1 || e.changedTouches.length !== 1) return;
    if (options?.shouldSwipe && !options.shouldSwipe()) return;

    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;

    if (dx < 0) {
      onSwipeLeft();
    } else {
      onSwipeRight();
    }
  };

  element.addEventListener('touchstart', onTouchStart, { passive: true });
  element.addEventListener('touchend', onTouchEnd, { passive: true });

  return () => {
    element.removeEventListener('touchstart', onTouchStart);
    element.removeEventListener('touchend', onTouchEnd);
  };
}

function getTouchDistance(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function getTouchCenter(touches: TouchList): { clientX: number; clientY: number } {
  return {
    clientX: (touches[0].clientX + touches[1].clientX) / 2,
    clientY: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

export function setupZoomGestures(
  container: HTMLElement,
  getZoom: () => number,
  setZoom: (zoom: number, focal?: { clientX: number; clientY: number }) => void
): () => void {
  let pinching = false;
  let initialDistance = 0;
  let initialZoom = MIN_ZOOM;

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 2) return;
    pinching = true;
    initialDistance = getTouchDistance(e.touches);
    initialZoom = getZoom();
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!pinching || e.touches.length !== 2 || initialDistance <= 0) return;
    const distance = getTouchDistance(e.touches);
    const center = getTouchCenter(e.touches);
    setZoom(initialZoom * (distance / initialDistance), center);
    e.preventDefault();
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) pinching = false;
  };

  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.01);
    setZoom(getZoom() * factor, { clientX: e.clientX, clientY: e.clientY });
  };

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
  container.addEventListener('touchcancel', onTouchEnd, { passive: true });
  container.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('touchcancel', onTouchEnd);
    container.removeEventListener('wheel', onWheel);
  };
}
