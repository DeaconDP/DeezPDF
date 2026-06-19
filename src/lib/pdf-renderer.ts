import * as pdfjsLib from 'pdfjs-dist';
import { AppError, ErrorCodes } from './errors';
import { logger } from './logger';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export class PdfRenderer {
  private doc: pdfjsLib.PDFDocumentProxy | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentPage = 1;
  private totalPages = 0;
  private pdfId = '';
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private onPageChange?: (page: number, total: number) => void;
  private onSave?: (page: number, total: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
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
      logger.info(`PDF loaded: ${this.totalPages} pages`);
      await this.renderCurrentPage();
      this.onPageChange?.(this.currentPage, this.totalPages);
      this.scheduleSave();
    } catch (err) {
      throw new AppError(ErrorCodes.PDF_001, this.pdfId);
    }
  }

  private async renderCurrentPage(): Promise<void> {
    if (!this.doc) return;

    try {
      const page = await this.doc.getPage(this.currentPage);
      const container = this.canvas.parentElement;
      const containerWidth = container?.clientWidth ?? window.innerWidth;
      const containerHeight = container?.clientHeight ?? window.innerHeight;

      const viewport = page.getViewport({ scale: 1 });
      const scaleX = (containerWidth - 32) / viewport.width;
      const scaleY = (containerHeight - 32) / viewport.height;
      const scale = Math.min(scaleX, scaleY, 2);

      const scaledViewport = page.getViewport({ scale });
      this.canvas.width = scaledViewport.width;
      this.canvas.height = scaledViewport.height;

      await page.render({
        canvasContext: this.ctx,
        viewport: scaledViewport,
      }).promise;
    } catch (err) {
      throw new AppError(ErrorCodes.PDF_002, `page ${this.currentPage}`);
    }
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
  onSwipeRight: () => void
): () => void {
  let startX = 0;
  let startY = 0;

  const onTouchStart = (e: TouchEvent) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  };

  const onTouchEnd = (e: TouchEvent) => {
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
