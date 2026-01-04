import Link from "next/link";
import HealthBadge from "../components/HealthBadge";

const modes = [
  {
    title: "Baseline mode",
    body: "Fast, low-friction checks for 'is this grounded?' questions.",
  },
  {
    title: "A/B testing",
    body: "Change one variable and compare outputs side-by-side.",
  },
  {
    title: "Graph mode",
    body: "Trace multi-hop questions across related evidence.",
  },
];

const visibilitySignals = [
  "Retrieved context (and how it ranked)",
  "Rerank decisions (when applicable)",
  "Latency and retrieval signals",
  "Traces you can export and share",
  "Eval signals that keep evidence in focus",
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
                <h1 className="card-title text-4xl text-base-content">Scientia</h1>
                <p className="mt-2 text-lg font-semibold text-base-content">
                  Make retrieval-augmented generation (RAG) observable.
                </p>
                <p className="mt-3 text-base text-base-content/70">
                  If you have ever changed a <code>top_k</code> value, got a "better" answer, and could not explain why,
                  you have met the normal reality of RAG. These systems are not deterministic. Without visibility,
                  improvement turns into guessing, and guessing does not scale to real workloads.
                </p>
                <p className="text-base text-base-content/70">
                  Scientia turns that invisible loop into something you can inspect. It helps you see what was retrieved,
                  what was ignored, and what likely influenced the answer so progress becomes repeatable.
                </p>
              </div>
              <HealthBadge />
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/laboratory" className="btn btn-secondary">
                Open the laboratory
              </Link>
              <Link href="/docs" className="btn btn-link">
                Read the docs
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="card bg-base-100 shadow-md">
            <div className="card-body space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">The core value</p>
              <h2 className="card-title text-2xl text-base-content">Stop guessing. Start diagnosing.</h2>
              <p className="text-sm text-base-content/70">
                Scientia helps you improve RAG workflows by making the relationships visible: what you changed,
                what retrieval returned, and how the output responded.
              </p>
              <ul className="list-disc list-inside text-sm text-base-content/70 space-y-1">
                <li><strong>Compare</strong> configurations side-by-side.</li>
                <li><strong>Inspect</strong> grounding and evidence usage.</li>
                <li><strong>Build</strong> an eval habit based on evidence, not vibes.</li>
              </ul>
            </div>
          </article>
          <article className="card bg-base-100 shadow-md">
            <div className="card-body space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Try the loop (60 seconds)</p>
              <ol className="list-decimal list-inside text-sm text-base-content/70 space-y-2">
                <li><strong>Load</strong> a small set of documents you know well.</li>
                <li><strong>Ask</strong> a question that tends to cause weak retrieval or confident wrongness.</li>
                <li><strong>Run A/B</strong> with one change, then inspect the retrieved context and trace.</li>
              </ol>
              <p className="text-sm text-base-content/60">
                If one change improves one query but breaks another, that is still progress. You learned something real.
              </p>
            </div>
          </article>
        </section>

        <section className="card bg-base-100 shadow-md">
          <div className="card-body space-y-4">
            <h2 className="card-title text-2xl text-base-content">Modes</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {modes.map((mode) => (
                <article key={mode.title} className="rounded-xl border border-base-200 bg-base-200/40 p-4">
                  <h3 className="font-semibold text-base-content">{mode.title}</h3>
                  <p className="mt-2 text-sm text-base-content/70">{mode.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="card bg-base-100 shadow-md">
          <div className="card-body space-y-4">
            <h2 className="card-title text-2xl text-base-content">What you can see (without opening a notebook)</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {visibilitySignals.map((signal) => (
                <div key={signal} className="flex items-start gap-3 rounded-lg border border-base-200 bg-base-200/40 p-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary"></span>
                  <p className="text-sm text-base-content/70">{signal}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-base-content/60">
              Evals are not about perfection. They are about consistency so your system gets more reliable over time.
            </p>
          </div>
        </section>

        <section id="docs" className="card bg-base-100 shadow-lg">
          <div className="card-body space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="card-title text-xl text-base-content">Links</h2>
                <p className="text-sm text-base-content/70">
                  Dive deeper or jump to the about section.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/docs" className="btn btn-primary btn-sm">Docs</Link>
                <Link href="/#about" className="btn btn-outline btn-sm">About</Link>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="card bg-base-100 shadow-lg">
          <div className="card-body space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">About</p>
              <h2 className="card-title text-2xl text-base-content">The RAG loop</h2>
            </div>
            <p className="text-sm text-base-content/70">
              RAG work is often treated as a linear task: load documents, ask a question, ship a feature. In practice,
              it is a loop:
            </p>
            <p className="text-sm font-semibold text-base-content">Ask - Retrieve - Synthesize - Evaluate - Adjust</p>
            <p className="text-sm text-base-content/70">
              The loop is where quality comes from. When that loop is invisible, teams move slowly, repeat the same
              mistakes, and ship brittle experiences. When the loop is visible, you can actually engineer the outcome.
            </p>
            <p className="text-sm text-base-content/70">
              Scientia exists to keep that loop visible without forcing you to live inside notebooks or build custom
              dashboards for every experiment.
            </p>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-base-content">What "observable" means here</h3>
              <p className="text-sm text-base-content/70">
                Observable does not mean "more metrics." It means you can answer basic questions quickly:
              </p>
              <ul className="list-disc list-inside text-sm text-base-content/70 space-y-1">
                <li>What evidence did retrieval return?</li>
                <li>Was the evidence relevant, or just vector-adjacent?</li>
                <li>Did the answer actually use that evidence?</li>
                <li>What changed between config A and config B?</li>
                <li>Are we getting better in a way that generalizes?</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-base-content">A note on world context</h3>
              <p className="text-sm text-base-content/70">
                Some questions need more than your uploaded artifacts. A good system should distinguish between:
              </p>
              <ul className="list-disc list-inside text-sm text-base-content/70 space-y-1">
                <li><strong>Document-grounded answers</strong> backed by your content.</li>
                <li><strong>Blended answers</strong> that mix your content with world knowledge.</li>
              </ul>
              <p className="text-sm text-base-content/70">
                Scientia makes that distinction explicit so you do not treat "sounds plausible" as "supported by evidence."
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-base-content">How to use Scientia without boiling the ocean</h3>
              <p className="text-sm text-base-content/70">
                If you only remember one habit, make it this: <strong>change one thing at a time.</strong>
                A/B testing is less glamorous than "try five new settings," but it is how you build a system you can trust.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-base-200 bg-base-200/40 p-4">
                <h3 className="text-lg font-semibold text-base-content">It is</h3>
                <ul className="mt-2 list-disc list-inside text-sm text-base-content/70 space-y-1">
                  <li>A knowledge explorer for RAG workflows.</li>
                  <li>A way to compare retrieval strategies and parameters.</li>
                  <li>A place to build a repeatable evaluation habit.</li>
                </ul>
              </div>
              <div className="rounded-xl border border-base-200 bg-base-200/40 p-4">
                <h3 className="text-lg font-semibold text-base-content">It is not</h3>
                <ul className="mt-2 list-disc list-inside text-sm text-base-content/70 space-y-1">
                  <li>A turnkey production RAG stack.</li>
                  <li>A promise that RAG becomes deterministic.</li>
                  <li>A replacement for good source material and good questions.</li>
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-base-200 bg-base-200/40 p-4">
              <p className="text-sm text-base-content/70">
                Scientia is built to make the "why did it answer that?" question easier to answer, especially in reviews
                where "it seems better" is not good enough.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
