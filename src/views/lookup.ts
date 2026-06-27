import { addLookupResultToLibrary } from '../lib/library';
import { fetchPdfFromUrl } from '../lib/download';
import { AppError, ErrorCodes, formatError } from '../lib/errors';
import { searchLookupPdfs, type LookupResult, type LookupSource } from '../lib/lookup/search';
import { cachePreviewBlob } from '../lib/lookup/preview-cache';
import { logger } from '../lib/logger';
import { showLoading } from '../components/loading';
import { sym } from '../lib/symbols';
import type { PdfMeta } from '../lib/library';

export type LookupPanelCallbacks = {
  onPreview: (result: LookupResult, blob: Blob) => void;
  onAdded: (meta: PdfMeta) => void;
};

export type LookupPanelOptions = {
  loadingRoot: HTMLElement;
};

type SourceFilter = 'all' | LookupSource;

const SOURCE_LABELS: Record<LookupSource, string> = {
  archive: 'Archive',
  gutenberg: 'Gutenberg',
  web: 'Web',
};

export function createLookupPanel(
  callbacks: LookupPanelCallbacks,
  options: LookupPanelOptions,
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'lookup-panel';

  panel.innerHTML = `
    <div class="lookup-search-bar">
      <div class="search-box">
        <span class="search-icon icon" aria-hidden="true">${sym.lookup}</span>
        <input type="search" class="lookup-query-input" placeholder="Book title, author, or topic…" aria-label="Search for PDFs" />
      </div>
      <button type="button" class="btn btn-primary lookup-search-btn">
        <span class="icon" aria-hidden="true">${sym.search}</span>
        <span class="btn-label">Search</span>
      </button>
    </div>

    <div class="lookup-filters" role="group" aria-label="Filter by source">
      <button type="button" class="lookup-filter-chip active" data-filter="all">All</button>
      <button type="button" class="lookup-filter-chip" data-filter="archive">Archive</button>
      <button type="button" class="lookup-filter-chip" data-filter="gutenberg">Gutenberg</button>
      <button type="button" class="lookup-filter-chip" data-filter="web">Web</button>
    </div>

    <p class="lookup-disclaimer">Only download PDFs you have the right to use.</p>
    <p class="lookup-notice hidden" aria-live="polite"></p>

    <div class="content-scroll lookup-content">
      <div class="lookup-results pdf-list hidden"></div>

      <div class="lookup-empty empty-state hidden">
        <div class="empty-icon icon icon-glyph" aria-hidden="true">${sym.empty}</div>
        <p class="empty-message">Search for a book or author to find PDFs</p>
        <p class="empty-hint">Results come from Internet Archive, Project Gutenberg, and the web</p>
      </div>

      <div class="lookup-no-results empty-state hidden">
        <div class="empty-icon icon icon-glyph" aria-hidden="true">${sym.empty}</div>
        <p class="empty-message">No PDFs found</p>
        <p class="empty-hint">Try a different search term or source filter</p>
        <button type="button" class="btn btn-secondary lookup-retry-btn">Search again</button>
      </div>
    </div>

    <div class="toast hidden"></div>
  `;

  const queryInput = panel.querySelector('.lookup-query-input') as HTMLInputElement;
  const searchBtn = panel.querySelector('.lookup-search-btn') as HTMLButtonElement;
  const filterChips = panel.querySelectorAll('.lookup-filter-chip') as NodeListOf<HTMLButtonElement>;
  const resultsList = panel.querySelector('.lookup-results') as HTMLElement;
  const emptyState = panel.querySelector('.lookup-empty') as HTMLElement;
  const noResultsState = panel.querySelector('.lookup-no-results') as HTMLElement;
  const retryBtn = panel.querySelector('.lookup-retry-btn') as HTMLButtonElement;
  const noticeEl = panel.querySelector('.lookup-notice') as HTMLElement;
  const toast = panel.querySelector('.toast') as HTMLElement;
  const loadingRoot = options.loadingRoot;

  let allResults: LookupResult[] = [];
  let sourceFilter: SourceFilter = 'all';
  let addedIds = new Set<string>();
  let lastQuery = '';

  function showToast(message: string, isError = false) {
    toast.textContent = message;
    toast.className = `toast ${isError ? 'toast-error' : 'toast-info'}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  function setFilter(next: SourceFilter) {
    sourceFilter = next;
    filterChips.forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.filter === next);
    });
    renderResults();
  }

  function filteredResults(): LookupResult[] {
    if (sourceFilter === 'all') return allResults;
    return allResults.filter((result) => result.source === sourceFilter);
  }

  function updateVisibility(hasSearched: boolean, items: LookupResult[]) {
    noticeEl.classList.add('hidden');
    emptyState.classList.add('hidden');
    noResultsState.classList.add('hidden');
    resultsList.classList.add('hidden');

    if (!hasSearched) {
      emptyState.classList.remove('hidden');
      return;
    }

    if (items.length === 0) {
      noResultsState.classList.remove('hidden');
      return;
    }

    resultsList.classList.remove('hidden');
  }

  function renderResults() {
    const items = filteredResults();
    updateVisibility(lastQuery.length > 0, items);
    resultsList.innerHTML = '';

    items.forEach((result, index) => {
      const card = document.createElement('div');
      card.className = 'lookup-card';
      card.style.setProperty('--stagger', String(index));
      const authors = result.authors?.join(', ');
      const isAdded = addedIds.has(result.id);

      const title = escapeHtml(result.title);
      const addLabel = isAdded ? 'Added to library' : 'Add to library';

      card.innerHTML = `
        <div class="lookup-card-body">
          <p class="lookup-card-title">${title}</p>
          <div class="lookup-card-meta">
            <span class="lookup-source-badge lookup-source-${result.source}">${SOURCE_LABELS[result.source]}</span>
            ${authors ? `<span class="lookup-card-authors">${escapeHtml(authors)}</span>` : ''}
          </div>
          ${result.snippet ? `<p class="lookup-snippet">${escapeHtml(result.snippet)}</p>` : ''}
        </div>
        <div class="lookup-card-actions">
          <button type="button" class="btn-icon lookup-preview-btn" data-id="${escapeHtml(result.id)}" aria-label="Preview ${title}" title="Preview">
            <span class="icon icon-glyph" aria-hidden="true">${sym.preview}</span>
          </button>
          <button type="button" class="btn-icon lookup-add-btn" data-id="${escapeHtml(result.id)}" aria-label="${addLabel}: ${title}" title="${addLabel}" ${isAdded ? 'disabled' : ''}>
            <span class="icon icon-glyph" aria-hidden="true">${sym.add}</span>
          </button>
        </div>
      `;

      card.querySelector('.lookup-preview-btn')?.addEventListener('click', () => {
        void previewResult(result);
      });

      card.querySelector('.lookup-add-btn')?.addEventListener('click', () => {
        void addResult(result);
      });

      resultsList.appendChild(card);
    });
  }

  async function previewResult(result: LookupResult) {
    const hideLoading = showLoading(loadingRoot, 'Loading preview...');
    try {
      const { blob } = await fetchPdfFromUrl(result.pdfUrl);
      cachePreviewBlob(result.id, blob);
      callbacks.onPreview(result, blob);
    } catch (err) {
      showToast(formatError(err), true);
      logger.logError('Failed to load preview', err);
    } finally {
      hideLoading();
    }
  }

  async function addResult(result: LookupResult) {
    const hideLoading = showLoading(loadingRoot, 'Adding to library...');
    try {
      const meta = await addLookupResultToLibrary(result);
      addedIds.add(result.id);
      renderResults();
      showToast(`Added "${meta.name}" to library`);
      callbacks.onAdded(meta);
    } catch (err) {
      showToast(formatError(err), true);
      logger.logError('Failed to add lookup result', err);
    } finally {
      hideLoading();
    }
  }

  async function runSearch() {
    const query = queryInput.value.trim();
    if (!query) {
      showToast('Enter a search term', true);
      queryInput.focus();
      return;
    }

    lastQuery = query;
    const hideLoading = showLoading(loadingRoot, 'Searching…');
    try {
      const outcome = await searchLookupPdfs({ query });
      allResults = outcome.results;

      if (outcome.webSearchUnavailable && outcome.webSearchMessage) {
        noticeEl.textContent = outcome.webSearchMessage;
        noticeEl.classList.remove('hidden');
      }

      if (allResults.length === 0 && !outcome.webSearchUnavailable) {
        throw new AppError(ErrorCodes.LKP_002);
      }

      renderResults();
    } catch (err) {
      if (err instanceof AppError && err.code === ErrorCodes.LKP_002) {
        allResults = [];
        renderResults();
        showToast(formatError(err), true);
      } else {
        showToast(formatError(err instanceof AppError ? err : new AppError(ErrorCodes.LKP_001)), true);
        logger.logError('Lookup search failed', err);
      }
    } finally {
      hideLoading();
    }
  }

  searchBtn.addEventListener('click', () => void runSearch());
  retryBtn.addEventListener('click', () => {
    queryInput.focus();
    void runSearch();
  });

  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void runSearch();
    }
  });

  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      setFilter((chip.dataset.filter as SourceFilter) ?? 'all');
    });
  });

  return panel;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
