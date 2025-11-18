"use client";

import React, { useCallback, useRef, useState } from "react";

const MAX_FILE_MB = 100;

type Props = {
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void;
  onUseSamples: () => Promise<void>;
};

export default function Uploader({ disabled, onFilesSelected, onUseSamples }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handlePick = () => inputRef.current?.click();

  const applyFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      const tooBig = files.find((file) => file.size > MAX_FILE_MB * 1024 * 1024);
      if (tooBig) {
        window.alert(`"${tooBig.name}" exceeds ${MAX_FILE_MB} MB. Please choose smaller files.`);
        return;
      }
      onFilesSelected(files);
    },
    [onFilesSelected],
  );

  async function handleUseSamples() {
    if (busy) return;
    setBusy(true);
    try {
      await onUseSamples();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.txt,.md"
        onChange={(event) => {
          applyFiles(Array.from(event.target.files || []));
          event.currentTarget.value = "";
        }}
      />
      <div
        className={`rounded-box border-2 border-dashed ${
          isDragging ? "border-primary bg-primary/5" : "border-base-300 bg-base-200/50"
        } px-4 py-6 text-center text-sm transition hover:border-primary hover:bg-primary/10`}
        onClick={handlePick}
        onDragOver={(event) => {
          event.preventDefault();
          if (disabled) return;
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (disabled) return;
          setIsDragging(false);
          const files = Array.from(event.dataTransfer?.files ?? []);
          applyFiles(files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handlePick();
          }
        }}
      >
        <p className="font-semibold text-base-content">Drop files here or click to browse</p>
        <p className="text-xs text-base-content/60">
          PDF, TXT, or MD · Up to {MAX_FILE_MB}MB each · Max 20 files
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleUseSamples}
          disabled={disabled}
          className="btn btn-outline btn-xs sm:btn-sm"
        >
          {busy ? "Loading…" : "Use sample dataset"}
        </button>
        <button
          onClick={handlePick}
          disabled={disabled || busy}
          className="btn btn-primary btn-xs sm:btn-sm"
        >
          Browse files
        </button>
      </div>
      <p className="text-xs text-base-content/60">
        Avoid sensitive data. Files upload immediately after selection.
      </p>
    </div>
  );
}
