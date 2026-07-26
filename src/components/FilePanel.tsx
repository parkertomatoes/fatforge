import { Copy, FilePlus2, FolderOpen, Info, MinusSquare, Pencil, PlusSquare, Scissors, Trash2 } from 'lucide-react';
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
}

type NameDialogState =
  | { mode: 'new'; parentPath: string }
  | { mode: 'rename'; entry: FsEntry }
  | null;

export function FilePanel(props: FilePanelProps) {
  const { width, tree, onOpenFile, onDeletePath, onMovePath, onPasteInto } = props;
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
  const menuRef = useRef<HTMLDivElement>(null);
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

  return (
    <aside className="file-panel window" style={{ width }}>
      <div className="title-bar">
        <div className="title-bar-text">Files</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" onClick={() => setFilePanelCollapsed(true)} />
        </div>
      </div>
      <div
        className="file-panel-body"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const source = event.dataTransfer.getData('application/x-fatforge-path');
          if (source) {
            onMovePath(source, '');
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
                    setNameDialog({ mode: 'new', parentPath: fatForgeService.targetFolderFor(selectedEntry) }),
                  )
                }
              />
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
              />
            ))
          )}
        </div>
      </div>
      {nameDialog?.mode === 'new' && (
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
}: {
  entry: FsEntry;
  depth: number;
  isLast: boolean;
  onOpenFile: (entry: FsEntry) => void;
  onMovePath: (sourcePath: string, targetFolderPath: string) => void;
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

  const dragHandlers = {
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.dataTransfer.setData('application/x-fatforge-path', entry.path);
      event.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (event: React.DragEvent) => {
      if (isFolder) {
        event.preventDefault();
      }
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      const source = event.dataTransfer.getData('application/x-fatforge-path');
      if (source && isFolder) {
        onMovePath(source, entry.path);
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
        className={`tree-row ${selectedPath === entry.path ? 'selected' : ''}`}
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
        />
      ))}
    </div>
  );
}

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
