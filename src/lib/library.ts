import { AppError, ErrorCodes } from './errors';
import { db, generateId, type PdfRecord } from './db';
import { logger } from './logger';
import {
  blobToPdfFile,
  fetchPdfFromUrl,
  savePdfToDisk,
  supportsSaveFilePicker,
} from './download';

export type PdfMeta = Omit<PdfRecord, 'data'>;

export type PdfFilter = 'all' | 'unread' | 'reading' | 'finished';

export type PdfSort =
  | 'lastOpened-desc'
  | 'dateAdded-desc'
  | 'dateAdded-asc'
  | 'name-asc'
  | 'name-desc'
  | 'size-desc'
  | 'size-asc';

export type LibraryQuery = {
  query?: string;
  filter?: PdfFilter;
  sort?: PdfSort;
};

const SORT_COMPARATORS: Record<PdfSort, (a: PdfMeta, b: PdfMeta) => number> = {
  'lastOpened-desc': (a, b) => b.lastOpened - a.lastOpened,
  'dateAdded-desc': (a, b) => b.dateAdded - a.dateAdded,
  'dateAdded-asc': (a, b) => a.dateAdded - b.dateAdded,
  'name-asc': (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  'name-desc': (a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }),
  'size-desc': (a, b) => b.size - a.size,
  'size-asc': (a, b) => a.size - b.size,
};

function matchesFilter(pdf: PdfMeta, filter: PdfFilter): boolean {
  switch (filter) {
    case 'unread':
      return pdf.lastOpened === 0;
    case 'reading':
      return pdf.lastOpened > 0 && (pdf.totalPages === 0 || pdf.currentPage < pdf.totalPages);
    case 'finished':
      return pdf.totalPages > 0 && pdf.currentPage >= pdf.totalPages;
    default:
      return true;
  }
}

async function fileToRecord(file: File): Promise<PdfRecord> {
  try {
    const data = new Blob([await file.arrayBuffer()], { type: 'application/pdf' });
    return {
      id: generateId(),
      name: file.name,
      size: file.size,
      dateAdded: Date.now(),
      lastOpened: 0,
      currentPage: 1,
      totalPages: 0,
      data,
    };
  } catch (err) {
    throw new AppError(ErrorCodes.LIB_001, file.name);
  }
}

export async function addPdfFile(file: File): Promise<PdfMeta> {
  const existing = await db.pdfs.where('name').equals(file.name).first();
  if (existing) {
    logger.info(`PDF already in library: ${file.name}`);
    const { data: _, ...meta } = existing;
    return meta;
  }

  const record = await fileToRecord(file);
  try {
    await db.pdfs.add(record);
    logger.info(`Added PDF: ${record.name}`);
    const { data: _, ...meta } = record;
    return meta;
  } catch (err) {
    throw new AppError(ErrorCodes.DB_001, `add ${file.name}`);
  }
}

export async function addPdfFiles(files: FileList | File[]): Promise<PdfMeta[]> {
  const results: PdfMeta[] = [];
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.pdf')) continue;
    results.push(await addPdfFile(file));
  }
  return results;
}

export { supportsSaveFilePicker };

export type DownloadPdfResult = {
  meta: PdfMeta;
  savedToDisk: boolean;
};

export async function downloadAndAddPdf(url: string): Promise<DownloadPdfResult> {
  const { blob, filename } = await fetchPdfFromUrl(url);

  let savedToDisk = false;
  if (supportsSaveFilePicker()) {
    savedToDisk = await savePdfToDisk(blob, filename);
    if (!savedToDisk) {
      throw new AppError(ErrorCodes.LIB_003, 'Save cancelled');
    }
  }

  const file = blobToPdfFile(blob, filename);
  const meta = await addPdfFile(file);
  return { meta, savedToDisk };
}

export function supportsDirectoryPicker(): boolean {
  return 'showDirectoryPicker' in window;
}

export async function addPdfFolder(): Promise<PdfMeta[]> {
  if (!supportsDirectoryPicker()) {
    throw new AppError(ErrorCodes.LIB_002);
  }

  const dirHandle = await (window as unknown as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
  const files: File[] = [];

  async function scanDirectory(handle: FileSystemDirectoryHandle) {
    // FileSystemDirectoryHandle.values() is supported in Chromium but not yet in TS lib.dom
    const entries = (handle as FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> }).values();
    for await (const entry of entries) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
        const file = await (entry as FileSystemFileHandle).getFile();
        files.push(file);
      } else if (entry.kind === 'directory') {
        await scanDirectory(entry as FileSystemDirectoryHandle);
      }
    }
  }

  await scanDirectory(dirHandle);
  logger.info(`Found ${files.length} PDFs in folder`);
  return addPdfFiles(files);
}

export async function getAllPdfs(): Promise<PdfMeta[]> {
  const records = await db.pdfs.toArray();
  return records.map(({ data: _, ...meta }) => meta);
}

export async function queryPdfs({
  query = '',
  filter = 'all',
  sort = 'lastOpened-desc',
}: LibraryQuery = {}): Promise<PdfMeta[]> {
  let results = await getAllPdfs();

  const trimmed = query.trim();
  if (trimmed) {
    const lower = trimmed.toLowerCase();
    results = results.filter((p) => p.name.toLowerCase().includes(lower));
  }

  if (filter !== 'all') {
    results = results.filter((p) => matchesFilter(p, filter));
  }

  const compare = SORT_COMPARATORS[sort];
  return results.sort(compare);
}

/** @deprecated Use queryPdfs instead */
export async function searchPdfs(query: string): Promise<PdfMeta[]> {
  return queryPdfs({ query });
}

export async function renamePdf(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new AppError(ErrorCodes.LIB_001, 'name cannot be empty');
  }

  const record = await db.pdfs.get(id);
  if (!record) {
    throw new AppError(ErrorCodes.LIB_001, `not found: ${id}`);
  }
  if (record.name === trimmed) return;

  try {
    await db.pdfs.update(id, { name: trimmed });
    logger.info(`Renamed PDF ${id}: ${record.name} → ${trimmed}`);
  } catch (err) {
    throw new AppError(ErrorCodes.DB_001, `rename ${id}`);
  }
}

export async function removePdf(id: string): Promise<void> {
  try {
    await db.pdfs.delete(id);
    logger.info(`Removed PDF: ${id}`);
  } catch (err) {
    throw new AppError(ErrorCodes.DB_001, `remove ${id}`);
  }
}

export async function getPdfBlob(id: string): Promise<Blob> {
  const record = await db.pdfs.get(id);
  if (!record) {
    throw new AppError(ErrorCodes.LIB_001, `not found: ${id}`);
  }
  return record.data;
}

export async function updateProgress(
  id: string,
  currentPage: number,
  totalPages: number
): Promise<void> {
  try {
    await db.pdfs.update(id, {
      currentPage,
      totalPages,
      lastOpened: Date.now(),
    });
  } catch (err) {
    throw new AppError(ErrorCodes.DB_001, `update progress ${id}`);
  }
}

export async function getPdfMeta(id: string): Promise<PdfMeta | undefined> {
  const record = await db.pdfs.get(id);
  if (!record) return undefined;
  const { data: _, ...meta } = record;
  return meta;
}

export async function getLibraryStats(): Promise<{ count: number; totalSize: number }> {
  const all = await db.pdfs.toArray();
  return {
    count: all.length,
    totalSize: all.reduce((sum, p) => sum + p.size, 0),
  };
}
