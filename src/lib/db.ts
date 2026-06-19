import Dexie, { type EntityTable } from 'dexie';

export interface PdfRecord {
  id: string;
  name: string;
  size: number;
  dateAdded: number;
  lastOpened: number;
  currentPage: number;
  totalPages: number;
  data: Blob;
}

class DeezPdfDatabase extends Dexie {
  pdfs!: EntityTable<PdfRecord, 'id'>;

  constructor() {
    super('DeezPdfReader');
    this.version(1).stores({
      pdfs: 'id, name, dateAdded, lastOpened',
    });
  }
}

export const db = new DeezPdfDatabase();

export function generateId(): string {
  return crypto.randomUUID();
}
