import './styles/cyberpunk.css';
import { createLibraryView } from './views/library';
import { createReaderView } from './views/reader';
import { initDebugPanel, onCreditClick } from './components/debug-panel';
import { logger } from './lib/logger';
import { initNativeShell } from './lib/native-shell';
import { isNativeApp } from './lib/platform';

const app = document.getElementById('app')!;
let currentView: HTMLElement | null = null;

function mount(view: HTMLElement) {
  if (currentView) {
    currentView.remove();
  }
  currentView = view;
  app.insertBefore(view, app.querySelector('.app-footer') ?? null);
}

function showLibrary() {
  const library = createLibraryView({
    onOpenPdf: (id) => {
      openReader(id);
    },
  });
  mount(library);
}

async function openReader(id: string) {
  const { view, load } = createReaderView(id, {
    onBack: () => showLibrary(),
  });
  mount(view);
  await load();
}

function setupFooter() {
  const footer = document.createElement('footer');
  footer.className = 'app-footer';
  footer.innerHTML = `
    <a href="https://deac.online" target="_blank" rel="noopener" class="credit-link">
      Created by deac.online
    </a>
  `;
  footer.querySelector('.credit-link')?.addEventListener('click', () => {
    onCreditClick();
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
