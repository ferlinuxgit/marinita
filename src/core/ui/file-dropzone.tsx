"use client";

import { FileUp } from "lucide-react";
import { DragEvent, useRef, useState } from "react";

type FileDropzoneProps = {
  id: string;
  /** Value for the input `accept` attribute. */
  accept: string;
  onSelect: (file: File | null) => void;
  className?: string;
  children: React.ReactNode;
};

/** Click-or-drop file picker shared by the upload forms of every module. */
export function FileDropzone({ id, accept, onSelect, className = "", children }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    onSelect(event.dataTransfer.files.item(0));
  }

  return (
    <>
      <button
        className={`dropzone ${className} ${isDragging ? "dragging" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        type="button"
      >
        {children}
      </button>
      <input
        accept={accept}
        className="sr-only"
        id={id}
        onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
        ref={inputRef}
        type="file"
      />
    </>
  );
}

export function DefaultDropzoneContent({ label }: { label: string }) {
  return (
    <>
      <FileUp size={22} />
      <span>{label}</span>
    </>
  );
}
