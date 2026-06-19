import { AppError, ErrorCodes } from './errors';
import { db, generateId, type PdfRecord } from './db';
import { logger } from './logger';

export type PdfMeta = Omit<PdfRecord, 'data'>;

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

export async function addPdfFolder(): Promise<PdfMeta[]> {
  if (!('showDirectoryPicker' in window)) {
    throw new AppError(ErrorCodes.LIB_002);
  }

  const dirHandle = await (window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
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
  const records = await db.pdfs.orderBy('lastOpened').reverse().toArray();
  return records.map(({ data: _, ...meta }) => meta);
}

export async function searchPdfs(query: string): Promise<PdfMeta[]> {
  const all = await getAllPdfs();
  if (!query.trim()) return all;
  const lower = query.toLowerCase();
  return all.filter((p) => p.name.toLowerCase().includes(lower));
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
