"use client";

import { useRef, useState } from "react";

const MAX_FILE_MB = 100;

type Props = {
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void;
  onUseSamples: () => Promise<void>;
};

export default function Uploader({ disabled, onFilesSelected, onUseSamples }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handlePick = () => inputRef.current?.click();

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
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.txt,.md"
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          const tooBig = files.find((file) => file.size > MAX_FILE_MB * 1024 * 1024);
          if (tooBig) {
            alert(`"${tooBig.name}" exceeds ${MAX_FILE_MB} MB. Please choose smaller files.`);
            event.currentTarget.value = "";
            return;
          }
          if (files.length) {
            onFilesSelected(files);
          }
          event.currentTarget.value = "";
        }}
      />
      <div className="flex gap-2">
        <button
          onClick={handlePick}
          disabled={disabled}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Upload files
        </button>
        <button
          onClick={handleUseSamples}
          disabled={disabled || busy}
          className="rounded-lg bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? "Loading…" : "Use sample dataset"}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Accepted: PDF, TXT, MD. Up to {MAX_FILE_MB}MB per file (max 20 files). Avoid sensitive data.
      </p>
    </div>
  );
}
