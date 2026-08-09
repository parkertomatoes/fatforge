import React, { useRef, useState } from 'react';

export function NewFloppyDialog({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (label: string, size: '384k' | '768k' | '1.44M' | '2.88M') => void | Promise<void>;
}) {
  const [label, setLabel] = useState('FATFORGE');
  const [size, setSize] = useState<'384k' | '768k' | '1.44M' | '2.88M'>('1.44M');
  return (
    <Modal title="New Floppy Image" onClose={onCancel} draggable>
      <div className="field-row-stacked">
        <label htmlFor="floppy-label">FAT label</label>
        <input id="floppy-label" value={label} maxLength={11} onChange={(event) => setLabel(event.target.value)} />
      </div>
      <div className="field-row-stacked">
        <label htmlFor="floppy-size">Size</label>
        <select id="floppy-size" value={size} onChange={(event) => setSize(event.target.value as typeof size)}>
          <option>384k</option>
          <option>768k</option>
          <option>1.44M</option>
          <option>2.88M</option>
        </select>
      </div>
      <div className="dialog-actions">
        <button onClick={() => void onCreate(label, size)}>OK</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </Modal>
  );
}

export function NewHardDiskDialog({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (label: string, sizeMb: number) => void | Promise<void>;
}) {
  const [label, setLabel] = useState('FATFORGE');
  const [sizeMb, setSizeMb] = useState(32);
  return (
    <Modal title="New Hard Disk Image" onClose={onCancel} draggable>
      <div className="field-row-stacked">
        <label htmlFor="hard-label">FAT label</label>
        <input id="hard-label" value={label} maxLength={11} onChange={(event) => setLabel(event.target.value)} />
      </div>
      <div className="field-row-stacked">
        <label htmlFor="hard-size">Size in MB</label>
        <input
          id="hard-size"
          type="number"
          min={1}
          max={2048}
          value={sizeMb}
          onChange={(event) => setSizeMb(Number(event.target.value))}
        />
      </div>
      <div className="dialog-actions">
        <button onClick={() => void onCreate(label, sizeMb)}>OK</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </Modal>
  );
}

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About FatForge" onClose={onClose} draggable>
      <div className="about-dialog">
        <h3>FatForge</h3>
        <p>Author: parkertomatoes</p>
        <ul>
          <li>
            <a href="https://github.com/parkertomatoes/fatforge" target="_blank" rel="noreferrer">
              github
            </a>
          </li>
          <li>
            <a href="https://github.com/parkertomatoes/fatfs-wasm" target="_blank" rel="noreferrer">
              fatfs-wasm
            </a>
          </li>
        </ul>
      </div>
      <div className="dialog-actions">
        <button onClick={onClose}>OK</button>
      </div>
    </Modal>
  );
}

export function SaveImageDialog({
  initialFileName,
  onCancel,
  onSave,
}: {
  initialFileName: string;
  onCancel: () => void;
  onSave: (fileName: string) => void;
}) {
  const [fileName, setFileName] = useState(initialFileName);
  const trimmedFileName = fileName.trim();

  const submit = () => {
    if (trimmedFileName) {
      onSave(trimmedFileName);
    }
  };

  return (
    <Modal title="Save Image As" onClose={onCancel} draggable>
      <div className="field-row-stacked">
        <label htmlFor="save-image-file-name">File name</label>
        <input
          id="save-image-file-name"
          autoFocus
          value={fileName}
          onChange={(event) => setFileName(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submit();
            }
            if (event.key === 'Escape') {
              onCancel();
            }
          }}
        />
      </div>
      <div className="dialog-actions">
        <button disabled={!trimmedFileName} onClick={submit}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </Modal>
  );
}

export function NameDialog({
  title,
  label,
  initialValue,
  onCancel,
  onSubmit,
}: {
  title: string;
  label: string;
  initialValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="field-row-stacked">
        <label htmlFor="name-dialog-input">{label}</label>
        <input
          id="name-dialog-input"
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSubmit(value);
            }
            if (event.key === 'Escape') {
              onCancel();
            }
          }}
        />
      </div>
      <div className="dialog-actions">
        <button onClick={() => onSubmit(value)}>OK</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </Modal>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="confirm-message">{message}</p>
      <div className="dialog-actions">
        <button onClick={onConfirm}>{confirmLabel}</button>
        <button onClick={onCancel}>{cancelLabel}</button>
      </div>
    </Modal>
  );
}

export function MessageDialog({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="confirm-message">{message}</p>
      <div className="dialog-actions">
        <button autoFocus onClick={onClose}>OK</button>
      </div>
    </Modal>
  );
}

export function InfoDialog({
  title,
  rows,
  onClose,
}: {
  title: string;
  rows: Array<[string, string]>;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <table className="info-table">
        <tbody>
          {rows.map(([key, value]) => (
            <tr key={key}>
              <th>{key}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dialog-actions">
        <button onClick={onClose}>OK</button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  draggable = false,
  children,
}: {
  title: string;
  onClose: () => void;
  draggable?: boolean;
  children: React.ReactNode;
}) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  function handleTitlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggable || event.button !== 0 || (event.target as HTMLElement).closest('.title-bar-controls')) {
      return;
    }

    const rect = windowRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    event.preventDefault();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    setPosition(clampDialogPosition(rect.left, rect.top, rect.width, rect.height));

    const onMove = (moveEvent: PointerEvent) => {
      setPosition(clampDialogPosition(
        moveEvent.clientX - offsetX,
        moveEvent.clientY - offsetY,
        rect.width,
        rect.height,
      ));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <div className="modal-backdrop">
      <div
        ref={windowRef}
        className={`window modal-window ${draggable ? 'modal-window-draggable' : ''}`}
        style={position ? { position: 'fixed', left: position.left, top: position.top } : undefined}
      >
        <div className="title-bar" onPointerDown={handleTitlePointerDown}>
          <div className="title-bar-text">{title}</div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={onClose} />
          </div>
        </div>
        <div className="window-body">{children}</div>
      </div>
    </div>
  );
}

function clampDialogPosition(left: number, top: number, width: number, height: number) {
  const maxLeft = Math.max(0, window.innerWidth - width);
  const maxTop = Math.max(0, window.innerHeight - height);
  return {
    left: Math.min(maxLeft, Math.max(0, left)),
    top: Math.min(maxTop, Math.max(0, top)),
  };
}
