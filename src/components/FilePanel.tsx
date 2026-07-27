import { Copy, FilePlus2, FolderOpen, FolderPlus, Info, MinusSquare, Pencil, PlusSquare, Scissors, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import fileIcon from '../../icons/file.png';
import folderIcon from '../../icons/folder.png';
import folderOpenIcon from '../../icons/folder-open.png';
import { fatForgeService } from '../services/fatForgeService';
import { useAppStore } from '../store/useAppStore';
import type { FsEntry } from '../types';
import { ConfirmDialog, InfoDialog, NameDialog } from './Dialogs';

interface FilePanelProps {
  width: number;
  tree: FsEntry[];
  onOpenFile: (entry: FsEntry) => void;
  onDeletePath: (path: string) => void;
  onMovePath: (sourcePath: string, targetFolderPath: string) => void;
  onPasteInto: (targetFolderPath: string) => void;
  onImportFiles: (source: DataTransfer | FileList | File[], targetFolderPath: string) => void | Promise<void>;
}

type NameDialogState =
  | { mode: 'new-file'; parentPath: string }
  | { mode: 'new-folder'; parentPath: string }
  | { mode: 'rename'; entry: FsEntry }
  | null;

export function FilePanel(props: FilePanelProps) {
  const { width, tree, onOpenFile, onDeletePath, onMovePath, onPasteInto, onImportFiles } = props;
  const selectedPath = useAppStore((state) => state.selectedPath);
  const selectedEntry = selectedPath ? fatForgeService.findEntry(tree, selectedPath) : null;
  const setFilePanelCollapsed = useAppStore((state) => state.setFilePanelCollapsed);
  const clipboard = useAppStore((state) => state.clipboard);
  const expandedPaths = useAppStore((state) => state.expandedPaths);
  const expandAll = useAppStore((state) => state.expandAll);
  const collapseAll = useAppStore((state) => state.collapseAll);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nameDialog, setNameDialog] = useState<NameDialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<FsEntry | null>(null);
  const [infoTarget, setInfoTarget] = useState<FsEntry | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const uploadFolderInputRef = useRef<HTMLInputElement>(null);
  const treeRootRef = useRef<HTMLDivElement>(null);
  const treeScrollTopRef = useRef(0);

  useLayoutEffect(() => {
    const treeRoot = treeRootRef.current;
    if (!treeRoot) {
      return;
    }

    const scrollTop = Math.max(
      0,
      Math.min(treeScrollTopRef.current, treeRoot.scrollHeight - treeRoot.clientHeight),
    );
    treeRoot.scrollTop = scrollTop;
    treeScrollTopRef.current = scrollTop;
  }, [expandedPaths, tree, selectedPath]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, []);

  const run = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  const importSelectedFiles = (input: HTMLInputElement) => {
    const { files } = input;
    if (files?.length) {
      void onImportFiles(files, fatForgeService.targetFolderFor(selectedEntry));
    }
    input.value = '';
  };

  return (
    <aside className="file-panel window" style={{ width }}>
      <div className="title-bar">
        <div className="title-bar-text">Files</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" onClick={() => setFilePanelCollapsed(true)} />
        </div>
      </div>
      <div
        className={`file-panel-body ${dropTargetPath === '' ? 'drop-target' : ''}`}
        onDragOver={(event) => {
          if (!canDropOnPanel(event.dataTransfer)) {
            return;
          }

          event.preventDefault();
          if (!closestFolderRow(event.target as Element)) {
            setDropTargetPath('');
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDropTargetPath(null);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDropTargetPath(null);
          const source = event.dataTransfer.getData('application/x-fatforge-path');
          if (source) {
            onMovePath(source, '');
            return;
          }
          if (isExternalFileDrag(event.dataTransfer)) {
            void onImportFiles(event.dataTransfer, '');
          }
        }}
      >
        <div className="tree-toolbar" ref={menuRef}>
          <button
            className="icon-button"
            title="File actions"
            aria-label="File actions"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="icon-button-glyph" aria-hidden="true">...</span>
          </button>
          {menuOpen && (
            <div className="tree-menu">
              <TreeAction
                icon={<FilePlus2 size={14} />}
                label="New Text File"
                onClick={() =>
                  run(() =>
                    setNameDialog({ mode: 'new-file', parentPath: fatForgeService.targetFolderFor(selectedEntry) }),
                  )
                }
              />
              <TreeAction
                icon={<FolderPlus size={14} />}
                label="New Folder"
                onClick={() =>
                  run(() =>
                    setNameDialog({ mode: 'new-folder', parentPath: fatForgeService.targetFolderFor(selectedEntry) }),
                  )
                }
              />
              <TreeAction
                icon={<Upload size={14} />}
                label="Upload File"
                onClick={() => run(() => uploadFileInputRef.current?.click())}
              />
              <TreeAction
                icon={<FolderOpen size={14} />}
                label="Upload Folder"
                onClick={() => run(() => uploadFolderInputRef.current?.click())}
              />
              <div className="menu-separator" />
              <TreeAction
                icon={<FolderOpen size={14} />}
                label="Open"
                disabled={!selectedEntry || selectedEntry.type !== 'file'}
                onClick={() => run(() => selectedEntry && onOpenFile(selectedEntry))}
              />
              <TreeAction
                icon={<Trash2 size={14} />}
                label="Delete"
                disabled={!selectedEntry}
                onClick={() => run(() => selectedEntry && setDeleteTarget(selectedEntry))}
              />
              <TreeAction
                icon={<Pencil size={14} />}
                label="Rename"
                disabled={!selectedEntry}
                onClick={() => run(() => selectedEntry && setNameDialog({ mode: 'rename', entry: selectedEntry }))}
              />
              <TreeAction
                icon={<Info size={14} />}
                label="Get Info"
                disabled={!selectedEntry}
                onClick={() => run(() => selectedEntry && setInfoTarget(selectedEntry))}
              />
              <div className="menu-separator" />
              <TreeAction
                icon={<Scissors size={14} />}
                label="Cut"
                disabled={!selectedEntry}
                onClick={() =>
                  run(() =>
                    selectedEntry
                      ? fatForgeService.cutEntry(selectedEntry)
                      : undefined,
                  )
                }
              />
              <TreeAction
                icon={<Copy size={14} />}
                label="Copy"
                disabled={!selectedEntry}
                onClick={() =>
                  run(() =>
                    selectedEntry
                      ? fatForgeService.copyEntryToClipboard(selectedEntry)
                      : undefined,
                  )
                }
              />
              <TreeAction
                icon={<FolderOpen size={14} />}
                label="Paste"
                disabled={!clipboard}
                onClick={() => run(() => onPasteInto(fatForgeService.targetFolderFor(selectedEntry)))}
              />
              <div className="menu-separator" />
              <TreeAction icon={<PlusSquare size={14} />} label="Expand All" onClick={() => run(expandAll)} />
              <TreeAction icon={<MinusSquare size={14} />} label="Collapse All" onClick={() => run(collapseAll)} />
            </div>
          )}
        </div>
        <input
          ref={uploadFileInputRef}
          className="hidden-input"
          type="file"
          multiple
          onChange={(event) => importSelectedFiles(event.currentTarget)}
        />
        <input
          ref={uploadFolderInputRef}
          className="hidden-input"
          type="file"
          multiple
          {...folderPickerAttributes}
          onChange={(event) => importSelectedFiles(event.currentTarget)}
        />
        <div
          className="tree-root"
          role="tree"
          aria-label="FAT image files"
          ref={treeRootRef}
          onScroll={(event) => {
            treeScrollTopRef.current = event.currentTarget.scrollTop;
          }}
        >
          {tree.length === 0 ? (
            <div className="empty-tree">No image contents</div>
          ) : (
            tree.map((entry) => (
              <TreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                isLast={false}
                onOpenFile={onOpenFile}
                onMovePath={onMovePath}
                onImportFiles={onImportFiles}
                dropTargetPath={dropTargetPath}
                onDropTargetChange={setDropTargetPath}
                dragSourcePath={dragSourcePath}
                onDragSourceChange={setDragSourcePath}
              />
            ))
          )}
        </div>
      </div>
      {nameDialog?.mode === 'new-file' && (
        <NameDialog
          title="New Text File"
          label="File name"
          initialValue="NEWFILE.TXT"
          onCancel={() => setNameDialog(null)}
          onSubmit={(value) => {
            if (fatForgeService.createTextFileInImage(nameDialog.parentPath, value)) {
              setNameDialog(null);
            }
          }}
        />
      )}
      {nameDialog?.mode === 'new-folder' && (
        <NameDialog
          title="New Folder"
          label="Folder name"
          initialValue="NEWFOLDER"
          onCancel={() => setNameDialog(null)}
          onSubmit={(value) => {
            if (fatForgeService.createFolderInImage(nameDialog.parentPath, value)) {
              setNameDialog(null);
            }
          }}
        />
      )}
      {nameDialog?.mode === 'rename' && (
        <NameDialog
          title="Rename"
          label="New name"
          initialValue={nameDialog.entry.name}
          onCancel={() => setNameDialog(null)}
          onSubmit={(value) => {
            if (fatForgeService.renamePath(nameDialog.entry.path, value)) {
              setNameDialog(null);
            }
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete"
          message={`Delete ${deleteTarget.name}?`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            onDeletePath(deleteTarget.path);
            setDeleteTarget(null);
          }}
        />
      )}
      {infoTarget && (
        <InfoDialog
          title={infoTarget.name}
          rows={fatForgeService.getInfoRows(infoTarget.path)}
          onClose={() => setInfoTarget(null)}
        />
      )}
    </aside>
  );
}

function TreeNode({
  entry,
  depth,
  isLast,
  onOpenFile,
  onMovePath,
  onImportFiles,
  dropTargetPath,
  onDropTargetChange,
  dragSourcePath,
  onDragSourceChange,
}: {
  entry: FsEntry;
  depth: number;
  isLast: boolean;
  onOpenFile: (entry: FsEntry) => void;
  onMovePath: (sourcePath: string, targetFolderPath: string) => void;
  onImportFiles: (source: DataTransfer | FileList | File[], targetFolderPath: string) => void | Promise<void>;
  dropTargetPath: string | null;
  onDropTargetChange: (path: string | null) => void;
  dragSourcePath: string | null;
  onDragSourceChange: (path: string | null) => void;
}) {
  const selectedPath = useAppStore((state) => state.selectedPath);
  const expandedPaths = useAppStore((state) => state.expandedPaths);
  const setSelectedPath = useAppStore((state) => state.setSelectedPath);
  const toggleExpandedPath = useAppStore((state) => state.toggleExpandedPath);
  const isExpanded = expandedPaths.includes(entry.path);
  const isFolder = entry.type === 'folder';
  const icon = isFolder ? (isExpanded ? folderOpenIcon : folderIcon) : fileIcon;
  const itemStyle =
    depth > 0
      ? ({ '--tree-guide-x': `${depth * 18 + 5}px` } as React.CSSProperties)
      : undefined;
  const dropFolderPath = isFolder ? entry.path : fatForgeService.targetFolderFor(entry);

  const dragHandlers = {
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.dataTransfer.setData('application/x-fatforge-path', entry.path);
      event.dataTransfer.effectAllowed = 'move';
      onDragSourceChange(entry.path);
    },
    onDragEnd: () => {
      onDragSourceChange(null);
      onDropTargetChange(null);
    },
    onDragOver: (event: React.DragEvent) => {
      if (canDropOnEntry(event.dataTransfer, dropFolderPath, dragSourcePath)) {
        event.preventDefault();
        event.stopPropagation();
        onDropTargetChange(dropFolderPath);
      }
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        onDropTargetChange(null);
      }
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onDropTargetChange(null);
      const source = event.dataTransfer.getData('application/x-fatforge-path');
      if (source) {
        onMovePath(source, dropFolderPath);
        return;
      }
      if (isExternalFileDrag(event.dataTransfer)) {
        void onImportFiles(event.dataTransfer, dropFolderPath);
      }
    },
  };

  return (
    <div
      className="tree-item"
      data-depth={depth}
      data-last={isLast || undefined}
      role="none"
      style={itemStyle}
    >
      <div
        className={`tree-row ${selectedPath === entry.path ? 'selected' : ''} ${
          dropTargetPath === entry.path ? 'drop-target' : ''
        }`}
        style={{ paddingLeft: depth * 18 }}
        role="treeitem"
        tabIndex={0}
        aria-expanded={isFolder ? isExpanded : undefined}
        onMouseDown={(event) => {
          if (event.button === 0) {
            setSelectedPath(entry.path);
          }
        }}
        onClick={() => setSelectedPath(entry.path)}
        onDoubleClick={() => (isFolder ? toggleExpandedPath(entry.path) : onOpenFile(entry))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            if (isFolder) {
              toggleExpandedPath(entry.path);
            } else {
              onOpenFile(entry);
            }
          }

          if (event.key === ' ') {
            event.preventDefault();
            setSelectedPath(entry.path);
          }
        }}
        {...dragHandlers}
      >
        <span
          className="tree-expander"
          onClick={(event) => {
            event.stopPropagation();
            if (isFolder) {
              toggleExpandedPath(entry.path);
            }
          }}
        >
          {isFolder ? (isExpanded ? '-' : '+') : ''}
        </span>
        <img src={icon} alt="" width={16} height={16} />
        <span className="tree-name">{entry.name}</span>
      </div>
      {isFolder && isExpanded && entry.children?.map((child, index) => (
        <TreeNode
          key={child.path}
          entry={child}
          depth={depth + 1}
          isLast={index === (entry.children?.length ?? 0) - 1}
          onOpenFile={onOpenFile}
          onMovePath={onMovePath}
          onImportFiles={onImportFiles}
          dropTargetPath={dropTargetPath}
          onDropTargetChange={onDropTargetChange}
          dragSourcePath={dragSourcePath}
          onDragSourceChange={onDragSourceChange}
        />
      ))}
    </div>
  );
}

function canDropOnPanel(dataTransfer: DataTransfer): boolean {
  return isExternalFileDrag(dataTransfer) || dataTransfer.types.includes('application/x-fatforge-path');
}

function canDropOnEntry(dataTransfer: DataTransfer, folderPath: string, dragSourcePath: string | null): boolean {
  if (isExternalFileDrag(dataTransfer)) {
    return true;
  }
  const source = dataTransfer.getData('application/x-fatforge-path');
  return (dragSourcePath ?? source) !== '' && (dragSourcePath ?? source) !== folderPath;
}

function closestFolderRow(target: Element | null): Element | null {
  return target?.closest('.tree-row[aria-expanded]') ?? null;
}

function isExternalFileDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes('Files');
}

const folderPickerAttributes = {
  webkitdirectory: '',
  directory: '',
} as React.InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory: string;
  directory: string;
};

function TreeAction({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button className="tree-action" disabled={disabled} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
