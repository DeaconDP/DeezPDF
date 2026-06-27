import './styles/cyberpunk.css';
import { createLibraryView, type LibraryTab } from './views/library';
import { createReaderView } from './views/reader';
import { initDebugPanel, onCreditClick } from './components/debug-panel';
import { addLookupResultToLibrary } from './lib/library';
import { logger } from './lib/logger';
import { initNativeShell } from './lib/native-shell';
import { isNativeApp } from './lib/platform';
import type { LookupResult } from './lib/lookup/types';

const app = document.getElementById('app')!;
let currentView: HTMLElement | null = null;

function mount(view: HTMLElement) {
  if (currentView) {
    currentView.remove();
  }
  currentView = view;
  app.classList.toggle('reader-active', view.classList.contains('reader-view'));
  view.classList.add('view-enter');
  view.addEventListener(
    'animationend',
    () => view.classList.remove('view-enter'),
    { once: true },
  );
  app.insertBefore(view, app.querySelector('.app-footer') ?? null);
}

function showLibrary(options?: { tab?: LibraryTab }) {
  const library = createLibraryView(
    {
      onOpenPdf: (id) => {
        void openLibraryReader(id);
      },
      onPreview: (result, blob) => {
        void openPreviewReader(result, blob, () => showLibrary({ tab: 'find' }));
      },
    },
    { initialTab: options?.tab },
  );
  mount(library);
}

async function openLibraryReader(id: string) {
  const { view, load } = createReaderView({ mode: 'library', pdfId: id }, {
    onBack: () => showLibrary(),
  });
  mount(view);
  await load();
}

async function openPreviewReader(
  result: LookupResult,
  blob: Blob,
  onBack: () => void,
) {
  const { view, load } = createReaderView(
    {
      mode: 'preview',
      blob,
      title: result.title,
      pdfUrl: result.pdfUrl,
      resultId: result.id,
    },
    {
      onBack,
      onAddToLibrary: async () => {
        const meta = await addLookupResultToLibrary(result);
        logger.info(`Added lookup preview to library: ${meta.name}`);
        showLibrary();
      },
    },
  );
  mount(view);
  await load();
}

function setupFooter() {
  const footer = document.createElement('footer');
  footer.className = 'app-footer';
  footer.innerHTML = `
    <span class="credit">
      Created by
      <a href="https://deac.online" target="_blank" rel="noopener" class="credit-link">deac.online</a>
      @
      <a href="https://worldbuild.io" target="_blank" rel="noopener" class="credit-link">worldbuild.io</a>
    </span>
  `;
  footer.querySelectorAll('.credit-link').forEach((link) => {
    link.addEventListener('click', () => {
      onCreditClick();
    });
  });
  app.appendChild(footer);
}

async function setupPWA() {
  if (isNativeApp()) return;

  const { setupPWA: registerAppSW } = await import('./lib/pwa');
  registerAppSW();
}

async function boot() {
  logger.info('DeezPDF Reader starting');
  setupFooter();
  initDebugPanel(app);
  await initNativeShell();
  await setupPWA();
  showLibrary();
}

boot();
