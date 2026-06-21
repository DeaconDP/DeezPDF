export const ErrorCodes = {
  LCH_001: 'ERR-LCH-001',
  LCH_002: 'ERR-LCH-002',
  LIB_001: 'ERR-LIB-001',
  LIB_002: 'ERR-LIB-002',
  LIB_003: 'ERR-LIB-003',
  LIB_004: 'ERR-LIB-004',
  PDF_001: 'ERR-PDF-001',
  PDF_002: 'ERR-PDF-002',
  DB_001: 'ERR-DB-001',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const messages: Record<ErrorCode, string> = {
  'ERR-LCH-001': 'Node.js is not installed. Download from https://nodejs.org',
  'ERR-LCH-002': 'Failed to bind to a network port',
  'ERR-LIB-001': 'Failed to read PDF file',
  'ERR-LIB-002': 'Folder picker is not supported in this browser',
  'ERR-LIB-003': 'Failed to download PDF from URL',
  'ERR-LIB-004': 'Save location picker is not supported in this browser',
  'ERR-PDF-001': 'Failed to load or parse PDF',
  'ERR-PDF-002': 'Failed to render PDF page',
  'ERR-DB-001': 'Failed to save data to local storage',
};

export class AppError extends Error {
  code: ErrorCode;

  constructor(code: ErrorCode, detail?: string) {
    const base = messages[code];
    super(detail ? `${base}: ${detail}` : base);
    this.code = code;
    this.name = 'AppError';
  }
}

export function formatError(err: unknown): string {
  if (err instanceof AppError) {
    return `[${err.code}] ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
