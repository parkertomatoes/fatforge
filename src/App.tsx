import React, { useRef, useState } from 'react';
import { FilePanel } from './components/FilePanel';
import { MenuBar } from './components/MenuBar';
import { ContentDock } from './components/ContentDock';
import { AboutDialog, NewFloppyDialog, NewHardDiskDialog } from './components/Dialogs';
import { useAppStore } from './store/useAppStore';
import { fatForgeService } from './services/fatForgeService';

export function App() {
  const dialog = useAppStore((state) => state.dialog);
  const diskMeta = useAppStore((state) => state.diskMeta);
  const diskUsage = useAppStore((state) => state.diskUsage);
  const tree = useAppStore((state) => state.tree);
  const status = useAppStore((state) => state.status);
  const filePanelCollapsed = useAppStore((state) => state.filePanelCollapsed);
  const filePanelWidth = useAppStore((state) => state.filePanelWidth);
  const setDialog = useAppStore((state) => state.setDialog);
  const setFilePanelCollapsed = useAppStore((state) => state.setFilePanelCollapsed);
  const activeDocument = useAppStore(fatForgeService.selectActiveDocument);
  const hasImage = useAppStore(fatForgeService.selectHasImage);
  const setFilePanelWidth = useAppStore((state) => state.setFilePanelWidth);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const usagePercent = diskUsage && diskUsage.totalBytes > 0
    ? Math.min(100, Math.max(0, (diskUsage.usedBytes / diskUsage.totalBytes) * 100))
    : 0;

  function handleDragOver(event: React.DragEvent) {
    if (!isFileDrag(event)) {
      setDragActive(false);
      return;
    }

    if (hasImage) {
      setDragActive(false);
      return;
    }

    event.preventDefault();
    setDragActive(true);
  }

  async function handleDrop(event: React.DragEvent) {
    setDragActive(false);
    if (!isFileDrag(event)) {
      return;
    }

    if (hasImage) {
      return;
    }

    event.preventDefault();
    const file = event.dataTransfer.files.item(0);
    if (file) {
      await fatForgeService.openImageFile(file);
    }
  }

  return (
    <div
      className={`app-shell ${dragActive ? 'drag-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <MenuBar
        hasImage={hasImage}
        activeDocument={activeDocument}
        onNewFloppy={() => setDialog('new-floppy')}
        onNewHardDisk={() => setDialog('new-hard-disk')}
        onOpenImage={() => imageInputRef.current?.click()}
        onCloseImage={fatForgeService.closeImage}
        onSaveImage={fatForgeService.downloadCurrentImage}
        onSaveFile={fatForgeService.saveActiveFile}
        onCloseFile={fatForgeService.closeActiveFile}
        onUndo={fatForgeService.undoImageChange}
        onRedo={fatForgeService.redoImageChange}
        onFind={fatForgeService.dispatchFind}
        onAbout={() => setDialog('about')}
      />
      <input
        ref={imageInputRef}
        className="hidden-input"
        type="file"
        accept=".img,.ima,.vfd,.dsk,.bin"
        onChange={(event) => {
          const file = event.currentTarget.files?.item(0);
          if (file) {
            void fatForgeService.openImageFile(file);
          }
          event.currentTarget.value = '';
        }}
      />
      <main className={`workbench ${hasImage ? '' : 'workbench-empty'}`}>
        {hasImage ? (
          <>
            {!filePanelCollapsed && (
              <FilePanel
                width={filePanelWidth}
                tree={tree}
                onOpenFile={fatForgeService.openFile}
                onDeletePaths={fatForgeService.deletePaths}
                onMovePath={fatForgeService.movePath}
                onPasteInto={fatForgeService.pasteClipboardInto}
                onImportFiles={fatForgeService.importFilesIntoImage}
              />
            )}
            {!filePanelCollapsed && (
              <div
                className="panel-resizer"
                onPointerDown={(event) => {
                  const startX = event.clientX;
                  const startWidth = filePanelWidth;
                  const onMove = (moveEvent: PointerEvent) => {
                    setFilePanelWidth(startWidth + moveEvent.clientX - startX);
                  };
                  const onUp = () => {
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                  };
                  window.addEventListener('pointermove', onMove);
                  window.addEventListener('pointerup', onUp);
                }}
              />
            )}
            {filePanelCollapsed && (
              <button
                className="collapsed-file-strip"
                title="Show file panel"
                aria-label="Show file panel"
                onClick={() => setFilePanelCollapsed(false)}
              >
                Files
              </button>
            )}
            <ContentDock />
          </>
        ) : (
          <div className="empty-workbench-message">Create or open an image to get started. Drag files here to open</div>
        )}
      </main>
      <footer className={`status-bar ${diskUsage ? 'status-bar-with-usage' : ''}`}>
        <span>
          {diskMeta
            ? `${diskMeta.label || 'NO LABEL'} - ${fatForgeService.formatBytes(diskMeta.sizeBytes)}`
            : 'FatForge'}
        </span>
        {diskUsage && (
          <span className="status-usage">
            <span className="status-usage-text">
              {fatForgeService.formatBytes(diskUsage.usedBytes)} used,{' '}
              {fatForgeService.formatBytes(diskUsage.freeBytes)} free
            </span>
            <span
              className="status-usage-bar"
              role="meter"
              aria-label="Image space used"
              aria-valuemin={0}
              aria-valuemax={diskUsage.totalBytes}
              aria-valuenow={diskUsage.usedBytes}
              title={`${fatForgeService.formatBytes(diskUsage.usedBytes)} used of ${fatForgeService.formatBytes(
                diskUsage.totalBytes,
              )}`}
            >
              <span style={{ width: `${usagePercent}%` }} />
            </span>
          </span>
        )}
        <span>{status}</span>
      </footer>
      {dialog === 'new-floppy' && (
        <NewFloppyDialog onCancel={() => setDialog(null)} onCreate={fatForgeService.createFloppyImage} />
      )}
      {dialog === 'new-hard-disk' && (
        <NewHardDiskDialog onCancel={() => setDialog(null)} onCreate={fatForgeService.createHardDiskImage} />
      )}
      {dialog === 'about' && <AboutDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

function isFileDrag(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes('Files');
}
