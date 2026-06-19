import './styles/cyberpunk.css';
import { createLibraryView } from './views/library';
import { createReaderView } from './views/reader';
import { initDebugPanel, onCreditClick } from './components/debug-panel';
import { logger } from './lib/logger';
import { registerSW } from 'virtual:pwa-register';

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
  const reader = await createReaderView(id, {
    onBack: () => showLibrary(),
  });
  mount(reader);
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

function setupPWA() {
  registerSW({
    onNeedRefresh() {
      logger.info('New version available');
    },
    onOfflineReady() {
      logger.info('App ready for offline use');
    },
  });
}

logger.info('DeezPDF Reader starting');
setupFooter();
initDebugPanel(app);
setupPWA();
showLibrary();
