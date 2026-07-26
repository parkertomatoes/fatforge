import { DockviewComponent, type IContentRenderer, type IWatermarkRenderer } from 'dockview';
import React, { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useAppStore } from '../store/useAppStore';
import { DocumentView } from './DocumentView';

export function ContentDock() {
  const hostRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<DockviewComponent | null>(null);
  const rootsRef = useRef<Map<string, Root>>(new Map());
  const documents = useAppStore((state) => state.openDocuments);
  const activeDocumentId = useAppStore((state) => state.activeDocumentId);
  const closeDocument = useAppStore((state) => state.closeDocument);
  const setActiveDocument = useAppStore((state) => state.setActiveDocument);

  useEffect(() => {
    if (!hostRef.current || dockRef.current) {
      return;
    }
    const dock = new DockviewComponent(hostRef.current, {
      className: 'dockview-98',
      singleTabMode: 'default',
      noPanelsOverlay: 'watermark',
      createWatermarkComponent: () => new WatermarkRenderer(),
      createComponent: (options) => new ReactPanelRenderer(options.id, rootsRef.current),
      getTabContextMenuItems: () => ['close', 'closeOthers', 'closeAll'],
    });
    dockRef.current = dock;
    const removeDisposable = dock.api.onDidRemovePanel((panel) => {
      rootsRef.current.get(panel.id)?.unmount();
      rootsRef.current.delete(panel.id);
      closeDocument(panel.id);
    });
    const activeDisposable = dock.api.onDidActivePanelChange((event) => {
      setActiveDocument(event.panel?.id ?? null);
    });
    return () => {
      removeDisposable.dispose();
      activeDisposable.dispose();
      dock.dispose();
      dockRef.current = null;
      for (const root of rootsRef.current.values()) {
        root.unmount();
      }
      rootsRef.current.clear();
    };
  }, [closeDocument, setActiveDocument]);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) {
      return;
    }
    const ids = new Set(documents.map((document) => document.id));
    for (const panel of dock.api.panels) {
      if (!ids.has(panel.id)) {
        dock.api.removePanel(panel);
      }
    }
    for (const document of documents) {
      const title = document.dirty ? `${document.name} *` : document.name;
      const existing = dock.api.getPanel(document.id);
      if (existing) {
        existing.api.setTitle(title);
      } else {
        dock.api.addPanel({
          id: document.id,
          component: 'document',
          title,
          params: { documentId: document.id },
        });
      }
    }
  }, [documents]);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock || !activeDocumentId) {
      return;
    }
    dock.api.getPanel(activeDocumentId)?.api.setActive();
  }, [activeDocumentId]);

  return <section ref={hostRef} className="content-dock" />;
}

class ReactPanelRenderer implements IContentRenderer {
  readonly element = document.createElement('div');
  private root: Root | null = null;

  constructor(
    private readonly id: string,
    private readonly roots: Map<string, Root>,
  ) {
    this.element.className = 'document-panel';
  }

  init(parameters: { params?: { documentId?: string } }) {
    const documentId = parameters.params?.documentId ?? this.id;
    this.root = createRoot(this.element);
    this.roots.set(this.id, this.root);
    this.root.render(<DocumentView documentId={documentId} />);
  }

  dispose() {
    this.root?.unmount();
    this.roots.delete(this.id);
  }
}

class WatermarkRenderer implements IWatermarkRenderer {
  readonly element = document.createElement('div');

  init() {
    this.element.className = 'dock-watermark';
    this.element.textContent = 'Open a file from the tree';
  }

  dispose() {
    this.element.remove();
  }
}
