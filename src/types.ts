export type EntryType = 'file' | 'folder';
export type DiskKind = 'floppy' | 'hard-disk' | 'opened';
export type DocumentKind = 'text' | 'image' | 'hex';

export interface FsEntry {
  id: string;
  name: string;
  path: string;
  type: EntryType;
  size: number;
  modified: string;
  attrib: number;
  children?: FsEntry[];
}

export interface DiskMeta {
  label: string;
  name: string;
  kind: DiskKind;
  sizeBytes: number;
  createdAt: string;
}

export interface DiskUsage {
  usedBytes: number;
  freeBytes: number;
  totalBytes: number;
}

export interface OpenDocument {
  id: string;
  path: string;
  name: string;
  kind: DocumentKind;
  data: Uint8Array;
  mime: string;
  content: string;
  savedContent: string;
  dirty: boolean;
}

export interface ClipboardEntry {
  mode: 'copy' | 'cut';
  path: string;
  entryType: EntryType;
}

export type AppDialog = 'new-floppy' | 'new-hard-disk' | 'about' | null;
