import {
  addPdfFiles,
  downloadAndAddPdf,
  getAllPdfs,
  queryPdfs,
  removePdf,
  renamePdf,
  supportsSaveFilePicker,
  type PdfFilter,
  type PdfMeta,
  type PdfSort,
} from '../lib/library';
import { formatError, AppError } from '../lib/errors';
import { agentDebugLog } from '../lib/agent-debug';
import { logger } from '../lib/logger';
import { showLoading } from '../components/loading';
import { brandLogoSrc } from '../lib/brand';
import { sym } from '../lib/symbols';
import { createLookupPanel } from './lookup';
import type { LookupResult } from '../lib/lookup/types';

export type LibraryTab = 'library' | 'find';

export type LibraryCallbacks = {
  onOpenPdf: (id: string) => void;
  onPreview: (result: LookupResult, blob: Blob) => void;
};

export type LibraryOptions = {
  initialTab?: LibraryTab;
};

const PREFS_KEY = 'deezpdf-library-prefs';
const TAB_KEY = 'deezpdf-library-tab';

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

function loadTab(): LibraryTab {
  try {
    const raw = localStorage.getItem(TAB_KEY);
    if (raw === 'library' || raw === 'find') return raw;
  } catch {
    /* ignore */
  }
  return 'library';
}

function saveTab(tab: LibraryTab) {
  localStorage.setItem(TAB_KEY, tab);
}

export function createLibraryView(
  callbacks: LibraryCallbacks,
  options?: LibraryOptions,
): HTMLElement {
  const view = document.createElement('div');
  view.className = 'view library-view app-shell';

  view.innerHTML = `
    <header class="library-shell-header">
      <div class="library-brand">
        <div class="brand-mark brand-mark-compact">
          <img class="brand-logo" src="${brandLogoSrc}" width="28" height="28" alt="" aria-hidden="true" />
        </div>
        <div class="library-brand-text">
          <h1 class="logo logo-compact">Deez<span class="accent">PDF</span></h1>
        </div>
      </div>
      <div class="segmented-control" role="tablist" aria-label="Library sections">
        <button type="button" class="segmented-control-btn" role="tab" id="tab-library" aria-controls="panel-library" aria-selected="true" tabindex="0">My Library</button>
        <button type="button" class="segmented-control-btn" role="tab" id="tab-find" aria-controls="panel-find" aria-selected="false" tabindex="-1">Find Online</button>
      </div>
    </header>

    <div class="library-panel" id="panel-library" role="tabpanel" aria-labelledby="tab-library">
      <p class="feature-hint library-panel-intro">PDFs stay on this device and work offline.</p>
      <div class="library-toolbar">
        <div class="search-box">
          <span class="search-icon icon" aria-hidden="true">${sym.search}</span>
          <input type="search" class="search-input" placeholder="Search by title…" aria-label="Search library" />
        </div>
        <div class="library-toolbar-actions">
          <label class="btn btn-primary">
            <span class="icon" aria-hidden="true">${sym.add}</span>
            <span class="btn-label">Add PDF</span>
            <input type="file" accept=".pdf" multiple hidden class="file-input" />
          </label>
          <button type="button" class="btn btn-primary download-btn download-btn-inline">
            <span class="icon" aria-hidden="true">${sym.download}</span>
            <span class="btn-label">Download URL</span>
          </button>
        </div>
        <p class="feature-hint feature-hint--compact">Add files from your device, or download from a direct PDF link.</p>
      </div>

      <div class="library-controls">
        <label class="control-label">
          <span class="control-glyph icon icon-glyph" aria-hidden="true">${sym.filter}</span>
          <span class="control-text">Filter</span>
          <select class="filter-select" aria-label="Filter library">
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="reading">In progress</option>
            <option value="finished">Finished</option>
          </select>
        </label>
        <label class="control-label">
          <span class="control-glyph icon icon-glyph" aria-hidden="true">${sym.sort}</span>
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
      <p class="feature-hint feature-hint--compact">Unread = not opened yet · In progress = partly read · Finished = last page reached.</p>

      <div class="content-scroll library-content">
        <div class="pdf-list"></div>
        <div class="empty-state hidden">
          <div class="empty-icon icon icon-glyph" aria-hidden="true">${sym.empty}</div>
          <p class="empty-message">No PDFs in your library yet</p>
          <p class="empty-hint">Add a PDF to get started</p>
        </div>
      </div>
    </div>

    <div class="library-panel hidden" id="panel-find" role="tabpanel" aria-labelledby="tab-find" hidden></div>

    <div class="toast hidden"></div>
    <div class="download-dialog hidden" role="dialog" aria-modal="true" aria-labelledby="download-dialog-title">
      <div class="download-dialog-panel">
        <div class="download-dialog-header">
          <h2 id="download-dialog-title" class="download-dialog-title">Download PDF</h2>
          <button class="btn-icon download-close-btn" aria-label="Close download dialog" title="Close">
            <span class="icon" aria-hidden="true">${sym.close}</span>
          </button>
        </div>
        <p class="download-dialog-hint">Paste a direct link that ends in .pdf — not a webpage.</p>
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
  `;

  const tabLibrary = view.querySelector('#tab-library') as HTMLButtonElement;
  const tabFind = view.querySelector('#tab-find') as HTMLButtonElement;
  const panelLibrary = view.querySelector('#panel-library') as HTMLElement;
  const panelFind = view.querySelector('#panel-find') as HTMLElement;
  const searchInput = view.querySelector('.search-input') as HTMLInputElement;
  const filterSelect = view.querySelector('.filter-select') as HTMLSelectElement;
  const sortSelect = view.querySelector('.sort-select') as HTMLSelectElement;
  const libraryCount = view.querySelector('.library-count') as HTMLElement;
  const fileInput = view.querySelector('.file-input') as HTMLInputElement;
  const downloadBtn = view.querySelector('.download-btn-inline') as HTMLButtonElement;
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
  let activeTab: LibraryTab = options?.initialTab ?? loadTab();

  const lookupPanel = createLookupPanel(
    {
      onPreview: callbacks.onPreview,
      onAdded: () => {
        void refresh();
      },
    },
    { loadingRoot: view },
  );
  panelFind.appendChild(lookupPanel);

  function showToast(message: string, isError = false) {
    toast.textContent = message;
    toast.className = `toast ${isError ? 'toast-error' : 'toast-info'}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  function setTab(tab: LibraryTab) {
    activeTab = tab;
    saveTab(tab);

    const isLibrary = tab === 'library';
    tabLibrary.setAttribute('aria-selected', String(isLibrary));
    tabFind.setAttribute('aria-selected', String(!isLibrary));
    tabLibrary.tabIndex = isLibrary ? 0 : -1;
    tabFind.tabIndex = isLibrary ? -1 : 0;

    panelLibrary.classList.toggle('hidden', !isLibrary);
    panelFind.classList.toggle('hidden', isLibrary);
    panelFind.hidden = isLibrary;
    panelLibrary.hidden = !isLibrary;

    if (!isLibrary) {
      lookupPanel.querySelector<HTMLInputElement>('.lookup-query-input')?.focus();
    }
  }

  function handleTabKeydown(e: KeyboardEvent, tabs: HTMLButtonElement[], index: number) {
    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    const nextTab = tabs[nextIndex];
    setTab(nextTab.id === 'tab-find' ? 'find' : 'library');
    nextTab.focus();
  }

  const tabs = [tabLibrary, tabFind];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      setTab(tab.id === 'tab-find' ? 'find' : 'library');
    });
    tab.addEventListener('keydown', (e) => handleTabKeydown(e, tabs, index));
  });

  setTab(activeTab);

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
        emptyHint.textContent = 'Add a PDF to get started';
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

    items.forEach((pdf, index) => {
      const card = document.createElement('div');
      card.className = `pdf-card${pdf.lastOpened === 0 ? ' pdf-card-unread' : ''}`;
      card.style.setProperty('--stagger', String(index));
      card.innerHTML = `
        <div class="pdf-card-info" data-id="${pdf.id}">
          <span class="pdf-card-icon icon icon-glyph" aria-hidden="true">${sym.document}</span>
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
    });
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
