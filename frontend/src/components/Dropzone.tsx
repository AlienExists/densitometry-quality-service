import { useRef, useState, type DragEvent, type ReactNode } from 'react';

interface DropzoneProps {
  accept: string;
  icon: ReactNode;
  title: string;
  hint: string;
  buttonLabel: string;
  onFile: (file: File) => void;
}

export function Dropzone({ accept, icon, title, hint, buttonLabel, onFile }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!dragging) setDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  };

  return (
    <div
      className={dragging ? 'dropzone dropzone--active' : 'dropzone'}
      onClick={openPicker}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <span className="dropzone__icon">{icon}</span>
      <p className="dropzone__title">{title}</p>
      <p className="dropzone__hint">{hint}</p>
      <button
        type="button"
        className="button"
        onClick={(event) => {
          event.stopPropagation();
          openPicker();
        }}
      >
        {buttonLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

interface TaskCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  tone?: 'default' | 'error';
}

export function TaskCard({ icon, title, children, tone = 'default' }: TaskCardProps) {
  return (
    <div className={tone === 'error' ? 'dropzone dropzone--static dropzone--error' : 'dropzone dropzone--static'}>
      <span className="dropzone__icon">{icon}</span>
      <p className="dropzone__title dropzone__title--file">{title}</p>
      {children}
    </div>
  );
}
