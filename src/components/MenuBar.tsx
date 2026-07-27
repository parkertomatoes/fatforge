import React, { useEffect, useRef, useState } from 'react';
import type { OpenDocument } from '../types';
import { fatForgeService } from '../services/fatForgeService';
import { useAppStore } from '../store/useAppStore';

interface MenuBarProps {
  hasImage: boolean;
  activeDocument: OpenDocument | null;
  onNewFloppy: () => void;
  onNewHardDisk: () => void;
  onOpenImage: () => void;
  onCloseImage: () => void;
  onSaveImage: () => void;
  onSaveFile: () => void;
  onCloseFile: () => void;
  onUndo: () => void | Promise<void>;
  onRedo: () => void | Promise<void>;
  onFind: () => void;
  onAbout: () => void;
}

type MenuName = 'file' | 'edit' | 'help' | null;

export function MenuBar(props: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuName>(null);
  const selectedPath = useAppStore((state) => state.selectedPath);
  const selectedPaths = useAppStore((state) => state.selectedPaths);
  const tree = useAppStore((state) => state.tree);
  const clipboard = useAppStore((state) => state.clipboard);
  const rootRef = useRef<HTMLMenuElement>(null);
  const selectedEntry = selectedPath ? fatForgeService.findEntry(tree, selectedPath) : null;
  const hasMultipleSelection = selectedPaths.length > 1;

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('pointerdown', onClick);
    return () => window.removeEventListener('pointerdown', onClick);
  }, []);

  const menuAction = (action: () => void | Promise<void>) => {
    setOpenMenu(null);
    void action();
  };

  return (
    <menu ref={rootRef} className="menu-bar" role="menubar">
      <MenuButton label="File" open={openMenu === 'file'} onClick={() => setOpenMenu(toggle(openMenu, 'file'))}>
        <MenuItem label="New Floppy Image" onClick={() => menuAction(props.onNewFloppy)} />
        <MenuItem label="New Hard Disk Image" onClick={() => menuAction(props.onNewHardDisk)} />
        <MenuSeparator />
        <MenuItem label="Open Image" onClick={() => menuAction(props.onOpenImage)} />
        <MenuItem label="Save Image" disabled={!props.hasImage} onClick={() => menuAction(props.onSaveImage)} />
        <MenuItem label="Close Image" disabled={!props.hasImage} onClick={() => menuAction(props.onCloseImage)} />
        <MenuSeparator />
        <MenuItem
          label="Save File"
          disabled={!props.activeDocument || props.activeDocument.kind !== 'text'}
          onClick={() => menuAction(props.onSaveFile)}
        />
        <MenuItem
          label="Close File"
          disabled={!props.activeDocument}
          onClick={() => menuAction(props.onCloseFile)}
        />
      </MenuButton>
      <MenuButton label="Edit" open={openMenu === 'edit'} onClick={() => setOpenMenu(toggle(openMenu, 'edit'))}>
        <MenuItem label="Undo" onClick={() => menuAction(props.onUndo)} />
        <MenuItem label="Redo" onClick={() => menuAction(props.onRedo)} />
        <MenuSeparator />
        <MenuItem
          label="Cut"
          disabled={hasMultipleSelection || !selectedEntry}
          onClick={() =>
            menuAction(() =>
              selectedEntry
                ? fatForgeService.cutEntry(selectedEntry)
                : undefined,
            )
          }
        />
        <MenuItem
          label="Copy"
          disabled={hasMultipleSelection || !selectedEntry}
          onClick={() =>
            menuAction(() =>
              selectedEntry
                ? fatForgeService.copyEntryToClipboard(selectedEntry)
                : undefined,
            )
          }
        />
        <MenuItem
          label="Paste"
          disabled={hasMultipleSelection || !clipboard || !props.hasImage}
          onClick={() =>
            menuAction(() => fatForgeService.pasteClipboardInto(fatForgeService.targetFolderFor(selectedEntry)))
          }
        />
        <MenuSeparator />
        <MenuItem label="Find" disabled={!props.activeDocument} onClick={() => menuAction(props.onFind)} />
      </MenuButton>
      <MenuButton label="Help" open={openMenu === 'help'} onClick={() => setOpenMenu(toggle(openMenu, 'help'))}>
        <MenuItem label="About" onClick={() => menuAction(props.onAbout)} />
      </MenuButton>
    </menu>
  );
}

function MenuButton({
  label,
  open,
  onClick,
  children,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="menu-root" role="none">
      <button
        className={`menu-title ${open ? 'active' : ''}`}
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onClick}
      >
        {label}
      </button>
      {open && (
        <menu className="menu-dropdown" role="menu">
          {children}
        </menu>
      )}
    </li>
  );
}

function MenuItem({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <li role="none">
      <button className="menu-item" role="menuitem" disabled={disabled} onClick={onClick}>
        {label}
      </button>
    </li>
  );
}

function MenuSeparator() {
  return <li className="menu-separator" role="separator" />;
}

function toggle(current: MenuName, next: MenuName): MenuName {
  return current === next ? null : next;
}
