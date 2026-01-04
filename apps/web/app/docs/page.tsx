
import React from "react";
import { Metadata } from "next";
import DocsSidebar from "../../components/DocsSidebar";
import DocsCard from "../../components/DocsCard";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Scientia Docs | RAG Playground",
    description: "Quickstart and workflow guides for using Scientia to make RAG observable.",
};

export default function DocsPage() {
    return (
        <div className="min-h-screen bg-base-200">
            <div className="hero bg-base-100 py-16 border-b border-base-200">
                <div className="hero-content text-center max-w-4xl">
                    <div>
                        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                            Scientia Docs
                        </h1>
                        <p className="py-6 text-xl text-base-content/80">
                            Scientia is designed for fast iteration. The goal is to get you to a grounded, explainable
                            state without requiring a giant framework.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <Link href="/laboratory" className="btn btn-primary">Open Laboratory</Link>
                            <a href="#quick-start" className="btn btn-outline">Read Quickstart</a>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-3">
                        <DocsCard title="⚡ Quickstart" id="quick-start" badge="5 min read">
                            <p className="mb-4">Start with sources you trust, then change one thing at a time.</p>
                            <div className="not-prose">
                                <ol className="steps steps-vertical lg:steps-horizontal w-full mb-6">
                                    <li className="step step-primary">Load documents</li>
                                    <li className="step step-primary">Ask a baseline question</li>
                                    <li className="step">Inspect context</li>
                                    <li className="step">Change one variable</li>
                                    <li className="step">Re-run and compare</li>
                                </ol>
                            </div>
                            <ol className="list-decimal list-inside space-y-2 text-base-content/80">
                                <li><strong>Load documents you trust.</strong> Start with sources where you recognize good retrieval.</li>
                                <li><strong>Ask a question with a known "good answer."</strong> You are establishing a baseline.</li>
                                <li><strong>Inspect the retrieved context.</strong> Look for wrong sections or shallow snippets.</li>
                                <li><strong>Change one variable.</strong> Chunk size, overlap, top-k, or rerank strategy.</li>
                                <li><strong>Re-run and compare.</strong> A/B turns "I think" into "here is the evidence."</li>
                            </ol>
                        </DocsCard>

                        <DocsCard title="🧭 Modes, when to use them" id="modes">
                            <p className="mb-6">Each mode serves a different part of the RAG loop.</p>
                            <div className="not-prose grid gap-4 md:grid-cols-3">
                                <div className="rounded-xl border border-base-200 bg-base-200/40 p-4">
                                    <h3 className="font-semibold text-base-content">Baseline mode</h3>
                                    <p className="mt-2 text-sm text-base-content/70">Quick feedback with minimal setup.</p>
                                    <p className="mt-3 text-xs text-base-content/60">Good for sanity checks, demos, and early exploration.</p>
                                </div>
                                <div className="rounded-xl border border-base-200 bg-base-200/40 p-4">
                                    <h3 className="font-semibold text-base-content">A/B testing</h3>
                                    <p className="mt-2 text-sm text-base-content/70">Isolate one change and compare outputs.</p>
                                    <p className="mt-3 text-xs text-base-content/60">If you are making a decision, use A/B.</p>
                                </div>
                                <div className="rounded-xl border border-base-200 bg-base-200/40 p-4">
                                    <h3 className="font-semibold text-base-content">Graph mode</h3>
                                    <p className="mt-2 text-sm text-base-content/70">Multi-part questions that need a chain of evidence.</p>
                                    <p className="mt-3 text-xs text-base-content/60">Useful for policy or "why/how/compare" prompts.</p>
                                </div>
                            </div>
                        </DocsCard>

                        <DocsCard title="✅ Evals: how to treat RAG like engineering" id="evals">
                            <p className="mb-4">
                                Evals turn "it seems better" into "we can trust this." Start small and stay consistent.
                            </p>
                            <ul className="list-disc list-inside space-y-2 text-base-content/80">
                                <li><strong>Source alignment:</strong> Did the answer cite the right part of the material?</li>
                                <li><strong>Claim support:</strong> Are the key claims supported by retrieved text?</li>
                                <li><strong>Hallucination check:</strong> Did the answer introduce details not in sources?</li>
                            </ul>
                            <div className="alert alert-info mt-6 text-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span>Small evals compound into reliable systems over time.</span>
                            </div>
                        </DocsCard>

                        <DocsCard title="🧩 Common failure modes" id="failure-modes">
                            <ul className="list-disc list-inside space-y-2 text-base-content/80">
                                <li><strong>Semantic drift:</strong> Retrieval returns vector-adjacent but irrelevant text.</li>
                                <li><strong>Bad chunking:</strong> Key concepts split across boundaries and lose meaning.</li>
                                <li><strong>The confidence trap:</strong> Strong models mask weak retrieval.</li>
                                <li><strong>Overfitting:</strong> A tweak helps one query and quietly breaks others.</li>
                                <li><strong>Mode mismatch:</strong> Multi-hop questions forced into a single-hop setup.</li>
                            </ul>
                        </DocsCard>

                        <DocsCard title="🔎 Reading traces without getting lost" id="traces">
                            <p className="mb-4">A good trace answers five questions:</p>
                            <ol className="list-decimal list-inside space-y-2 text-base-content/80">
                                <li>What was the question?</li>
                                <li>What did retrieval fetch?</li>
                                <li>What was promoted (and why)?</li>
                                <li>What was ignored?</li>
                                <li>What evidence supported the final answer?</li>
                            </ol>
                            <div className="not-prose mt-6">
                                <div className="mockup-code text-sm">
                                    <pre data-prefix=">"><code>Trace summary...</code></pre>
                                    <pre data-prefix="1"><code>Query: "What policy governs vacation carry-over?"</code></pre>
                                    <pre data-prefix="2"><code>Top retrieval: Handbook section 3.2</code></pre>
                                    <pre data-prefix="3"><code>Answer cites section 3.2 and 3.3</code></pre>
                                </div>
                            </div>
                            <p className="mt-4 text-sm text-base-content/60">
                                If your trace does not answer those questions, it is telemetry, not observability.
                            </p>
                        </DocsCard>

                        <DocsCard title="❓ FAQ" id="faq">
                            <div className="join join-vertical w-full">
                                <div className="collapse collapse-plus join-item border border-base-300">
                                    <input type="radio" name="faq" defaultChecked />
                                    <div className="collapse-title font-medium">Does Scientia guarantee correctness?</div>
                                    <div className="collapse-content">
                                        <p>No. It helps you verify and improve. The point is to make correctness auditable, not automatic.</p>
                                    </div>
                                </div>
                                <div className="collapse collapse-plus join-item border border-base-300">
                                    <input type="radio" name="faq" />
                                    <div className="collapse-title font-medium">Do I need a vector database to use this?</div>
                                    <div className="collapse-content">
                                        <p>Not to start. You can experiment quickly, then choose storage and indexing later.</p>
                                    </div>
                                </div>
                                <div className="collapse collapse-plus join-item border border-base-300">
                                    <input type="radio" name="faq" />
                                    <div className="collapse-title font-medium">What should I do if results feel unstable?</div>
                                    <div className="collapse-content">
                                        <p>Start smaller: fewer documents, clearer questions, and one variable change per iteration.</p>
                                    </div>
                                </div>
                            </div>
                        </DocsCard>
                    </div>

                    <div className="lg:col-span-1">
                        <DocsSidebar />
                    </div>
                </div>
            </div>
        </div>
    );
}
