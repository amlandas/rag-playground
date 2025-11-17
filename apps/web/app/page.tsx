import Link from "next/link";
import HealthBadge from "../components/HealthBadge";

const features = [
  {
    title: "Simple Mode",
    description: "Grounded answers on top of your uploaded documents with citations.",
  },
  {
    title: "A/B Mode",
    description: "Compare two retrieval configs side-by-side to pick the best setup.",
  },
  {
    title: "Graph RAG",
    description: "Plan multi-hop queries, rerank, and run fact-check verification.",
  },
  {
    title: "Inline Traces",
    description: "Inspect planner output, retrieved docs, rerank decisions, and verification.",
  },
];

export default function Landing() {
  return (
    <main className="bg-base-100">
      <section className="hero min-h-[70vh] px-4 py-16">
        <div className="hero-content w-full flex-col gap-10 lg:flex-row">
          <div className="flex-1 space-y-5">
            <div className="badge badge-success badge-outline w-fit">
              <HealthBadge />
            </div>
            <h1 className="text-4xl font-bold leading-tight text-base-content lg:text-5xl">
              RAG Playground for Simple, A/B, and Graph RAG workflows
            </h1>
            <p className="text-lg text-base-content/80">
              Upload documents, configure retrieval, and inspect exactly what the AI used to answer.
              No code required.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/playground" className="btn btn-primary">
                Try the Playground
              </Link>
              <a
                className="btn btn-ghost"
                href="https://github.com/amlandas/rag-playground"
                target="_blank"
              >
                View on GitHub
              </a>
            </div>
            <p className="text-sm text-base-content/60">
              Privacy note: sessions are temporary. Avoid sensitive data; sample documents are available in the app.
            </p>
          </div>
          <div className="flex flex-1 justify-center lg:justify-end">
            <div className="stats stats-vertical shadow lg:stats-horizontal">
              <div className="stat">
                <div className="stat-title text-base-content/70">Retrieval Modes</div>
                <div className="stat-value text-primary">3</div>
                <div className="stat-desc">Simple · A/B · Graph</div>
              </div>
              <div className="stat">
                <div className="stat-title text-base-content/70">Explainability</div>
                <div className="stat-value text-secondary">Traces</div>
                <div className="stat-desc">Planner · Retrieval · Verification</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold text-base-content">What you can explore</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="card bg-base-200 shadow-sm">
                <div className="card-body">
                  <h3 className="card-title text-base-content">{feature.title}</h3>
                  <p className="text-sm text-base-content/80">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
