import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function renderMarkdown(value: string, fallback: string) {
  if (!value.trim()) {
    return <p className="text-sm text-base-content/60">{fallback}</p>;
  }
  return (
    <ReactMarkdown className="answer-body prose prose-sm" remarkPlugins={[remarkGfm]}>
      {value}
    </ReactMarkdown>
  );
}
