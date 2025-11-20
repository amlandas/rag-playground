import type { RetrievedChunk } from "./types";

export type SnippetPayload = Array<{ rank: number; text: string }>;

export function toSnippetPayload(chunks: RetrievedChunk[]): SnippetPayload {
  return chunks
    .filter((chunk) => Boolean(chunk?.text?.trim()))
    .map((chunk) => ({ rank: chunk.rank, text: chunk.text }));
}
