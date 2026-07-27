import { create } from 'zustand';
import { temporal } from 'zundo';
import type { AppDialog, ClipboardEntry, DiskMeta, DiskUsage, FsEntry, OpenDocument } from '../types';

export interface FileActionCommit {
  imageData: Uint8Array;
  diskUsage: DiskUsage;
  tree: FsEntry[];
  selectedPath?: string | null;
  selectedPaths?: string[];
  renamePath?: {
    oldPath: string;
    newPath: string;
  };
  closePath?: string;
  closePaths?: string[];
  clearClipboard?: boolean;
}

export interface AppState {
  diskMeta: DiskMeta | null;
  diskUsage: DiskUsage | null;
  imageData: Uint8Array | null;
  tree: FsEntry[];
  selectedPath: string | null;
  selectedPaths: string[];
  expandedPaths: string[];
  clipboard: ClipboardEntry | null;
  openDocuments: OpenDocument[];
  activeDocumentId: string | null;
  filePanelCollapsed: boolean;
  filePanelWidth: number;
  dialog: AppDialog;
  status: string;
  setImage: (imageData: Uint8Array, diskMeta: DiskMeta, diskUsage: DiskUsage, tree: FsEntry[]) => void;
  closeImage: () => void;
  updateImageSnapshot: (imageData: Uint8Array, diskUsage: DiskUsage, tree: FsEntry[]) => void;
  commitFileAction: (commit: FileActionCommit) => void;
  setTree: (tree: FsEntry[]) => void;
  setSelectedPath: (path: string | null) => void;
  setSelectedPaths: (paths: string[], primaryPath?: string | null) => void;
  toggleExpandedPath: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setClipboard: (entry: ClipboardEntry | null) => void;
  openDocument: (document: OpenDocument) => void;
  closeDocument: (id: string) => void;
  setActiveDocument: (id: string | null) => void;
  updateDocumentContent: (id: string, content: string) => void;
  markDocumentSaved: (id: string, data: Uint8Array, diskUsage: DiskUsage, tree: FsEntry[]) => void;
  setFilePanelCollapsed: (collapsed: boolean) => void;
  setFilePanelWidth: (width: number) => void;
  setDialog: (dialog: AppDialog) => void;
  setStatus: (status: string) => void;
}

export const useAppStore = create<AppState>()(
  temporal(
    (set, get) => ({
      diskMeta: null,
      diskUsage: null,
      imageData: null,
      tree: [],
      selectedPath: null,
      selectedPaths: [],
      expandedPaths: [],
      clipboard: null,
      openDocuments: [],
      activeDocumentId: null,
      filePanelCollapsed: false,
      filePanelWidth: 280,
      dialog: null,
      status: 'No image loaded',
      setImage: (imageData, diskMeta, diskUsage, tree) =>
        set({
          imageData,
          diskMeta,
          diskUsage,
          tree,
          selectedPath: null,
          selectedPaths: [],
          expandedPaths: [],
          clipboard: null,
          openDocuments: [],
          activeDocumentId: null,
          status: `${diskMeta.name} ready`,
        }),
      closeImage: () =>
        set({
          diskMeta: null,
          diskUsage: null,
          imageData: null,
          tree: [],
          selectedPath: null,
          selectedPaths: [],
          expandedPaths: [],
          clipboard: null,
          openDocuments: [],
          activeDocumentId: null,
          filePanelCollapsed: false,
          status: 'No image loaded',
        }),
      updateImageSnapshot: (imageData, diskUsage, tree) =>
        set({
          imageData,
          diskUsage,
          tree,
          expandedPaths: reconcileExpandedPaths(get().expandedPaths, tree),
        }),
      commitFileAction: (commit) =>
        set((state) => {
          let openDocuments = state.openDocuments;
          let activeDocumentId = state.activeDocumentId;

          if (commit.renamePath) {
            openDocuments = renameOpenDocuments(openDocuments, commit.renamePath);
          }

          const closePaths = closePathsForCommit(commit);
          if (closePaths.length > 0) {
            openDocuments = openDocuments.filter(
              (document) => !closePaths.some((path) => isSameOrChildPath(document.path, path)),
            );
            const activeDocumentStillOpen = openDocuments.some(
              (document) => document.id === activeDocumentId,
            );
            activeDocumentId = activeDocumentStillOpen ? activeDocumentId : openDocuments.at(-1)?.id ?? null;
          }

          return {
            imageData: commit.imageData,
            diskUsage: commit.diskUsage,
            tree: commit.tree,
            selectedPath: selectedPathAfterCommit(state.selectedPath, commit),
            selectedPaths: selectedPathsAfterCommit(state.selectedPaths, state.selectedPath, commit),
            expandedPaths: reconcileExpandedPaths(state.expandedPaths, commit.tree, commit.renamePath),
            clipboard: clipboardAfterCommit(state.clipboard, commit),
            openDocuments,
            activeDocumentId,
          };
        }),
      setTree: (tree) => set({ tree }),
      setSelectedPath: (selectedPath) =>
        set({
          selectedPath,
          selectedPaths: selectedPath ? [selectedPath] : [],
        }),
      setSelectedPaths: (paths, primaryPath) => {
        const selectedPaths = uniquePaths(paths);
        set({
          selectedPaths,
          selectedPath: primaryPath ?? selectedPaths.at(-1) ?? null,
        });
      },
      toggleExpandedPath: (path) =>
        set((state) => ({
          expandedPaths: state.expandedPaths.includes(path)
            ? state.expandedPaths.filter((item) => item !== path)
            : [...state.expandedPaths, path],
        })),
      expandAll: () => set((state) => ({ expandedPaths: collectFolderPaths(state.tree) })),
      collapseAll: () => set({ expandedPaths: [] }),
      setClipboard: (clipboard) => set({ clipboard }),
      openDocument: (document) =>
        set((state) => {
          const existing = state.openDocuments.find((item) => item.path === document.path);
          if (existing) {
            return { activeDocumentId: existing.id };
          }
          return {
            openDocuments: [...state.openDocuments, document],
            activeDocumentId: document.id,
          };
        }),
      closeDocument: (id) =>
        set((state) => {
          const openDocuments = state.openDocuments.filter((document) => document.id !== id);
          const activeDocumentId =
            state.activeDocumentId === id ? openDocuments.at(-1)?.id ?? null : state.activeDocumentId;
          return { openDocuments, activeDocumentId };
        }),
      setActiveDocument: (activeDocumentId) => set({ activeDocumentId }),
      updateDocumentContent: (id, content) =>
        set((state) => ({
          openDocuments: state.openDocuments.map((document) =>
            document.id === id
              ? { ...document, content, dirty: content !== document.savedContent }
              : document,
          ),
        })),
      markDocumentSaved: (id, data, diskUsage, tree) =>
        set((state) => ({
          imageData: data,
          diskUsage,
          tree,
          openDocuments: state.openDocuments.map((document) =>
            document.id === id
              ? {
                  ...document,
                  data: new TextEncoder().encode(document.content),
                  savedContent: document.content,
                  dirty: false,
                }
              : document,
          ),
        })),
      setFilePanelCollapsed: (filePanelCollapsed) => set({ filePanelCollapsed }),
      setFilePanelWidth: (filePanelWidth) =>
        set({ filePanelWidth: Math.min(520, Math.max(180, filePanelWidth)) }),
      setDialog: (dialog) => set({ dialog }),
      setStatus: (status) => set({ status }),
    }),
    {
      limit: 40,
      partialize: getUndoableState,
      equality: areUndoableStatesEqual,
    },
  ),
);

type UndoableAppState = Pick<
  AppState,
  | 'diskMeta'
  | 'diskUsage'
  | 'imageData'
  | 'tree'
  | 'selectedPath'
  | 'selectedPaths'
  | 'expandedPaths'
  | 'clipboard'
  | 'openDocuments'
  | 'activeDocumentId'
>;

function getUndoableState(state: AppState): UndoableAppState {
  return {
    diskMeta: state.diskMeta,
    diskUsage: state.diskUsage,
    imageData: state.imageData,
    tree: state.tree,
    selectedPath: state.selectedPath,
    selectedPaths: state.selectedPaths,
    expandedPaths: state.expandedPaths,
    clipboard: state.clipboard,
    openDocuments: state.openDocuments,
    activeDocumentId: state.activeDocumentId,
  };
}

function areUndoableStatesEqual(left: UndoableAppState, right: UndoableAppState): boolean {
  return (
    left.diskMeta === right.diskMeta &&
    left.diskUsage === right.diskUsage &&
    left.imageData === right.imageData &&
    left.tree === right.tree &&
    left.selectedPath === right.selectedPath &&
    left.selectedPaths === right.selectedPaths &&
    left.expandedPaths === right.expandedPaths &&
    left.clipboard === right.clipboard &&
    left.openDocuments === right.openDocuments &&
    left.activeDocumentId === right.activeDocumentId
  );
}

function collectFolderPaths(entries: FsEntry[]): string[] {
  return entries.flatMap((entry) => {
    if (entry.type !== 'folder') {
      return [];
    }
    return [entry.path, ...collectFolderPaths(entry.children ?? [])];
  });
}

function reconcileExpandedPaths(
  current: string[],
  tree: FsEntry[],
  renamePath?: NonNullable<FileActionCommit['renamePath']>,
): string[] {
  const folders = new Set(collectFolderPaths(tree));
  const next = current
    .map((path) => (renamePath ? movePathPrefix(path, renamePath) : path))
    .filter((path) => folders.has(path));

  return Array.from(new Set(next));
}

function renameOpenDocuments(
  documents: OpenDocument[],
  renamePath: NonNullable<FileActionCommit['renamePath']>,
): OpenDocument[] {
  return documents.map((document) => {
    const path = movePathPrefix(document.path, renamePath);
    return path === document.path
      ? document
      : {
          ...document,
          path,
          name: path.split('/').pop() ?? document.name,
        };
  });
}

function selectedPathAfterCommit(path: string | null, commit: FileActionCommit): string | null {
  if (Object.hasOwn(commit, 'selectedPath')) {
    return commit.selectedPath ?? null;
  }
  return pathAfterCommit(path, commit);
}

function selectedPathsAfterCommit(
  paths: string[],
  selectedPath: string | null,
  commit: FileActionCommit,
): string[] {
  if (commit.selectedPaths) {
    return uniquePaths(commit.selectedPaths);
  }

  if (Object.hasOwn(commit, 'selectedPath')) {
    return commit.selectedPath ? [commit.selectedPath] : [];
  }

  const next = (paths.length > 0 ? paths : selectedPath ? [selectedPath] : [])
    .map((path) => pathAfterCommit(path, commit))
    .filter((path): path is string => path !== null);

  return uniquePaths(next);
}

function clipboardAfterCommit(clipboard: ClipboardEntry | null, commit: FileActionCommit): ClipboardEntry | null {
  if (!clipboard || commit.clearClipboard) {
    return null;
  }

  const path = pathAfterCommit(clipboard.path, commit);
  return path ? { ...clipboard, path } : null;
}

function pathAfterCommit(path: string | null, commit: FileActionCommit): string | null {
  if (!path) {
    return path;
  }
  if (closePathsForCommit(commit).some((closedPath) => isSameOrChildPath(path, closedPath))) {
    return null;
  }
  return commit.renamePath ? movePathPrefix(path, commit.renamePath) : path;
}

function closePathsForCommit(commit: FileActionCommit): string[] {
  return commit.closePaths ?? (commit.closePath ? [commit.closePath] : []);
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

function movePathPrefix(path: string, renamePath: NonNullable<FileActionCommit['renamePath']>): string {
  return isSameOrChildPath(path, renamePath.oldPath)
    ? `${renamePath.newPath}${path.slice(renamePath.oldPath.length)}`
    : path;
}

function isSameOrChildPath(path: string, parentPath: string): boolean {
  return path === parentPath || path.startsWith(`${parentPath}/`);
}
