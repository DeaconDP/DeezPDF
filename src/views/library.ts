import {
  addPdfFiles,
  addPdfFolder,
  getAllPdfs,
  removePdf,
  searchPdfs,
  type PdfMeta,
} from '../lib/library';
import { formatError } from '../lib/errors';
import { logger } from '../lib/logger';
import { showLoading } from '../components/loading';

export type LibraryCallbacks = {
  onOpenPdf: (id: string) => void;
};

export function createLibraryView(callbacks: LibraryCallbacks): HTMLElement {
  const view = document.createElement('div');
  view.className = 'view library-view';

  view.innerHTML = `
    <header class="header">
      <h1 class="logo">Deez<span class="accent">PDF</span></h1>
      <p class="tagline">Your local PDF library</p>
    </header>

    <div class="toolbar">
      <div class="search-box">
        <input type="search" class="search-input" placeholder="Search library..." aria-label="Search library" />
      </div>
      <div class="toolbar-actions">
        <label class="btn btn-primary">
          Add PDF
          <input type="file" accept=".pdf" multiple hidden class="file-input" />
        </label>
        <button class="btn btn-secondary folder-btn">Add Folder</button>
      </div>
    </div>

    <div class="toast hidden"></div>
    <div class="pdf-list"></div>

    <div class="empty-state hidden">
      <div class="empty-icon">📄</div>
      <p>No PDFs in your library yet</p>
      <p class="empty-hint">Add a PDF or folder to get started</p>
    </div>
  `;

  const searchInput = view.querySelector('.search-input') as HTMLInputElement;
  const fileInput = view.querySelector('.file-input') as HTMLInputElement;
  const folderBtn = view.querySelector('.folder-btn') as HTMLButtonElement;
  const pdfList = view.querySelector('.pdf-list') as HTMLElement;
  const emptyState = view.querySelector('.empty-state') as HTMLElement;
  const toast = view.querySelector('.toast') as HTMLElement;

  let pdfs: PdfMeta[] = [];

  function showToast(message: string, isError = false) {
    toast.textContent = message;
    toast.className = `toast ${isError ? 'toast-error' : 'toast-info'}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  function renderList(items: PdfMeta[]) {
    pdfList.innerHTML = '';

    if (items.length === 0) {
      emptyState.classList.remove('hidden');
      pdfList.classList.add('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    pdfList.classList.remove('hidden');

    for (const pdf of items) {
      const card = document.createElement('div');
      card.className = 'pdf-card';
      card.innerHTML = `
        <div class="pdf-card-info" data-id="${pdf.id}">
          <span class="pdf-name">${escapeHtml(pdf.name)}</span>
          <span class="pdf-meta">
            ${formatBytes(pdf.size)}
            ${pdf.totalPages > 0 ? ` · Page ${pdf.currentPage}/${pdf.totalPages}` : ''}
          </span>
        </div>
        <button class="btn-icon remove-btn" data-id="${pdf.id}" aria-label="Remove ${escapeHtml(pdf.name)}" title="Remove">&times;</button>
      `;

      card.querySelector('.pdf-card-info')?.addEventListener('click', () => {
        callbacks.onOpenPdf(pdf.id);
      });

      card.querySelector('.remove-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Remove "${pdf.name}" from library?`)) {
          await removePdf(pdf.id);
          await refresh();
        }
      });

      pdfList.appendChild(card);
    }
  }

  async function refresh() {
    pdfs = await getAllPdfs();
    const query = searchInput.value;
    const filtered = query ? await searchPdfs(query) : pdfs;
    renderList(filtered);
  }

  searchInput.addEventListener('input', async () => {
    const filtered = await searchPdfs(searchInput.value);
    renderList(filtered);
  });

  fileInput.addEventListener('change', async () => {
    if (!fileInput.files?.length) return;
    const hideLoading = showLoading(view, 'Adding PDFs...');
    try {
      await addPdfFiles(fileInput.files);
      await refresh();
      showToast(`Added ${fileInput.files.length} file(s)`);
    } catch (err) {
      showToast(formatError(err), true);
      logger.logError('Failed to add PDFs', err);
    } finally {
      hideLoading();
      fileInput.value = '';
    }
  });

  folderBtn.addEventListener('click', async () => {
    const hideLoading = showLoading(view, 'Scanning folder...');
    try {
      const added = await addPdfFolder();
      await refresh();
      showToast(`Added ${added.length} PDF(s) from folder`);
    } catch (err) {
      showToast(formatError(err), true);
      logger.logError('Failed to add folder', err);
    } finally {
      hideLoading();
    }
  });

  refresh();
  return view;
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
