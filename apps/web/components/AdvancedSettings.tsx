"use client";
import React from "react";
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
    <label className="form-control w-full">
      <div className="label">
        <span className="label-text text-xs font-semibold uppercase text-base-content/60">
          {label}
        </span>
      </div>
      <input
        className="input input-bordered input-sm w-full bg-base-100"
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
  const profiles = [
    { key: "A" as const, value: valueA, label: "Profile A", accent: "badge-primary" },
    { key: "B" as const, value: valueB, label: "Profile B", accent: "badge-secondary" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {profiles.map(({ key, value, label, accent }) => (
        <div key={key} className="card bg-base-100 shadow">
          <div className="card-body space-y-3">
            <div className="flex items-center justify-between">
              <div className="card-title text-base">{label}</div>
              <span className={`badge ${accent} badge-outline`}>k={value.k}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="k"
                value={value.k}
                onChange={(next) => onChange(key, { ...value, k: Number(next) })}
              />
              <Field
                label="chunk size"
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
            </div>
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
