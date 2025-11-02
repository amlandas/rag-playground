"use client";

import type { CompareProfile } from "../lib/types";

type Props = {
  valueA: CompareProfile;
  valueB: CompareProfile;
  onChange: (which: "A" | "B", next: CompareProfile) => void;
};

type FieldProps = {
  label: string;
  value: number | string;
  onChange: (value: number | string) => void;
  type?: "number" | "text";
  step?: number;
  min?: number;
};

function Field({ label, value, onChange, type = "number", step = 1, min = 0 }: FieldProps) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-gray-600">{label}</span>
      <input
        className="w-32 rounded border px-2 py-1"
        value={value}
        onChange={(event) =>
          onChange(type === "number" ? Number(event.target.value) : event.target.value)
        }
        type={type}
        step={step}
        min={type === "number" ? min : undefined}
      />
    </label>
  );
}

export default function AdvancedSettings({ valueA, valueB, onChange }: Props) {
  return (
    <div className="space-y-4">
      {[
        { key: "A" as const, value: valueA, label: "Profile A" },
        { key: "B" as const, value: valueB, label: "Profile B" },
      ].map(({ key, value, label }) => (
        <div key={key} className="rounded-lg border p-3">
          <div className="mb-2 text-sm font-semibold">{label}</div>
          <div className="space-y-2">
            <Field
              label="k"
              value={value.k}
              onChange={(next) => onChange(key, { ...value, k: Number(next) })}
            />
            <Field
              label="chunk_size"
              value={value.chunk_size}
              onChange={(next) => onChange(key, { ...value, chunk_size: Number(next) })}
            />
            <Field
              label="overlap"
              value={value.overlap}
              onChange={(next) => onChange(key, { ...value, overlap: Number(next) })}
            />
            <Field
              label="temperature"
              value={value.temperature ?? 0.2}
              onChange={(next) => onChange(key, { ...value, temperature: Number(next) })}
              step={0.1}
            />
            <Field
              label="model"
              type="text"
              value={value.model ?? "gpt-4o-mini"}
              onChange={(next) => onChange(key, { ...value, model: String(next) })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
