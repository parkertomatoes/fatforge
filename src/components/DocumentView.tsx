import Editor, { type OnMount } from '@monaco-editor/react';
import React, { useEffect, useRef, useState } from 'react';
import { fatForgeService } from '../services/fatForgeService';
import { useAppStore } from '../store/useAppStore';
import { languageForPath } from '../utils/fileKinds';

export function DocumentView({ documentId }: { documentId: string }) {
  const document = useAppStore((state) => state.openDocuments.find((item) => item.id === documentId));
  const updateDocumentContent = useAppStore((state) => state.updateDocumentContent);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    const onFind = () => {
      editorRef.current?.getAction('actions.find')?.run();
    };
    window.addEventListener('fatforge:find', onFind);
    return () => window.removeEventListener('fatforge:find', onFind);
  }, []);

  if (!document) {
    return <div className="document-empty">Closed</div>;
  }

  if (document.kind === 'text') {
    return (
      <div className="text-editor-wrap">
        <Editor
          height="100%"
          language={languageForPath(document.path)}
          value={document.content}
          theme="vs"
          options={{
            automaticLayout: true,
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
          }}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
              fatForgeService.saveActiveFile();
            });
          }}
          onChange={(value) => updateDocumentContent(document.id, value ?? '')}
        />
      </div>
    );
  }

  if (document.kind === 'image') {
    return <ImageViewer data={document.data} mime={document.mime} name={document.name} />;
  }

  return <HexViewer data={document.data} />;
}

function ImageViewer({ data, mime, name }: { data: Uint8Array; mime: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const url = useObjectUrl(data, mime);
  return (
    <div className="image-viewer">
      {url && !failed ? (
        <img src={url} alt={name} onError={() => setFailed(true)} />
      ) : (
        <div className="unsupported-image">Preview unavailable for this image encoding.</div>
      )}
    </div>
  );
}

function HexViewer({ data }: { data: Uint8Array }) {
  return (
    <div className="hex-viewer">
      <pre>{fatForgeService.formatHexRows(data).join('\n')}</pre>
    </div>
  );
}

function useObjectUrl(data: Uint8Array, mime: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const blob = new Blob([new Uint8Array(data).buffer as ArrayBuffer], { type: mime });
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [data, mime]);
  return url;
}
