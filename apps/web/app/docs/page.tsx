import React from "react";
import ReactMarkdown from "react-markdown";

// Source content adapted from README.md and DEPLOYMENT.md
const DOCS_CONTENT = `
# Scientia Documentation

Scientia (formerly RAG Playground) is a full-stack retrieval-augmented generation research assistant. It pairs a FastAPI backend with a Next.js laboratory so you can ingest documents, experiment with hybrid retrieval (FAISS + BM25 + MMR), apply CE/LLM rerankers, and stream grounded answers with citations.

## Key Capabilities

- **Hybrid Retrieval**: Dense + lexical retrieval with reciprocal rank fusion and optional MMR diversification.
- **Answer Composer**: Supports document-only (grounded) and doc + world context modes with sentence-level citations.
- **Streaming Responses**: SSE responses rendered as Markdown with confidence badges and citation panels.
- **Configurable Rerankers**: Cross-encoder or OpenAI LLM controlled via environment variables.
- **Advanced Graph Mode**: Blends lightweight graph traversal with hybrid retrievers for multi-hop questions.
- **Auth**: Optional Google Sign-In gates uploads/queries and unlocks an admin panel.

## Architecture

**Backend (apps/api)**
- **Stack**: FastAPI, Pydantic, FAISS, rank-bm25
- **Highlights**: Ingestion, chunking, indexing, hybrid retrieval, reranking, composition.

**Frontend (apps/web)**
- **Stack**: Next.js 14, Tailwind, React Markdown
- **Highlights**: Laboratory UI, SSE streaming, auth diagnostics.

## Getting Started

1. **Upload Documents**: Head to the [Laboratory](/laboratory) and upload PDF or text files.
2. **Build Index**: Click "Build Index" to process your files.
3. **Ask Questions**: Type a query like "What is the summary of this document?" and hit Run.

## Advanced Modes

### Simple Mode
Standard RAG pipeline. Good for most questions.

### A/B Mode
Compare two different retrieval profiles (e.g., varied K, chunk size, or temperature) side-by-side to improve your validaton.

### Graph Mode
Enables multi-hop reasoning. The system plans a path through your data, retrieving connected context to answer complex questions.

## Deployment

Scientia is designed to run on Google Cloud Run.

- **Backend API**: Cloud Run service \`rag-playground-api\`.
- **Frontend Web**: Cloud Run service \`rag-playground-web\`.

### Secrets & Configuration
Secrets (OpenAI keys, Google OAuth, session secrets) live in Cloud Run environment variables or Google Secret Manager. They are never committed to git.

## UI & Themes
Scientia supports **Dark** (default) and **Pastel** themes. Toggle them in the top-right corner.
`;

export default function DocsPage() {
    return (
        <main className="min-h-screen bg-base-200 py-10">
            <div className="mx-auto max-w-4xl px-4">
                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <article className="prose max-w-none dark:prose-invert">
                            <ReactMarkdown>
                                {DOCS_CONTENT}
                            </ReactMarkdown>
                        </article>
                    </div>
                </div>
            </div>
        </main>
    );
}
