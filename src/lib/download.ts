import { AppError, ErrorCodes } from './errors';
import { logger } from './logger';

type SaveFilePickerWindow = Window & {
  showSaveFilePicker: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;
};

function parseUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AppError(ErrorCodes.LIB_003, 'URL is required');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new AppError(ErrorCodes.LIB_003, 'Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError(ErrorCodes.LIB_003, 'Only http and https URLs are supported');
  }

  return url;
}

export function filenameFromUrl(url: URL): string {
  const segment = url.pathname.split('/').pop() || 'download.pdf';
  const decoded = decodeURIComponent(segment);
  if (decoded.toLowerCase().endsWith('.pdf')) return decoded;
  return decoded.includes('.') ? decoded : `${decoded}.pdf`;
}

function isPdfBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

export function supportsSaveFilePicker(): boolean {
  return 'showSaveFilePicker' in window;
}

export async function fetchPdfFromUrl(rawUrl: string): Promise<{ blob: Blob; filename: string }> {
  const url = parseUrl(rawUrl);
  const filename = filenameFromUrl(url);

  let response: Response;
  try {
    response = await fetch(url.href);
  } catch (err) {
    throw new AppError(ErrorCodes.LIB_003, url.hostname);
  }

  if (!response.ok) {
    throw new AppError(ErrorCodes.LIB_003, `HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();

  if (!isPdfBytes(buffer)) {
    const contentType = response.headers.get('content-type') ?? blob.type;
    if (!contentType.includes('pdf')) {
      throw new AppError(ErrorCodes.LIB_003, 'Response is not a PDF');
    }
  }

  const pdfBlob = new Blob([buffer], { type: 'application/pdf' });
  logger.info(`Downloaded PDF from URL: ${filename} (${pdfBlob.size} bytes)`);
  return { blob: pdfBlob, filename };
}

export async function savePdfToDisk(blob: Blob, suggestedName: string): Promise<boolean> {
  if (!supportsSaveFilePicker()) {
    throw new AppError(ErrorCodes.LIB_004);
  }

  try {
    const handle = await (window as unknown as SaveFilePickerWindow).showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: 'PDF Document',
          accept: { 'application/pdf': ['.pdf'] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    logger.info(`Saved PDF to disk: ${suggestedName}`);
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return false;
    }
    throw err;
  }
}

export function blobToPdfFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: 'application/pdf' });
}
