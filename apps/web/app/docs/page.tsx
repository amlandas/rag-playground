
import React from "react";
import { Metadata } from "next";
import DocsSidebar from "../../components/DocsSidebar";
import DocsCard from "../../components/DocsCard";
import Link from "next/link";

export const metadata: Metadata = {
    title: 'Scientia Laboratory Documentation | RAG Playground',
    description: 'Complete guide to using Scientia Laboratory for RAG experimentation. Learn modes, metrics, and workflows.',
};

export default function DocsPage() {
    return (
        <div className="min-h-screen bg-base-200">
            {/* Hero Section */}
            <div className="hero bg-base-100 py-16 border-b border-base-200">
                <div className="hero-content text-center max-w-4xl">
                    <div>
                        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                            Scientia Laboratory
                        </h1>
                        <p className="py-6 text-xl text-base-content/80">
                            An interactive playground for Retrieval-Augmented Generation (RAG).
                            Experiment with private data, compare models, and visualize retrieval metrics in real-time.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <Link href="/laboratory" className="btn btn-primary">Open Laboratory</Link>
                            <a href="#quick-start" className="btn btn-outline">Read Quick Start</a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                    {/* Main Content Column */}
                    <div className="lg:col-span-3">

                        {/* Quick Start Card */}
                        <DocsCard title="⚡ Quick Start" id="quick-start" badge="5 min read">
                            <p className="mb-4">Get up and running with your own documents in minutes.</p>
                            <ul className="steps steps-vertical lg:steps-horizontal w-full mb-8">
                                <li className="step step-primary">Sign In</li>
                                <li className="step step-primary">Upload Docs</li>
                                <li className="step">Build Index</li>
                                <li className="step">Ask Question</li>
                            </ul>

                            <div className="bg-base-200 p-4 rounded-lg">
                                <h4 className="font-bold mb-2">Detailed Steps:</h4>
                                <ol className="list-decimal list-inside space-y-2">
                                    <li><strong>Access:</strong> Navigate to the <code>/laboratory</code> page. Sign in if required.</li>
                                    <li><strong>Upload:</strong> Drag & drop your PDF/TXT/MD files into the upload zone (max 100MB/file).</li>
                                    <li><strong>Index:</strong> Click the <kbd className="kbd kbd-sm">Build index</kbd> button and wait for "Indexed: yes".</li>
                                    <li><strong>Query:</strong> Type your question (e.g., "What does the policy say about vacation?") and hit <strong>Run</strong>.</li>
                                </ol>
                            </div>
                        </DocsCard>

                        {/* RAG Modes Card */}
                        <DocsCard title="🧠 Understanding RAG Modes" id="rag-modes">
                            <p className="mb-6">Scientia offers three distinct modes depending on your research needs.</p>

                            <div className="overflow-x-auto">
                                <table className="table table-zebra border border-base-200">
                                    <thead>
                                        <tr>
                                            <th>Mode</th>
                                            <th>Best For</th>
                                            <th>Output</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="font-bold text-primary">Simple</td>
                                            <td>General Q&A, Summarization</td>
                                            <td>Single answer + Citations</td>
                                        </tr>
                                        <tr>
                                            <td className="font-bold text-secondary">A/B Compare</td>
                                            <td>Model evaluation, Prompt testing</td>
                                            <td>Two side-by-side answers</td>
                                        </tr>
                                        <tr>
                                            <td className="font-bold text-accent">Graph</td>
                                            <td>Multi-hop reasoning, Complex relationships</td>
                                            <td>Graph-traversed answer</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="alert alert-info mt-6 text-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <span><strong>Pro Tip:</strong> Use <em>Simple Mode</em> with "Doc + world context" if your questions require outside knowledge not found in your documents.</span>
                            </div>
                        </DocsCard>

                        {/* Document Management */}
                        <DocsCard title="📂 Document Management" id="documents">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-lg font-bold mb-2">Supported Formats</h3>
                                    <ul className="list-disc list-inside">
                                        <li>PDF (.pdf)</li>
                                        <li>Text (.txt)</li>
                                        <li>Markdown (.md)</li>
                                    </ul>
                                    <p className="text-sm mt-2 text-base-content/60">Max 20 files total.</p>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold mb-2">Privacy & Storage</h3>
                                    <ul className="list-disc list-inside">
                                        <li><strong>Ephemeral:</strong> Sessions auto-clear after 30 mins.</li>
                                        <li><strong>In-Memory:</strong> Data is not persisted to disk.</li>
                                        <li><strong>Private:</strong> Your index is isolated to your session ID.</li>
                                    </ul>
                                </div>
                            </div>
                        </DocsCard>

                        {/* Query Configuration */}
                        <DocsCard title="⚙️ Query Configuration" id="query-config">
                            <p className="mb-4">Fine-tune your retrieval pipeline using the controls panel.</p>
                            <div className="grid gap-4">
                                <div className="collapse collapse-arrow bg-base-200">
                                    <input type="radio" name="config-accordion" defaultChecked />
                                    <div className="collapse-title text-lg font-medium">Top-k Passages (Default: 4)</div>
                                    <div className="collapse-content">
                                        <p>Controls how many document chunks are retrieved for the LLM. Increase for complex questions, decrease for speed.</p>
                                    </div>
                                </div>
                                <div className="collapse collapse-arrow bg-base-200">
                                    <input type="radio" name="config-accordion" />
                                    <div className="collapse-title text-lg font-medium">Temperature (0.0 - 1.0)</div>
                                    <div className="collapse-content">
                                        <p>Controls randomness. <code>0.0</code> is deterministic/factual; <code>1.0</code> is creative. Recommended: <code>0.1</code> for RAG.</p>
                                    </div>
                                </div>
                                <div className="collapse collapse-arrow bg-base-200">
                                    <input type="radio" name="config-accordion" />
                                    <div className="collapse-title text-lg font-medium">Rerank Strategy</div>
                                    <div className="collapse-content">
                                        <p><strong>Cross-encoder:</strong> Slower but more accurate re-ordering.<br /><strong>LLM:</strong> Uses the model itself to pick the best chunks.</p>
                                    </div>
                                </div>
                                <div className="collapse collapse-arrow bg-base-200">
                                    <input type="radio" name="config-accordion" />
                                    <div className="collapse-title text-lg font-medium">Verification</div>
                                    <div className="collapse-content">
                                        <p>Decide how the answer is verified: <strong>Skip verification</strong>, <strong>RAG-V cross-check</strong> (default), or <strong>Fact-check LLM</strong>.</p>
                                    </div>
                                </div>
                            </div>
                        </DocsCard>

                        {/* Answer Display & Sources */}
                        <DocsCard title="📝 Answer Display & Sources" id="display-sources">
                            <p className="mb-4">When a query runs successfully, an Answer panel appears:</p>
                            <ul className="list-disc list-inside mb-4 space-y-2">
                                <li><strong>Simple Mode:</strong> Streams tokens and may show citations.</li>
                                <li><strong>A/B Mode:</strong> Shows two side-by-side answers labeled "A" and "B".</li>
                                <li><strong>Graph Mode:</strong> Labeled "Graph RAG answer", showing multi-hop traversal results.</li>
                            </ul>
                            <p className="mb-4">A <strong>Sources</strong> area lists the retrieved document chunks used to generate the answer, enabling users to review evidence.</p>
                        </DocsCard>

                        {/* Evaluation Metrics */}
                        <DocsCard title="📊 Evaluation & Metrics" id="evaluation">
                            <p className="mb-4">The system automatically assesses multiple quality dimensions and displays scores on a 0–10 scale:</p>

                            <div className="overflow-x-auto mb-6">
                                <table className="table table-zebra border border-base-200">
                                    <thead>
                                        <tr>
                                            <th>Metric</th>
                                            <th>What it measures</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="font-bold text-primary">Answer Relevance</td>
                                            <td>How well the answer addresses the question. A higher score means the answer stays on topic.</td>
                                        </tr>
                                        <tr>
                                            <td className="font-bold text-success">Faithfulness</td>
                                            <td>Whether the answer's statements are backed by the retrieved sources. A perfect 10 indicates no hallucinations.</td>
                                        </tr>
                                        <tr>
                                            <td className="font-bold text-secondary">Context Precision</td>
                                            <td>The proportion of the retrieved context that is actually used in the answer. Lower scores imply more irrelevant context.</td>
                                        </tr>
                                        <tr>
                                            <td className="font-bold">Context Recall</td>
                                            <td>How much of the relevant information from the sources has been used.</td>
                                        </tr>
                                        <tr>
                                            <td className="font-bold">Completeness</td>
                                            <td>Whether the answer covers all important aspects of the question.</td>
                                        </tr>
                                        <tr>
                                            <td className="font-bold text-accent">Conciseness</td>
                                            <td>Measures brevity—high scores indicate the answer isn't overly verbose.</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="grid gap-4">
                                <div className="card bg-base-200 p-4">
                                    <h4 className="font-bold mb-2">Diagnostics Tools</h4>
                                    <div className="flex flex-col gap-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" className="checkbox checkbox-sm" disabled checked />
                                            <span className="text-sm"><strong>Irrelevant Context Spans:</strong> Highlights unused context chunks. Use this to tune Top-k.</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" className="checkbox checkbox-sm" disabled checked />
                                            <span className="text-sm"><strong>Judge's Analysis:</strong> Reveals the automated judge's commentary and reasoning.</span>
                                        </label>
                                    </div>
                                    <div className="mt-4">
                                        <button className="btn btn-sm btn-outline">Re-run Judge</button>
                                        <span className="text-xs ml-2 text-base-content/60">Click to re-evaluate after parameter tweaks.</span>
                                    </div>
                                </div>
                            </div>
                        </DocsCard>

                        {/* Verification Summary */}
                        <DocsCard title="✅ Verification Summary" id="verification-summary">
                            <p className="mb-2">A Verification section summarizes whether the answer is supported by the retrieved context.</p>
                            <div className="stats shadow w-full">
                                <div className="stat">
                                    <div className="stat-title">Mode</div>
                                    <div className="stat-value text-lg">RAG-V</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-title">Coverage</div>
                                    <div className="stat-value text-lg text-success">100%</div>
                                    <div className="stat-desc">Claims backed by context</div>
                                </div>
                            </div>
                        </DocsCard>

                        {/* Diagnostics Trace */}
                        <DocsCard title="🔍 Diagnostics Trace" id="diagnostics-trace">
                            <p className="mb-4">Beneath the evaluation panel is a diagnostics section with a <strong>Show trace</strong> toggle.</p>
                            <div className="mockup-code text-sm">
                                <pre data-prefix=">"><code>Show trace expanded...</code></pre>
                                <pre data-prefix="1"><code>Full prompt text...</code></pre>
                                <pre data-prefix="2"><code>Generated answer...</code></pre>
                            </div>
                            <p className="text-sm mt-4 text-base-content/60">Useful for debugging prompt issues or understanding how the model formed the answer.</p>
                        </DocsCard>

                        {/* System Status */}
                        <DocsCard title="🖥️ System Monitoring" id="monitoring">
                            <h3 className="text-lg font-bold mb-2">Metrics Drawer</h3>
                            <p className="mb-4">Click <strong>Show metrics</strong> in the header to reveal session statistics: events, average latency, and query history.</p>

                            <h3 className="text-lg font-bold mb-2">API Status</h3>
                            <p>Check the <span className="badge badge-neutral">API Status</span> card at the bottom of the lab for connectivity health.</p>
                            <ul className="menu bg-base-200 rounded-box mt-2">
                                <li><span>🟢 <strong>API Reachable:</strong> Backend is online using In-memory storage.</span></li>
                                <li><span>🔴 <strong>SSE Error:</strong> Stream interrupted. Check session timeout (30 min).</span></li>
                                <li><span>🟡 <strong>Auth Needed:</strong> Refresh session if token expired.</span></li>
                            </ul>
                            <h3 className="text-lg font-bold mt-4 mb-2">Metrics Summary</h3>
                            <p className="text-sm text-base-content/80">Displays aggregate counts at the footer: Total sessions, Total indices, Queries by mode, and System version.</p>
                        </DocsCard>

                        {/* Workflows */}
                        <DocsCard title="🚀 Key User Workflows" id="workflows">
                            <div className="collapse collapse-plus border border-base-300 bg-base-100 rounded-box mb-2">
                                <input type="checkbox" />
                                <div className="collapse-title text-xl font-medium">Quick Start: Ask a question</div>
                                <div className="collapse-content">
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>Sign in and set theme.</li>
                                        <li>Upload documents (PDF/TXT/MD).</li>
                                        <li><strong>Click Build Index.</strong> Wait for "Indexed: yes".</li>
                                        <li>Enter question and click <strong>Run</strong> (Simple Mode).</li>
                                        <li>Review answer, citations, and evaluation metrics.</li>
                                    </ol>
                                </div>
                            </div>
                            <div className="collapse collapse-plus border border-base-300 bg-base-100 rounded-box mb-2">
                                <input type="checkbox" />
                                <div className="collapse-title text-xl font-medium">Comparing Models (A/B)</div>
                                <div className="collapse-content">
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>Select <strong>A/B</strong> tab.</li>
                                        <li>Adjust parameters (Top-k, Temperature) if desired.</li>
                                        <li>Click <strong>Run A/B</strong>.</li>
                                        <li>Compare side-by-side answers and metrics to decide the winner.</li>
                                    </ol>
                                </div>
                            </div>
                            <div className="collapse collapse-plus border border-base-300 bg-base-100 rounded-box mb-2">
                                <input type="checkbox" />
                                <div className="collapse-title text-xl font-medium">Multi-hop Answers (Graph)</div>
                                <div className="collapse-content">
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>Select <strong>Graph</strong> tab.</li>
                                        <li>Adjust <strong>Max graph hops</strong> (1-4).</li>
                                        <li>Click <strong>Run Graph RAG</strong>.</li>
                                        <li>Inspect the graph traversal path and answer.</li>
                                    </ol>
                                </div>
                            </div>
                        </DocsCard>

                        {/* Troubleshooting */}
                        <DocsCard title="🔧 Troubleshooting / FAQ" id="troubleshooting">
                            <div className="join join-vertical w-full">
                                <div className="collapse collapse-plus join-item border border-base-300">
                                    <input type="radio" name="faq" defaultChecked />
                                    <div className="collapse-title font-medium">Indexed = no after uploading files</div>
                                    <div className="collapse-content">
                                        <p>Click <strong>Build index</strong> to enable querying. Uploading alone does not index the files.</p>
                                    </div>
                                </div>
                                <div className="collapse collapse-plus join-item border border-base-300">
                                    <input type="radio" name="faq" />
                                    <div className="collapse-title font-medium">Comparing... never finishes (A/B mode)</div>
                                    <div className="collapse-content">
                                        <p>The underlying models may be busy. Try a simpler question or check system status.</p>
                                    </div>
                                </div>
                                <div className="collapse collapse-plus join-item border border-base-300">
                                    <input type="radio" name="faq" />
                                    <div className="collapse-title font-medium">Low Context Precision or Recall</div>
                                    <div className="collapse-content">
                                        <p>Try adjusting <strong>Top-k passages</strong> to retrieve more context, or refine your query wording.</p>
                                    </div>
                                </div>
                                <div className="collapse collapse-plus join-item border border-base-300">
                                    <input type="radio" name="faq" />
                                    <div className="collapse-title font-medium">Why does sign-in hang on Safari?</div>
                                    <div className="collapse-content">
                                        <p>Strict privacy features may block scripts. Please use Chrome or Firefox for the best experience.</p>
                                    </div>
                                </div>
                            </div>
                        </DocsCard>

                    </div>

                    {/* Right Sidebar Column */}
                    <div className="lg:col-span-1">
                        <DocsSidebar />
                    </div>

                </div>
            </div>
        </div>
    );
}
