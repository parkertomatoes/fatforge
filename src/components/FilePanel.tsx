import { Copy, FilePlus2, FolderOpen, FolderPlus, Info, MinusSquare, Pencil, PlusSquare, Scissors, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import fileIcon from '../../icons/file.png';
import folderIcon from '../../icons/folder.png';
import folderOpenIcon from '../../icons/folder-open.png';
import { fatForgeService } from '../services/fatForgeService';
import { useAppStore } from '../store/useAppStore';
import type { FsEntry } from '../types';
import { ConfirmDialog, InfoDialog, MessageDialog, NameDialog } from './Dialogs';

interface FilePanelProps {
  width: number;
  tree: FsEntry[];
  onOpenFile: (entry: FsEntry) => void;
  onDeletePaths: (paths: string[]) => void;
  onMovePath: (sourcePath: string, targetFolderPath: string) => void;
  onPasteInto: (targetFolderPath: string) => void;
  onImportFiles: (source: DataTransfer | FileList | File[], targetFolderPath: string) => void | Promise<void>;
}

type NameDialogState = { mode: 'new-folder'; parentPath: string } | null;

type RenameConflictState = {
  name: string;
  renamedType: FsEntry['type'];
  existingType: FsEntry['type'];
} | null;

export function FilePanel(props: FilePanelProps) {
  const { width, tree, onOpenFile, onDeletePaths, onMovePath, onPasteInto, onImportFiles } = props;
  const selectedPath = useAppStore((state) => state.selectedPath);
  const selectedPaths = useAppStore((state) => state.selectedPaths);
  const setSelectedPath = useAppStore((state) => state.setSelectedPath);
  const setSelectedPaths = useAppStore((state) => state.setSelectedPaths);
  const setFilePanelCollapsed = useAppStore((state) => state.setFilePanelCollapsed);
  const clipboard = useAppStore((state) => state.clipboard);
  const expandedPaths = useAppStore((state) => state.expandedPaths);
  const expandAll = useAppStore((state) => state.expandAll);
  const collapseAll = useAppStore((state) => state.collapseAll);
  const toggleExpandedPath = useAppStore((state) => state.toggleExpandedPath);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nameDialog, setNameDialog] = useState<NameDialogState>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameConflict, setRenameConflict] = useState<RenameConflictState>(null);
  const [deleteTarget, setDeleteTarget] = useState<FsEntry[] | null>(null);
  const [infoTarget, setInfoTarget] = useState<FsEntry | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const uploadFolderInputRef = useRef<HTMLInputElement>(null);
  const treeRootRef = useRef<HTMLDivElement>(null);
  const treeScrollTopRef = useRef(0);
  const selectionAnchorPathRef = useRef<string | null>(null);
  const effectiveSelectedPaths = selectedPaths.length > 0 ? selectedPaths : selectedPath ? [selectedPath] : [];
  const visiblePaths = useMemo(() => collectVisiblePaths(tree, expandedPaths), [tree, expandedPaths]);
  const selectedEntries = useMemo(
    () =>
      effectiveSelectedPaths
        .map((path) => fatForgeService.findEntry(tree, path))
        .filter((entry): entry is FsEntry => entry !== null),
    [effectiveSelectedPaths, tree],
  );
  const selectedEntry = selectedPath ? fatForgeService.findEntry(tree, selectedPath) : null;
  const hasMultipleSelection = selectedEntries.length > 1;

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
    if (!selectedPath) {
      selectionAnchorPathRef.current = null;
      return;
    }

    if (
      !selectionAnchorPathRef.current ||
      !visiblePaths.includes(selectionAnchorPathRef.current)
    ) {
      selectionAnchorPathRef.current = selectedPath;
    }
  }, [selectedPath, visiblePaths]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, []);

  useEffect(() => {
    if (renamingPath && !fatForgeService.findEntry(tree, renamingPath)) {
      setRenamingPath(null);
    }
  }, [renamingPath, tree]);

  const run = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  const createNewTextFile = () => {
    const parentPath = fatForgeService.targetFolderFor(selectedEntry);
    const path = fatForgeService.createUniqueTextFileInImage(parentPath);
    if (!path) {
      return;
    }
    if (parentPath && !expandedPaths.includes(parentPath)) {
      toggleExpandedPath(parentPath);
    }
    setRenamingPath(path);
  };

  const importSelectedFiles = (input: HTMLInputElement) => {
    const { files } = input;
    if (files?.length) {
      void onImportFiles(files, fatForgeService.targetFolderFor(selectedEntry));
    }
    input.value = '';
  };

  const selectTreeEntry = (
    path: string,
    modifiers: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean },
  ) => {
    if (modifiers.shiftKey && selectionAnchorPathRef.current) {
      const range = pathsBetween(visiblePaths, selectionAnchorPathRef.current, path);
      setSelectedPaths(range.length > 0 ? range : [path], path);
      return;
    }

    if (modifiers.metaKey || modifiers.ctrlKey) {
      const next = effectiveSelectedPaths.includes(path)
        ? effectiveSelectedPaths.filter((selected) => selected !== path)
        : [...effectiveSelectedPaths, path];
      setSelectedPaths(next, next.includes(path) ? path : next.at(-1) ?? null);
      selectionAnchorPathRef.current = path;
      return;
    }

    setSelectedPath(path);
    selectionAnchorPathRef.current = path;
  };

  const requestDeleteSelected = (fallbackEntry?: FsEntry) => {
    const targets = selectedEntries.length > 0 ? selectedEntries : fallbackEntry ? [fallbackEntry] : [];
    if (targets.length > 0) {
      setDeleteTarget(targets);
    }
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
                disabled={hasMultipleSelection}
                onClick={() => run(createNewTextFile)}
              />
              <TreeAction
                icon={<FolderPlus size={14} />}
                label="New Folder"
                disabled={hasMultipleSelection}
                onClick={() =>
                  run(() =>
                    setNameDialog({ mode: 'new-folder', parentPath: fatForgeService.targetFolderFor(selectedEntry) }),
                  )
                }
              />
              <TreeAction
                icon={<Upload size={14} />}
                label="Upload File"
                disabled={hasMultipleSelection}
                onClick={() => run(() => uploadFileInputRef.current?.click())}
              />
              <TreeAction
                icon={<FolderOpen size={14} />}
                label="Upload Folder"
                disabled={hasMultipleSelection}
                onClick={() => run(() => uploadFolderInputRef.current?.click())}
              />
              <div className="menu-separator" />
              <TreeAction
                icon={<FolderOpen size={14} />}
                label="Open"
                disabled={hasMultipleSelection || !selectedEntry || selectedEntry.type !== 'file'}
                onClick={() => run(() => selectedEntry && onOpenFile(selectedEntry))}
              />
              <TreeAction
                icon={<Trash2 size={14} />}
                label="Delete"
                disabled={selectedEntries.length === 0}
                onClick={() => run(() => requestDeleteSelected())}
              />
              <TreeAction
                icon={<Pencil size={14} />}
                label="Rename"
                disabled={hasMultipleSelection || !selectedEntry}
                onClick={() => run(() => selectedEntry && setRenamingPath(selectedEntry.path))}
              />
              <TreeAction
                icon={<Info size={14} />}
                label="Get Info"
                disabled={hasMultipleSelection || !selectedEntry}
                onClick={() => run(() => selectedEntry && setInfoTarget(selectedEntry))}
              />
              <div className="menu-separator" />
              <TreeAction
                icon={<Scissors size={14} />}
                label="Cut"
                disabled={hasMultipleSelection || !selectedEntry}
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
                disabled={hasMultipleSelection || !selectedEntry}
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
                disabled={hasMultipleSelection || !clipboard}
                onClick={() => run(() => onPasteInto(fatForgeService.targetFolderFor(selectedEntry)))}
              />
              <div className="menu-separator" />
              <TreeAction
                icon={<PlusSquare size={14} />}
                label="Expand All"
                disabled={hasMultipleSelection}
                onClick={() => run(expandAll)}
              />
              <TreeAction
                icon={<MinusSquare size={14} />}
                label="Collapse All"
                disabled={hasMultipleSelection}
                onClick={() => run(collapseAll)}
              />
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
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
              event.preventDefault();
              setSelectedPaths(visiblePaths, visiblePaths.at(-1) ?? null);
              selectionAnchorPathRef.current = visiblePaths[0] ?? null;
            }
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
                onSelect={selectTreeEntry}
                onRequestDelete={requestDeleteSelected}
                onMovePath={onMovePath}
                onImportFiles={onImportFiles}
                dropTargetPath={dropTargetPath}
                selectedPaths={effectiveSelectedPaths}
                onDropTargetChange={setDropTargetPath}
                dragSourcePath={dragSourcePath}
                onDragSourceChange={setDragSourcePath}
                renamingPath={renamingPath}
                onRenamingPathChange={setRenamingPath}
                onRenameConflict={setRenameConflict}
              />
            ))
          )}
        </div>
      </div>
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
      {deleteTarget && (
        <ConfirmDialog
          title="Delete"
          message={
            deleteTarget.length === 1
              ? `Delete ${deleteTarget[0].name}?`
              : `Delete ${deleteTarget.length} selected items?`
          }
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            onDeletePaths(deleteTarget.map((entry) => entry.path));
            setDeleteTarget(null);
          }}
        />
      )}
      {renameConflict && (
        <MessageDialog
          title="Rename"
          message={`Cannot rename ${renameConflict.name}. A ${renameConflict.existingType} with the name you specified already exists. Please specify a different ${renameConflict.renamedType}.`}
          onClose={() => setRenameConflict(null)}
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
  onSelect,
  onRequestDelete,
  onMovePath,
  onImportFiles,
  dropTargetPath,
  selectedPaths,
  onDropTargetChange,
  dragSourcePath,
  onDragSourceChange,
  renamingPath,
  onRenamingPathChange,
  onRenameConflict,
}: {
  entry: FsEntry;
  depth: number;
  isLast: boolean;
  onOpenFile: (entry: FsEntry) => void;
  onSelect: (path: string, modifiers: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }) => void;
  onRequestDelete: (fallbackEntry?: FsEntry) => void;
  onMovePath: (sourcePath: string, targetFolderPath: string) => void;
  onImportFiles: (source: DataTransfer | FileList | File[], targetFolderPath: string) => void | Promise<void>;
  dropTargetPath: string | null;
  selectedPaths: string[];
  onDropTargetChange: (path: string | null) => void;
  dragSourcePath: string | null;
  onDragSourceChange: (path: string | null) => void;
  renamingPath: string | null;
  onRenamingPathChange: (path: string | null) => void;
  onRenameConflict: (conflict: NonNullable<RenameConflictState>) => void;
}) {
  const expandedPaths = useAppStore((state) => state.expandedPaths);
  const toggleExpandedPath = useAppStore((state) => state.toggleExpandedPath);
  const isExpanded = expandedPaths.includes(entry.path);
  const isFolder = entry.type === 'folder';
  const isSelected = selectedPaths.includes(entry.path);
  const isRenaming = renamingPath === entry.path;
  const icon = isFolder ? (isExpanded ? folderOpenIcon : folderIcon) : fileIcon;
  const itemStyle =
    depth > 0
      ? ({ '--tree-guide-x': `${depth * 18 + 5}px` } as React.CSSProperties)
      : undefined;
  const dropFolderPath = isFolder ? entry.path : fatForgeService.targetFolderFor(entry);

  const dragHandlers = {
    draggable: !isRenaming,
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
        className={`tree-row ${isSelected ? 'selected' : ''} ${
          dropTargetPath === entry.path ? 'drop-target' : ''
        }`}
        style={{ paddingLeft: depth * 18 }}
        role="treeitem"
        tabIndex={0}
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-selected={isSelected}
        onMouseDown={(event) => {
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
            onSelect(entry.path, event);
          }
        }}
        onClick={(event) => onSelect(entry.path, event)}
        onDoubleClick={() => (isFolder ? toggleExpandedPath(entry.path) : onOpenFile(entry))}
        onKeyDown={(event) => {
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            event.stopPropagation();
            onRequestDelete(entry);
            return;
          }

          if (event.key === 'Enter') {
            if (isFolder) {
              toggleExpandedPath(entry.path);
            } else {
              onOpenFile(entry);
            }
          }

          if (event.key === ' ') {
            event.preventDefault();
            onSelect(entry.path, event);
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
        {isRenaming ? (
          <InlineRenameInput
            entry={entry}
            onConflict={onRenameConflict}
            onDone={() => onRenamingPathChange(null)}
          />
        ) : (
          <span className="tree-name">{entry.name}</span>
        )}
      </div>
      {isFolder && isExpanded && entry.children?.map((child, index) => (
        <TreeNode
          key={child.path}
          entry={child}
          depth={depth + 1}
          isLast={index === (entry.children?.length ?? 0) - 1}
          onOpenFile={onOpenFile}
          onSelect={onSelect}
          onRequestDelete={onRequestDelete}
          onMovePath={onMovePath}
          onImportFiles={onImportFiles}
          dropTargetPath={dropTargetPath}
          selectedPaths={selectedPaths}
          onDropTargetChange={onDropTargetChange}
          dragSourcePath={dragSourcePath}
          onDragSourceChange={onDragSourceChange}
          renamingPath={renamingPath}
          onRenamingPathChange={onRenamingPathChange}
          onRenameConflict={onRenameConflict}
        />
      ))}
    </div>
  );
}

function InlineRenameInput({
  entry,
  onConflict,
  onDone,
}: {
  entry: FsEntry;
  onConflict: (conflict: NonNullable<RenameConflictState>) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(entry.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipNextBlurCommitRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    input.select();
  }, []);

  const commit = () => {
    const nextName = stripLineBreaks(value).trim();
    if (!nextName || nextName === entry.name) {
      onDone();
      return;
    }
    const result = fatForgeService.renamePathWithResult(entry.path, nextName);
    if (result.status === 'renamed') {
      onDone();
      return;
    }
    if (result.status === 'exists') {
      skipNextBlurCommitRef.current = true;
      setValue(entry.name);
      onConflict({
        name: entry.name,
        renamedType: entry.type,
        existingType: result.entryType,
      });
    }
  };

  return (
    <input
      ref={inputRef}
      className="tree-rename-input"
      aria-label={`Rename ${entry.name}`}
      value={value}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onChange={(event) => setValue(stripLineBreaks(event.target.value))}
      onBlur={() => {
        if (skipNextBlurCommitRef.current) {
          skipNextBlurCommitRef.current = false;
          return;
        }
        commit();
      }}
      onPaste={(event) => {
        event.preventDefault();
        const input = event.currentTarget;
        const pastedText = stripLineBreaks(event.clipboardData.getData('text'));
        const selectionStart = input.selectionStart ?? value.length;
        const selectionEnd = input.selectionEnd ?? selectionStart;
        const nextValue = `${value.slice(0, selectionStart)}${pastedText}${value.slice(selectionEnd)}`;
        const nextCursor = selectionStart + pastedText.length;
        setValue(nextValue);
        window.requestAnimationFrame(() => {
          input.setSelectionRange(nextCursor, nextCursor);
        });
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onDone();
        }
      }}
    />
  );
}

function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, '');
}

function canDropOnPanel(dataTransfer: DataTransfer): boolean {
  return isExternalFileDrag(dataTransfer) || dataTransfer.types.includes('application/x-fatforge-path');
}

function collectVisiblePaths(entries: FsEntry[], expandedPaths: string[]): string[] {
  return entries.flatMap((entry) => {
    if (entry.type === 'folder' && expandedPaths.includes(entry.path)) {
      return [entry.path, ...collectVisiblePaths(entry.children ?? [], expandedPaths)];
    }
    return [entry.path];
  });
}

function pathsBetween(paths: string[], startPath: string, endPath: string): string[] {
  const startIndex = paths.indexOf(startPath);
  const endIndex = paths.indexOf(endPath);
  if (startIndex === -1 || endIndex === -1) {
    return [];
  }

  const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
  return paths.slice(from, to + 1);
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
