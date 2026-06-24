import {
  DEFAULT_TEXT_FONT_PX,
  MAX_FONT_PX,
  MIN_FONT_PX,
} from './pdf-renderer';

const PREFS_KEY = 'deezpdf-reader-prefs';
const LEGACY_THEME_KEY = 'deezpdf-text-theme';

export type TextTheme = 'light' | 'dark';

export type ReaderPrefs = {
  textTheme: TextTheme;
  fontScale: number;
  textMode: boolean;
};

const MIN_FONT_SCALE = MIN_FONT_PX / DEFAULT_TEXT_FONT_PX;
const MAX_FONT_SCALE = MAX_FONT_PX / DEFAULT_TEXT_FONT_PX;

const DEFAULT_PREFS: ReaderPrefs = {
  textTheme: 'light',
  fontScale: 1,
  textMode: false,
};

function clampFontScale(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_PREFS.fontScale;
  return Math.max(MIN_FONT_SCALE, Math.min(MAX_FONT_SCALE, scale));
}

function normalizePrefs(raw: Partial<ReaderPrefs>): ReaderPrefs {
  return {
    textTheme: raw.textTheme === 'dark' ? 'dark' : 'light',
    fontScale: clampFontScale(raw.fontScale ?? DEFAULT_PREFS.fontScale),
    textMode: raw.textMode === true,
  };
}

function migrateLegacyTheme(): TextTheme | undefined {
  const legacy = localStorage.getItem(LEGACY_THEME_KEY);
  if (legacy === 'dark' || legacy === 'light') return legacy;
  return undefined;
}

export function loadReaderPrefs(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      return normalizePrefs(JSON.parse(raw) as Partial<ReaderPrefs>);
    }
  } catch {
    /* ignore */
  }

  const legacyTheme = migrateLegacyTheme();
  const prefs = normalizePrefs({
    ...DEFAULT_PREFS,
    ...(legacyTheme ? { textTheme: legacyTheme } : {}),
  });
  saveReaderPrefs(prefs);
  return prefs;
}

export function saveReaderPrefs(prefs: ReaderPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(normalizePrefs(prefs)));
}
