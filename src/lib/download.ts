import { CapacitorHttp } from '@capacitor/core';
import { agentDebugLog } from './agent-debug';
import { AppError, ErrorCodes } from './errors';
import { logger } from './logger';
import { isNativeApp } from './platform';

const PDF_PROXY_PATH = '/api/pdf-download';

type SaveFilePickerWindow = Window & {
  showSaveFilePicker: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;
};

function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function parseUrl(raw: string): URL {
  const trimmed = normalizeUrlInput(raw);
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

async function fetchViaProxy(url: URL): Promise<Response | null> {
  try {
    return await fetch(`${PDF_PROXY_PATH}?url=${encodeURIComponent(url.href)}`);
  } catch {
    return null;
  }
}

function normalizeBase64(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  return pad ? normalized + '='.repeat(4 - pad) : normalized;
}

function latin1StringToArrayBuffer(text: string): ArrayBuffer {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes.buffer;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(normalizeBase64(base64));
  return latin1StringToArrayBuffer(binary);
}

function nativeHttpDataToArrayBuffer(data: unknown): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  if (data instanceof Uint8Array) {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    return copy.buffer;
  }
  if (typeof data !== 'string' || data.length === 0) {
    throw new AppError(ErrorCodes.LIB_003, 'Unexpected native HTTP response format');
  }

  if (data.startsWith('%PDF')) {
    return latin1StringToArrayBuffer(data);
  }

  try {
    const decoded = base64ToArrayBuffer(data);
    if (isPdfBytes(decoded)) return decoded;
  } catch {
    // fall through to latin1 fallback
  }

  const fallback = latin1StringToArrayBuffer(data);
  if (isPdfBytes(fallback)) return fallback;

  throw new AppError(ErrorCodes.LIB_003, 'Downloaded data is not a valid PDF');
}

function headerFromNativeResponse(headers: Record<string, string>, name: string): string | null {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return null;
}

async function fetchPdfViaNativeHttp(url: URL): Promise<Response> {
  let response;
  try {
    response = await CapacitorHttp.get({
      url: url.href,
      responseType: 'arraybuffer',
      connectTimeout: 120_000,
      readTimeout: 120_000,
      headers: {
        Accept: 'application/pdf,*/*;q=0.8',
        ...(url.hostname.endsWith('archive.org') ? { Referer: 'https://archive.org/' } : {}),
      },
    });
  } catch (err) {
    agentDebugLog(
      'download.ts:fetchPdfViaNativeHttp:error',
      'CapacitorHttp.get threw',
      {
        errorName: err instanceof Error ? err.name : 'unknown',
        errorMessage: err instanceof Error ? err.message : String(err),
      },
      'B',
    );
    throw err instanceof AppError
      ? err
      : new AppError(
          ErrorCodes.LIB_003,
          err instanceof Error ? err.message : 'Native download failed',
        );
  }

  agentDebugLog(
    'download.ts:fetchPdfViaNativeHttp',
    'native http result',
    {
      status: response.status,
      dataType: typeof response.data,
      dataLength: typeof response.data === 'string' ? response.data.length : null,
      dataPrefix: typeof response.data === 'string' ? response.data.slice(0, 8) : null,
    },
    'B',
  );

  if (response.status < 200 || response.status >= 300) {
    throw new AppError(ErrorCodes.LIB_003, `HTTP ${response.status}`);
  }

  const buffer = nativeHttpDataToArrayBuffer(response.data);
  agentDebugLog(
    'download.ts:fetchPdfViaNativeHttp:decoded',
    'native pdf decoded',
    {
      byteLength: buffer.byteLength,
      pdfMagic: isPdfBytes(buffer),
    },
    'C',
  );

  const contentType =
    headerFromNativeResponse(response.headers, 'content-type') ?? 'application/octet-stream';

  return new Response(buffer, {
    status: response.status,
    headers: { 'Content-Type': contentType },
  });
}

async function fetchPdfResponse(url: URL): Promise<Response> {
  const isDev = import.meta.env.DEV;
  const isNative = isNativeApp();
  agentDebugLog(
    'download.ts:fetchPdfResponse:entry',
    'fetchPdfResponse start',
    { href: url.href, hostname: url.hostname, isDev, isNative },
    'B',
  );

  if (isNative) {
    return fetchPdfViaNativeHttp(url);
  }

  if (!isDev) {
    try {
      const directResponse = await fetch(url.href);
      agentDebugLog(
        'download.ts:fetchPdfResponse:direct',
        'direct fetch result',
        {
          ok: directResponse.ok,
          status: directResponse.status,
          contentType: directResponse.headers.get('content-type'),
        },
        'B',
      );
      if (directResponse.ok) return directResponse;
      throw new AppError(ErrorCodes.LIB_003, `HTTP ${directResponse.status}`);
    } catch (err) {
      if (err instanceof AppError) throw err;
      agentDebugLog(
        'download.ts:fetchPdfResponse:direct-fallback',
        'direct fetch failed, trying proxy',
        {
          errorName: err instanceof Error ? err.name : 'unknown',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
        'B',
      );
    }
  }

  const proxyResponse = await fetchViaProxy(url);
  agentDebugLog(
    'download.ts:fetchPdfResponse:proxy',
    'proxy fetch result',
    {
      hasResponse: proxyResponse !== null,
      ok: proxyResponse?.ok ?? false,
      status: proxyResponse?.status ?? null,
    },
    'A',
  );
  if (proxyResponse?.ok) return proxyResponse;

  const proxyDetail = proxyResponse
    ? (await proxyResponse.text().catch(() => '')).trim() || `HTTP ${proxyResponse.status}`
    : null;

  if (proxyDetail) {
    throw new AppError(ErrorCodes.LIB_003, proxyDetail);
  }

  throw new AppError(
    ErrorCodes.LIB_003,
    `${url.hostname} (blocked by browser CORS policy)`,
  );
}

export async function fetchPdfFromUrl(rawUrl: string): Promise<{ blob: Blob; filename: string }> {
  let url: URL;
  try {
    url = parseUrl(rawUrl);
  } catch (err) {
    agentDebugLog(
      'download.ts:fetchPdfFromUrl:parse',
      'URL parse failed',
      {
        rawUrl,
        normalized: normalizeUrlInput(rawUrl),
        errorMessage: err instanceof Error ? err.message : String(err),
      },
      'E',
    );
    throw err;
  }
  const filename = filenameFromUrl(url);
  const response = await fetchPdfResponse(url);

  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const pdfMagic = isPdfBytes(buffer);
  const contentType = response.headers.get('content-type') ?? blob.type;
  agentDebugLog(
    'download.ts:fetchPdfFromUrl:validate',
    'response received',
    { filename, blobSize: blob.size, pdfMagic, contentType },
    'C',
  );

  if (!pdfMagic) {
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
    agentDebugLog(
      'download.ts:savePdfToDisk:error',
      'save picker failed',
      {
        suggestedName,
        errorName: err instanceof Error ? err.name : 'unknown',
        errorMessage: err instanceof Error ? err.message : String(err),
        isAbort: err instanceof DOMException && err.name === 'AbortError',
      },
      'D',
    );
    if (err instanceof DOMException && err.name === 'AbortError') {
      return false;
    }
    throw err;
  }
}

export function blobToPdfFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: 'application/pdf' });
}
