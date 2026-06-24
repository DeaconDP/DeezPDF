import {
  addPdfFiles,
  addPdfFolder,
  downloadAndAddPdf,
  getAllPdfs,
  queryPdfs,
  removePdf,
  renamePdf,
  supportsDirectoryPicker,
  supportsSaveFilePicker,
  type PdfFilter,
  type PdfMeta,
  type PdfSort,
} from '../lib/library';
import { formatError, AppError } from '../lib/errors';
import { agentDebugLog } from '../lib/agent-debug';
import { logger } from '../lib/logger';
import { isIOS } from '../lib/platform';
import { showLoading } from '../components/loading';
import { sym } from '../lib/symbols';

export type LibraryCallbacks = {
  onOpenPdf: (id: string) => void;
};

const PREFS_KEY = 'deezpdf-library-prefs';

type LibraryPrefs = {
  filter: PdfFilter;
  sort: PdfSort;
};

function loadPrefs(): LibraryPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw) as LibraryPrefs;
  } catch {
    /* ignore */
  }
  return { filter: 'all', sort: 'lastOpened-desc' };
}

function savePrefs(prefs: LibraryPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function createLibraryView(callbacks: LibraryCallbacks): HTMLElement {
  const view = document.createElement('div');
  view.className = 'view library-view';

  view.innerHTML = `
    <header class="header">
      <div class="brand-icon icon" aria-hidden="true">${sym.brand}</div>
      <h1 class="logo">Deez<span class="accent">PDF</span></h1>
      <p class="tagline">Your local PDF library</p>
    </header>

    <div class="toolbar">
      <div class="search-box">
        <span class="search-icon icon" aria-hidden="true">${sym.search}</span>
        <input type="search" class="search-input" placeholder="Search library…" aria-label="Search library" />
      </div>
      <div class="toolbar-actions">
        <label class="btn btn-primary">
          <span class="icon" aria-hidden="true">${sym.add}</span>
          Add PDF
          <input type="file" accept=".pdf" multiple hidden class="file-input" />
        </label>
        <button class="btn btn-secondary folder-btn">
          <span class="icon" aria-hidden="true">${sym.folder}</span>
          Add Folder
        </button>
        <button class="btn btn-secondary download-btn">
          <span class="icon" aria-hidden="true">${sym.download}</span>
          Download URL
        </button>
        <label class="btn btn-secondary folder-fallback hidden">
          <span class="icon" aria-hidden="true">${sym.folder}</span>
          Add Folder
          <input type="file" webkitdirectory directory multiple hidden class="folder-input" />
        </label>
      </div>
    </div>

    <div class="library-controls">
      <label class="control-label">
        <span class="control-text">Filter</span>
        <select class="filter-select" aria-label="Filter library">
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="reading">In progress</option>
          <option value="finished">Finished</option>
        </select>
      </label>
      <label class="control-label">
        <span class="control-text">Sort</span>
        <select class="sort-select" aria-label="Sort library">
          <option value="lastOpened-desc">Recently opened</option>
          <option value="dateAdded-desc">Date added (newest)</option>
          <option value="dateAdded-asc">Date added (oldest)</option>
          <option value="name-asc">Name (A–Z)</option>
          <option value="name-desc">Name (Z–A)</option>
          <option value="size-desc">Size (largest)</option>
          <option value="size-asc">Size (smallest)</option>
        </select>
      </label>
      <span class="library-count" aria-live="polite"></span>
    </div>

    <div class="toast hidden"></div>
    <div class="download-dialog hidden" role="dialog" aria-modal="true" aria-labelledby="download-dialog-title">
      <div class="download-dialog-panel">
        <div class="download-dialog-header">
          <h2 id="download-dialog-title" class="download-dialog-title">Download PDF</h2>
          <button class="btn-icon download-close-btn" aria-label="Close download dialog" title="Close">
            <span class="icon" aria-hidden="true">${sym.close}</span>
          </button>
        </div>
        <p class="download-dialog-hint">Enter a direct link to a PDF file.</p>
        <label class="download-url-label">
          <span class="control-text">PDF URL</span>
          <input type="url" class="download-url-input" placeholder="https://example.com/document.pdf" autocomplete="url" inputmode="url" />
        </label>
        <p class="download-save-hint hidden"></p>
        <div class="download-dialog-actions">
          <button type="button" class="btn btn-ghost download-cancel-btn">Cancel</button>
          <button type="button" class="btn btn-primary download-submit-btn">
            <span class="icon" aria-hidden="true">${sym.download}</span>
            Download
          </button>
        </div>
      </div>
    </div>
    <div class="pdf-list"></div>

    <div class="empty-state hidden">
      <div class="empty-icon icon" aria-hidden="true">${sym.document}</div>
      <p class="empty-message">No PDFs in your library yet</p>
      <p class="empty-hint">Add a PDF or folder to get started</p>
    </div>
  `;

  const searchInput = view.querySelector('.search-input') as HTMLInputElement;
  const filterSelect = view.querySelector('.filter-select') as HTMLSelectElement;
  const sortSelect = view.querySelector('.sort-select') as HTMLSelectElement;
  const libraryCount = view.querySelector('.library-count') as HTMLElement;
  const fileInput = view.querySelector('.file-input') as HTMLInputElement;
  const folderBtn = view.querySelector('.folder-btn') as HTMLButtonElement;
  const folderFallback = view.querySelector('.folder-fallback') as HTMLLabelElement;
  const folderInput = view.querySelector('.folder-input') as HTMLInputElement;
  const downloadBtn = view.querySelector('.download-btn') as HTMLButtonElement;
  const downloadDialog = view.querySelector('.download-dialog') as HTMLElement;
  const downloadUrlInput = view.querySelector('.download-url-input') as HTMLInputElement;
  const downloadSaveHint = view.querySelector('.download-save-hint') as HTMLElement;
  const downloadSubmitBtn = view.querySelector('.download-submit-btn') as HTMLButtonElement;
  const downloadCancelBtn = view.querySelector('.download-cancel-btn') as HTMLButtonElement;
  const downloadCloseBtn = view.querySelector('.download-close-btn') as HTMLButtonElement;
  const pdfList = view.querySelector('.pdf-list') as HTMLElement;
  const emptyState = view.querySelector('.empty-state') as HTMLElement;
  const emptyMessage = view.querySelector('.empty-message') as HTMLElement;
  const emptyHint = view.querySelector('.empty-hint') as HTMLElement;
  const toast = view.querySelector('.toast') as HTMLElement;

  const prefs = loadPrefs();
  filterSelect.value = prefs.filter;
  sortSelect.value = prefs.sort;

  let pdfs: PdfMeta[] = [];

  function showToast(message: string, isError = false) {
    toast.textContent = message;
    toast.className = `toast ${isError ? 'toast-error' : 'toast-info'}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  function openDownloadDialog() {
    downloadUrlInput.value = '';
    downloadSaveHint.classList.add('hidden');
    if (supportsSaveFilePicker()) {
      downloadSaveHint.textContent = 'You will choose where to save the file before it is added to your library.';
      downloadSaveHint.classList.remove('hidden');
    } else {
      downloadSaveHint.textContent = 'Save location picker is unavailable here. The PDF will be added to your library only.';
      downloadSaveHint.classList.remove('hidden');
    }
    downloadDialog.classList.remove('hidden');
    downloadUrlInput.focus();
  }

  function closeDownloadDialog() {
    downloadDialog.classList.add('hidden');
  }

  async function submitDownload() {
    const url = downloadUrlInput.value.trim();
    if (!url) {
      showToast('Enter a PDF URL', true);
      downloadUrlInput.focus();
      return;
    }

    closeDownloadDialog();
    const hideLoading = showLoading(view, 'Downloading PDF...');
    try {
      const { meta, savedToDisk } = await downloadAndAddPdf(url);
      await refresh();
      if (savedToDisk) {
        showToast(`Saved and added "${meta.name}"`);
      } else {
        showToast(`Added "${meta.name}" to library`);
      }
    } catch (err) {
      agentDebugLog(
        'library.ts:submitDownload:error',
        'submitDownload failed',
        {
          url,
          errorName: err instanceof Error ? err.name : 'unknown',
          errorMessage: err instanceof Error ? err.message : String(err),
          errorCode: err instanceof AppError ? err.code : undefined,
        },
        'ALL',
      );
      showToast(formatError(err), true);
      logger.logError('Failed to download PDF', err);
    } finally {
      hideLoading();
    }
  }

  function renderList(items: PdfMeta[]) {
    pdfList.innerHTML = '';

    const hasQuery = searchInput.value.trim().length > 0;
    const hasFilter = filterSelect.value !== 'all';

    if (items.length === 0) {
      emptyState.classList.remove('hidden');
      pdfList.classList.add('hidden');
      libraryCount.textContent = '';

      if (pdfs.length === 0) {
        emptyMessage.textContent = 'No PDFs in your library yet';
        emptyHint.textContent = 'Add a PDF or folder to get started';
        emptyHint.classList.remove('hidden');
      } else {
        emptyMessage.textContent = 'No PDFs match your filters';
        emptyHint.classList.add('hidden');
      }
      return;
    }

    emptyState.classList.add('hidden');
    pdfList.classList.remove('hidden');

    const countLabel =
      hasQuery || hasFilter ? `${items.length} of ${pdfs.length}` : `${items.length}`;
    libraryCount.textContent = `${countLabel} PDF${items.length === 1 ? '' : 's'}`;

    for (const pdf of items) {
      const card = document.createElement('div');
      card.className = 'pdf-card';
      card.innerHTML = `
        <div class="pdf-card-info" data-id="${pdf.id}">
          <span class="pdf-card-icon icon" aria-hidden="true">${sym.document}</span>
          <div class="pdf-card-text">
            <span class="pdf-name">${escapeHtml(pdf.name)}</span>
            <span class="pdf-meta">
              ${formatBytes(pdf.size)}
              ${pdf.totalPages > 0 ? ` · ${pdf.currentPage}/${pdf.totalPages}` : ''}
            </span>
          </div>
        </div>
        <div class="pdf-card-actions">
          <button class="btn-icon rename-btn" data-id="${pdf.id}" aria-label="Rename ${escapeHtml(pdf.name)}" title="Rename">
            <span class="icon" aria-hidden="true">${sym.edit}</span>
          </button>
          <button class="btn-icon remove-btn" data-id="${pdf.id}" aria-label="Remove ${escapeHtml(pdf.name)}" title="Remove">
            <span class="icon" aria-hidden="true">${sym.remove}</span>
          </button>
        </div>
      `;

      card.querySelector('.pdf-card-info')?.addEventListener('click', () => {
        if (card.querySelector('.pdf-name-input')) return;
        callbacks.onOpenPdf(pdf.id);
      });

      card.querySelector('.rename-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        startRename(card, pdf);
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

  function startRename(card: HTMLElement, pdf: PdfMeta) {
    const nameEl = card.querySelector('.pdf-name') as HTMLElement | null;
    if (!nameEl || card.querySelector('.pdf-name-input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pdf-name-input';
    input.value = pdf.name;
    input.setAttribute('aria-label', `Rename ${pdf.name}`);
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;

    async function finish(save: boolean) {
      if (finished) return;
      finished = true;

      const span = document.createElement('span');
      span.className = 'pdf-name';

      if (save) {
        const nextName = input.value.trim();
        if (!nextName) {
          span.textContent = pdf.name;
          showToast('Name cannot be empty', true);
        } else if (nextName !== pdf.name) {
          try {
            await renamePdf(pdf.id, nextName);
            span.textContent = nextName;
            showToast('PDF renamed');
            await refresh();
            return;
          } catch (err) {
            span.textContent = pdf.name;
            showToast(formatError(err), true);
            logger.logError('Failed to rename PDF', err);
          }
        } else {
          span.textContent = pdf.name;
        }
      } else {
        span.textContent = pdf.name;
      }

      input.replaceWith(span);
    }

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        void finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        void finish(false);
      }
    });

    input.addEventListener('click', (e) => e.stopPropagation());

    input.addEventListener('blur', () => {
      void finish(true);
    });
  }

  async function applyQuery() {
    const filter = filterSelect.value as PdfFilter;
    const sort = sortSelect.value as PdfSort;
    savePrefs({ filter, sort });

    const items = await queryPdfs({
      query: searchInput.value,
      filter,
      sort,
    });
    renderList(items);
  }

  async function refresh() {
    pdfs = await getAllPdfs();
    await applyQuery();
  }

  searchInput.addEventListener('input', () => applyQuery());
  filterSelect.addEventListener('change', () => applyQuery());
  sortSelect.addEventListener('change', () => applyQuery());

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

  if (isIOS()) {
    folderBtn.classList.add('hidden');
    folderFallback.classList.add('hidden');
  } else if (supportsDirectoryPicker()) {
    folderFallback.classList.add('hidden');
  } else {
    folderBtn.classList.add('hidden');
    folderFallback.classList.remove('hidden');
  }

  folderInput.addEventListener('change', async () => {
    if (!folderInput.files?.length) return;
    const hideLoading = showLoading(view, 'Scanning folder...');
    try {
      const added = await addPdfFiles(folderInput.files);
      await refresh();
      showToast(`Added ${added.length} PDF(s) from folder`);
    } catch (err) {
      showToast(formatError(err), true);
      logger.logError('Failed to add folder', err);
    } finally {
      hideLoading();
      folderInput.value = '';
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

  downloadBtn.addEventListener('click', () => openDownloadDialog());
  downloadCancelBtn.addEventListener('click', () => closeDownloadDialog());
  downloadCloseBtn.addEventListener('click', () => closeDownloadDialog());
  downloadSubmitBtn.addEventListener('click', () => void submitDownload());
  downloadUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submitDownload();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDownloadDialog();
    }
  });
  downloadDialog.addEventListener('click', (e) => {
    if (e.target === downloadDialog) closeDownloadDialog();
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
