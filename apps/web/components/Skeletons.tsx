"use client";

import React from "react";

type SkeletonProps = {
  className?: string;
};

export function SkeletonLine({ className = "h-4 w-full" }: SkeletonProps) {
  return <div className={`skeleton rounded ${className}`} />;
}

type SkeletonBlockProps = {
  lines?: number;
  className?: string;
};

export function SkeletonBlock({ lines = 3, className }: SkeletonBlockProps) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLine key={index} />
      ))}
    </div>
  );
}

export default SkeletonLine;
