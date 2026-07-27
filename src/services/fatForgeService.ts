import {
  closeActiveDisk,
  copyEntry,
  createFile,
  EntryAlreadyExistsError,
  createFolder,
  createFormattedImage,
  getDiskUsage,
  createTextFile,
  deleteEntry,
  getEntryInfo,
  getImageSnapshot,
  listTree,
  mountImage,
  moveEntry,
  readFile,
  renameEntry,
  restoreImage,
  writeTextFile,
} from '../lib/fatDisk';
import { useAppStore, type AppState } from '../store/useAppStore';
import type { FsEntry, OpenDocument } from '../types';
import { detectDocumentKind, mimeForPath } from '../utils/fileKinds';
import { basename, dirname, isChildPath } from '../utils/path';

type ImportSource = DataTransfer | FileList | File[];

type UploadEntry =
  | { type: 'file'; name: string; data: Uint8Array }
  | { type: 'folder'; name: string; children: UploadEntry[] };

type CreateTextFileResult =
  | { status: 'created'; path: string }
  | { status: 'exists'; path: string; name: string }
  | { status: 'error' };

type RenamePathResult =
  | { status: 'renamed'; path: string }
  | { status: 'exists'; path: string; name: string; entryType: FsEntry['type'] }
  | { status: 'error' };

interface FileSystemEntryLike {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  file?: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
  createReader?: () => {
    readEntries: (success: (entries: FileSystemEntryLike[]) => void, error?: (error: DOMException) => void) => void;
  };
}

interface FileSystemHandleLike {
  kind: 'file' | 'directory';
  name: string;
  getFile?: () => Promise<File>;
  entries?: () => AsyncIterable<[string, FileSystemHandleLike]>;
}

type DataTransferItemWithHandles = DataTransferItem & {
  getAsFileSystemHandle?: () => Promise<FileSystemHandleLike | null>;
};

const floppySizes = {
  '384k': 384 * 1024,
  '768k': 768 * 1024,
  '1.44M': 1440 * 1024,
  '2.88M': 2880 * 1024,
} as const;

export type FloppySize = keyof typeof floppySizes;

export const fatForgeService = {
  selectActiveDocument,
  selectHasImage,
  hasImageLoaded,
  refreshFromDisk,
  openImageBytes,
  openImageFile,
  closeImage,
  createFloppyImage,
  createHardDiskImage,
  openFile,
  saveActiveFile,
  closeActiveFile,
  downloadCurrentImage,
  undoImageChange,
  redoImageChange,
  deletePath,
  deletePaths,
  movePath,
  pasteClipboardInto,
  importFilesIntoImage,
  createFolderInImage,
  createTextFileInImage,
  createUniqueTextFileInImage,
  renamePath,
  renamePathWithResult,
  getInfoRows,
  findEntry,
  getSelectedEntry,
  targetFolderFor,
  cutEntry,
  copyEntryToClipboard,
  dispatchFind,
  formatBytes,
  formatHexRows,
};

function selectActiveDocument(state: AppState): OpenDocument | null {
  return state.openDocuments.find((document) => document.id === state.activeDocumentId) ?? null;
}

function selectHasImage(state: AppState): boolean {
  return state.imageData !== null && state.diskMeta !== null;
}

function hasImageLoaded(): boolean {
  return selectHasImage(useAppStore.getState());
}

function refreshFromDisk(): void {
  useAppStore.getState().updateImageSnapshot(getImageSnapshot(), getDiskUsage(), listTree());
}

async function openImageBytes(bytes: Uint8Array, name: string): Promise<void> {
  try {
    const meta = await mountImage(bytes, name);
    useAppStore.getState().setImage(getImageSnapshot(), meta, getDiskUsage(), listTree());
  } catch (error) {
    reportError(error, 'Unable to open FAT image');
  }
}

async function openImageFile(file: File): Promise<void> {
  await openImageBytes(new Uint8Array(await file.arrayBuffer()), file.name);
}

function closeImage(): void {
  closeActiveDisk();
  useAppStore.getState().closeImage();
}

async function createFloppyImage(label: string, size: FloppySize): Promise<void> {
  try {
    const meta = await createFormattedImage({
      label,
      sizeBytes: floppySizes[size],
      kind: 'floppy',
      name: `Floppy ${size}`,
    });
    useAppStore.getState().setImage(getImageSnapshot(), meta, getDiskUsage(), listTree());
    useAppStore.getState().setDialog(null);
  } catch (error) {
    reportError(error, 'Unable to create floppy image');
  }
}

async function createHardDiskImage(label: string, sizeMb: number): Promise<void> {
  try {
    const clampedSize = Math.min(2048, Math.max(1, Math.floor(sizeMb)));
    const meta = await createFormattedImage({
      label,
      sizeBytes: clampedSize * 1024 * 1024,
      kind: 'hard-disk',
      name: `Hard disk ${clampedSize} MB`,
    });
    useAppStore.getState().setImage(getImageSnapshot(), meta, getDiskUsage(), listTree());
    useAppStore.getState().setDialog(null);
  } catch (error) {
    reportError(error, 'Unable to create hard disk image');
  }
}

function openFile(entry: FsEntry): void {
  if (entry.type !== 'file') {
    return;
  }
  try {
    const data = readFile(entry.path);
    useAppStore.getState().openDocument(createOpenDocument(entry, data));
  } catch (error) {
    reportError(error, `Unable to open ${entry.name}`);
  }
}

function saveActiveFile(): void {
  const activeDocument = selectActiveDocument(useAppStore.getState());
  if (!activeDocument || activeDocument.kind !== 'text') {
    useAppStore.getState().setStatus('No editable text file is active');
    return;
  }

  try {
    writeTextFile(activeDocument.path, activeDocument.content);
    useAppStore
      .getState()
      .markDocumentSaved(activeDocument.id, getImageSnapshot(), getDiskUsage(), listTree());
    useAppStore.getState().setStatus(`${activeDocument.name} saved`);
  } catch (error) {
    reportError(error, `Unable to save ${activeDocument.name}`);
  }
}

function closeActiveFile(): void {
  const activeDocument = selectActiveDocument(useAppStore.getState());
  if (!activeDocument) {
    useAppStore.getState().setStatus('No file is active');
    return;
  }

  useAppStore.getState().closeDocument(activeDocument.id);
}

function downloadCurrentImage(): void {
  const { diskMeta, imageData, setStatus } = useAppStore.getState();
  if (!imageData || !diskMeta) {
    setStatus('No image loaded');
    return;
  }

  try {
    const snapshot = getImageSnapshot();
    const buffer = snapshot.buffer.slice(
      snapshot.byteOffset,
      snapshot.byteOffset + snapshot.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${diskMeta.label || basename(diskMeta.name) || 'fatforge'}.img`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus('Image downloaded');
  } catch (error) {
    reportError(error, 'Unable to save image');
  }
}

async function undoImageChange(): Promise<void> {
  useAppStore.temporal.getState().undo();
  await restoreDiskFromStore();
}

async function redoImageChange(): Promise<void> {
  useAppStore.temporal.getState().redo();
  await restoreDiskFromStore();
}

function deletePath(path: string): void {
  deletePaths([path]);
}

function deletePaths(paths: string[]): void {
  const deleteTargets = topLevelPaths(paths);
  if (deleteTargets.length === 0) {
    return;
  }

  try {
    deleteTargets.forEach(deleteEntry);
    useAppStore.getState().commitFileAction({
      imageData: getImageSnapshot(),
      diskUsage: getDiskUsage(),
      tree: listTree(),
      selectedPath: null,
      selectedPaths: [],
      closePaths: deleteTargets,
    });
    useAppStore
      .getState()
      .setStatus(`${deleteTargets.length} item${deleteTargets.length === 1 ? '' : 's'} deleted`);
  } catch (error) {
    reportError(error, 'Unable to delete entry');
  }
}

function movePath(sourcePath: string, targetFolderPath: string): void {
  try {
    const newPath = moveEntry(sourcePath, targetFolderPath);
    useAppStore.getState().commitFileAction({
      imageData: getImageSnapshot(),
      diskUsage: getDiskUsage(),
      tree: listTree(),
      renamePath: { oldPath: sourcePath, newPath },
    });
  } catch (error) {
    reportError(error, 'Unable to move entry');
  }
}

function pasteClipboardInto(targetFolderPath: string): void {
  const clipboard = useAppStore.getState().clipboard;
  if (!clipboard) {
    return;
  }

  try {
    if (clipboard.mode === 'cut') {
      const newPath = moveEntry(clipboard.path, targetFolderPath);
      useAppStore.getState().commitFileAction({
        imageData: getImageSnapshot(),
        diskUsage: getDiskUsage(),
        tree: listTree(),
        renamePath: { oldPath: clipboard.path, newPath },
        clearClipboard: true,
      });
    } else {
      copyEntry(clipboard.path, targetFolderPath);
      useAppStore.getState().commitFileAction({
        imageData: getImageSnapshot(),
        diskUsage: getDiskUsage(),
        tree: listTree(),
      });
    }
  } catch (error) {
    reportError(error, 'Unable to paste entry');
  }
}

async function importFilesIntoImage(source: ImportSource, targetFolderPath: string): Promise<void> {
  try {
    const entries = await collectUploadEntries(source);
    const imported = entries.flatMap((entry) => writeUploadEntry(targetFolderPath, entry));

    if (imported.length === 0) {
      return;
    }

    useAppStore.getState().commitFileAction({
      imageData: getImageSnapshot(),
      diskUsage: getDiskUsage(),
      tree: listTree(),
      selectedPath: imported.at(-1),
    });
    useAppStore
      .getState()
      .setStatus(`${imported.length} item${imported.length === 1 ? '' : 's'} imported`);
  } catch (error) {
    reportError(error, 'Unable to import file');
  }
}

async function collectUploadEntries(source: ImportSource): Promise<UploadEntry[]> {
  if (isDataTransferSource(source) && source.items.length > 0) {
    const entries = (
      await Promise.all(Array.from(source.items, (item) => uploadEntryFromDataTransferItem(item)))
    ).filter((entry): entry is UploadEntry => entry !== null);
    if (entries.length > 0) {
      return entries;
    }
  }

  const files = Array.from(isDataTransferSource(source) ? source.files : source);
  if (files.some((file) => file.webkitRelativePath)) {
    return uploadEntriesFromRelativeFiles(files);
  }
  return Promise.all(files.map((file) => uploadEntryFromFile(file.name, file)));
}

function isDataTransferSource(source: ImportSource): source is DataTransfer {
  return typeof DataTransfer !== 'undefined' && source instanceof DataTransfer;
}

async function uploadEntryFromDataTransferItem(item: DataTransferItem): Promise<UploadEntry | null> {
  if (item.kind !== 'file') {
    return null;
  }

  const itemWithHandles = item as DataTransferItemWithHandles;
  const handle = await getFileSystemHandle(itemWithHandles);
  if (handle) {
    return uploadEntryFromHandle(handle);
  }

  const entry = item.webkitGetAsEntry?.() as FileSystemEntryLike | null | undefined;
  if (entry) {
    return uploadEntryFromFileSystemEntry(entry);
  }

  const file = item.getAsFile();
  return file ? uploadEntryFromFile(file.name, file) : null;
}

async function getFileSystemHandle(item: DataTransferItemWithHandles): Promise<FileSystemHandleLike | null> {
  try {
    return (await item.getAsFileSystemHandle?.()) ?? null;
  } catch {
    return null;
  }
}

async function uploadEntryFromHandle(handle: FileSystemHandleLike): Promise<UploadEntry> {
  if (handle.kind === 'file') {
    if (!handle.getFile) {
      throw new Error(`Unable to read ${handle.name}`);
    }
    return uploadEntryFromFile(handle.name, await handle.getFile());
  }

  const children: UploadEntry[] = [];
  if (handle.entries) {
    for await (const [, child] of handle.entries()) {
      children.push(await uploadEntryFromHandle(child));
    }
  }
  return { type: 'folder', name: handle.name, children };
}

async function uploadEntryFromFileSystemEntry(entry: FileSystemEntryLike): Promise<UploadEntry> {
  if (entry.isFile) {
    const file = await fileFromFileSystemEntry(entry);
    return uploadEntryFromFile(entry.name || file.name, file);
  }

  if (!entry.isDirectory || !entry.createReader) {
    throw new Error(`Unable to read ${entry.name}`);
  }

  const reader = entry.createReader();
  const children: UploadEntry[] = [];
  for (;;) {
    const batch = await readFileSystemEntries(reader);
    if (batch.length === 0) {
      break;
    }
    children.push(...await Promise.all(batch.map((child) => uploadEntryFromFileSystemEntry(child))));
  }
  return { type: 'folder', name: entry.name, children };
}

function fileFromFileSystemEntry(entry: FileSystemEntryLike): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file?.(resolve, reject) ?? reject(new Error(`Unable to read ${entry.name}`));
  });
}

function readFileSystemEntries(
  reader: ReturnType<NonNullable<FileSystemEntryLike['createReader']>>,
): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

async function uploadEntriesFromRelativeFiles(files: File[]): Promise<UploadEntry[]> {
  const roots: UploadEntry[] = [];
  for (const file of files) {
    const parts = file.webkitRelativePath.split('/').filter(Boolean);
    let children = roots;
    for (const folderName of parts.slice(0, -1)) {
      let folder = children.find((child): child is Extract<UploadEntry, { type: 'folder' }> =>
        child.type === 'folder' && child.name === folderName,
      );
      if (!folder) {
        folder = { type: 'folder', name: folderName, children: [] };
        children.push(folder);
      }
      children = folder.children;
    }
    const fileName = parts.at(-1) ?? file.name;
    children.push(await uploadEntryFromFile(fileName, file));
  }
  return roots;
}

async function uploadEntryFromFile(name: string, file: File): Promise<UploadEntry> {
  return { type: 'file', name, data: new Uint8Array(await file.arrayBuffer()) };
}

function writeUploadEntry(parentPath: string, entry: UploadEntry): string[] {
  if (entry.type === 'file') {
    return [createFile(parentPath, entry.name, entry.data)];
  }

  const folderPath = createFolder(parentPath, entry.name);
  return [folderPath, ...entry.children.flatMap((child) => writeUploadEntry(folderPath, child))];
}

function createTextFileInImage(parentPath: string, name: string): CreateTextFileResult {
  try {
    const path = createTextFile(parentPath, name);
    useAppStore.getState().commitFileAction({
      imageData: getImageSnapshot(),
      diskUsage: getDiskUsage(),
      tree: listTree(),
      selectedPath: path,
    });
    return { status: 'created', path };
  } catch (error) {
    if (error instanceof EntryAlreadyExistsError) {
      return { status: 'exists', path: error.path, name: basename(error.path) };
    }
    reportError(error, 'Unable to create file');
    return { status: 'error' };
  }
}

function createUniqueTextFileInImage(parentPath: string, suggestedName = 'NEWFILE.TXT'): string | null {
  try {
    const path = createFile(parentPath, suggestedName, new Uint8Array());
    useAppStore.getState().commitFileAction({
      imageData: getImageSnapshot(),
      diskUsage: getDiskUsage(),
      tree: listTree(),
      selectedPath: path,
    });
    return path;
  } catch (error) {
    reportError(error, 'Unable to create file');
    return null;
  }
}

function createFolderInImage(parentPath: string, name: string): string | null {
  try {
    const path = createFolder(parentPath, name);
    useAppStore.getState().commitFileAction({
      imageData: getImageSnapshot(),
      diskUsage: getDiskUsage(),
      tree: listTree(),
      selectedPath: path,
    });
    return path;
  } catch (error) {
    reportError(error, 'Unable to create folder');
    return null;
  }
}

function renamePath(path: string, newName: string): string | null {
  const result = renamePathWithResult(path, newName);
  return result.status === 'renamed' ? result.path : null;
}

function renamePathWithResult(path: string, newName: string): RenamePathResult {
  try {
    const newPath = renameEntry(path, newName);
    useAppStore.getState().commitFileAction({
      imageData: getImageSnapshot(),
      diskUsage: getDiskUsage(),
      tree: listTree(),
      selectedPath: newPath,
      renamePath: { oldPath: path, newPath },
    });
    return { status: 'renamed', path: newPath };
  } catch (error) {
    if (error instanceof EntryAlreadyExistsError) {
      let entryType: FsEntry['type'] = 'file';
      try {
        entryType = getEntryInfo(error.path).type;
      } catch {
        entryType = 'file';
      }
      return { status: 'exists', path: error.path, name: basename(error.path), entryType };
    }
    reportError(error, 'Unable to rename entry');
    return { status: 'error' };
  }
}

function getInfoRows(path: string): Array<[string, string]> {
  const info = getEntryInfo(path);
  return [
    ['Path', info.path],
    ['Type', info.type],
    ['Size', `${info.size.toLocaleString()} bytes`],
    ['Modified', new Date(info.modified).toLocaleString()],
    ['Attributes', `0x${info.attrib.toString(16).padStart(2, '0')}`],
  ];
}

function findEntry(entries: FsEntry[], path: string): FsEntry | null {
  for (const entry of entries) {
    if (entry.path === path) {
      return entry;
    }
    const nested = findEntry(entry.children ?? [], path);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function topLevelPaths(paths: string[]): string[] {
  const uniquePaths = Array.from(new Set(paths)).sort((left, right) => left.length - right.length);
  return uniquePaths.filter(
    (path, index) => !uniquePaths.slice(0, index).some((parentPath) => isChildPath(path, parentPath)),
  );
}

function getSelectedEntry(): FsEntry | null {
  const { selectedPath, tree } = useAppStore.getState();
  return selectedPath ? findEntry(tree, selectedPath) : null;
}

function targetFolderFor(entry: FsEntry | null): string {
  if (!entry) {
    return '';
  }
  return entry.type === 'folder' ? entry.path : dirname(entry.path);
}

function cutEntry(entry: FsEntry): void {
  useAppStore.getState().setClipboard({
    mode: 'cut',
    path: entry.path,
    entryType: entry.type,
  });
}

function copyEntryToClipboard(entry: FsEntry): void {
  useAppStore.getState().setClipboard({
    mode: 'copy',
    path: entry.path,
    entryType: entry.type,
  });
}

function dispatchFind(): void {
  window.dispatchEvent(new CustomEvent('fatforge:find'));
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

function formatHexRows(data: Uint8Array): string[] {
  const output: string[] = [];
  for (let offset = 0; offset < data.length; offset += 16) {
    const slice = data.slice(offset, offset + 16);
    const hex = Array.from(slice)
      .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    const ascii = Array.from(slice)
      .map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'))
      .join('');
    output.push(`${offset.toString(16).padStart(8, '0').toUpperCase()}  ${hex.padEnd(47)}  ${ascii}`);
  }
  return output;
}

function createOpenDocument(entry: FsEntry, data: Uint8Array): OpenDocument {
  const kind = detectDocumentKind(entry.path, data);
  const content = kind === 'text' ? new TextDecoder().decode(data) : '';
  return {
    id: `doc:${entry.path}`,
    path: entry.path,
    name: entry.name,
    kind,
    data,
    mime: mimeForPath(entry.path),
    content,
    savedContent: content,
    dirty: false,
  };
}

async function restoreDiskFromStore(): Promise<void> {
  const snapshot = useAppStore.getState().imageData;
  if (snapshot) {
    await restoreImage(snapshot);
    return;
  }
  closeActiveDisk();
}

function reportError(error: unknown, fallback: string): void {
  useAppStore.getState().setStatus(error instanceof Error ? error.message : fallback);
}
