import Link from "next/link";
import HealthBadge from "../components/HealthBadge";

const features = [
  {
    title: "Visual diagnostics",
    body: "See metrics, health signals, and graph traces that explain every answer.",
  },
  {
    title: "Graph, Simple, and A/B modes",
    body: "Switch modes without leaving the page and compare profiles with a single click.",
  },
  {
    title: "Secure by default",
    body: "Session data stays in-memory and auto-cleans after inactivity. Bring your own docs safely.",
  },
];

export default function Landing() {
  return (
    <main className="flex flex-1 bg-base-200">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
        <section className="card bg-base-100 shadow-xl">
          <div className="card-body space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Live preview</p>
                <h1 className="card-title text-4xl text-base-content">
                  RAG Playground for domain experts
                </h1>
                <p className="mt-2 text-base text-base-content/70">
                  Upload documents, tune retrieval settings, and watch grounded answers stream in with full traceability.
                </p>
              </div>
              <HealthBadge />
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/playground" className="btn btn-secondary">
                Try the playground
              </Link>
              <Link href="/#docs" className="btn btn-link">
                View docs (coming soon)
              </Link>
            </div>
            <p className="text-sm text-base-content/60">
              Privacy note: uploads stay in-memory for the session and auto-clean on inactivity. Avoid sensitive data for now—we’ll add hosted samples soon.
            </p>
          </div>
        </section>

        <section id="about" className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="card bg-base-100 shadow-md">
              <div className="card-body space-y-2">
                <h2 className="card-title text-lg">{feature.title}</h2>
                <p className="text-sm text-base-content/70">{feature.body}</p>
              </div>
            </article>
          ))}
        </section>

        <section id="docs" className="card bg-base-100 shadow-lg">
          <div className="card-body space-y-3">
            <h2 className="card-title text-xl text-base-content">Getting started</h2>
            <p className="text-base text-base-content/70">
              Head to the playground to upload a PDF or use the sample dataset. Build an index, run a query in Simple, A/B, or Graph mode,
              and inspect the retrieved context and verification signals inline.
            </p>
            <div className="rounded-box bg-base-200/60 p-4 text-sm text-base-content/70">
              👉 Looking for APIs or deployment docs? They’re coming soon—subscribe to updates from the Docs link above.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
