# RAG Playground

RAG Playground is an experimental space for iterating on retrieval-augmented generation workflows. The repository hosts a modern web UI built with Next.js and Tailwind CSS, a FastAPI backend for orchestration and data APIs, and a shared package that centralizes types and schemas used across the stack.

## Structure

- `apps/web` – Next.js application for exploring RAG features and visualizations.
- `apps/api` – FastAPI service exposing endpoints for experimentation and orchestration.
- `packages/shared` – Cross-cutting types and schemas that both the web and API layers rely on.

## Getting Started

```bash
pnpm install
pnpm -r dev
```

The first command installs JavaScript dependencies across the workspace. The second spins up the web UI (Next.js dev server) and the API (FastAPI with hot reload). See each app README for additional commands.
