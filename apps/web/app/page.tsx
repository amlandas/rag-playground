import Link from "next/link";
import HealthBadge from "../components/HealthBadge";

export default function Landing() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-6">
        <HealthBadge />
      </div>

      <h1 className="text-4xl font-bold tracking-tight">
        RAG Playground for Domain Experts
      </h1>
      <p className="mt-4 text-lg text-gray-700">
        Upload documents, tweak retrieval settings, and see exactly what the AI used to answer —
        no code required.
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/playground"
          className="rounded-lg bg-black px-5 py-2.5 text-white shadow hover:bg-gray-800"
        >
          Try the Playground
        </Link>
        <a
          href="https://"
          target="_blank"
          className="rounded-lg border px-5 py-2.5 text-gray-800 hover:bg-gray-50"
        >
          Read the docs (coming soon)
        </a>
      </div>

      <p className="mt-8 text-sm text-gray-500">
        Privacy note: For now, this demo stores files only in an in-memory session and auto-cleans
        on inactivity. Avoid uploading sensitive data. We’ll provide sample docs in the next step.
      </p>
    </main>
  );
}
