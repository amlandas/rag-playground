
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
                                    <li><strong>Upload:</strong> Drag & drop your PDF/TXT/MD files into the upload zone (max 32MB/file).</li>
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
                            </div>
                        </DocsCard>

                        {/* Evaluation Metrics */}
                        <DocsCard title="📊 Evaluation & Metrics" id="evaluation">
                            <p className="mb-4">Scientia automatically grades every answer on a 0-10 scale.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="card bg-base-200 p-4">
                                    <h4 className="font-bold text-success">Faithfulness</h4>
                                    <p className="text-sm">Does the answer hallucinate? 10/10 means all claims are backed by sources.</p>
                                </div>
                                <div className="card bg-base-200 p-4">
                                    <h4 className="font-bold text-primary">Answer Relevance</h4>
                                    <p className="text-sm">Does it directly answer the user's question?</p>
                                </div>
                                <div className="card bg-base-200 p-4">
                                    <h4 className="font-bold text-secondary">Context Precision</h4>
                                    <p className="text-sm">How much of the retrieved text was actually useful?</p>
                                </div>
                                <div className="card bg-base-200 p-4">
                                    <h4 className="font-bold text-accent">Conciseness</h4>
                                    <p className="text-sm">Is the answer free of fluff?</p>
                                </div>
                            </div>
                            <div className="mt-4">
                                <p className="text-sm"><strong>Diagnostics:</strong> Use the <em>"Irrelevant Context Spans"</em> checkbox to see what the model ignored. Click <em>"Show trace"</em> to debug the raw prompt.</p>
                            </div>
                        </DocsCard>

                        {/* System Status */}
                        <DocsCard title="🖥️ System Monitoring" id="monitoring">
                            <p>Check the <span className="badge badge-neutral">API Status</span> card at the bottom of the lab for connectivity health.</p>
                            <ul className="menu bg-base-200 rounded-box mt-2">
                                <li><span>🟢 <strong>API Reachable:</strong> Backend is online.</span></li>
                                <li><span>🔴 <strong>SSE Error:</strong> Stream interrupted. Check session timeout.</span></li>
                                <li><span>🟡 <strong>Auth Needed:</strong> Refresh session if token expired.</span></li>
                            </ul>
                        </DocsCard>

                        {/* Troubleshooting */}
                        <DocsCard title="🔧 Troubleshooting / FAQ" id="troubleshooting">
                            <div className="join join-vertical w-full">
                                <div className="collapse collapse-plus join-item border border-base-300">
                                    <input type="radio" name="faq" defaultChecked />
                                    <div className="collapse-title font-medium">Why does sign-in hang on Safari?</div>
                                    <div className="collapse-content">
                                        <p>We restrict some Google Auth features for privacy. Please ensure strict tracking protection is not completely blocking scripts, or use Chrome/Firefox where support is robust.</p>
                                    </div>
                                </div>
                                <div className="collapse collapse-plus join-item border border-base-300">
                                    <input type="radio" name="faq" />
                                    <div className="collapse-title font-medium">Why is my index empty?</div>
                                    <div className="collapse-content">
                                        <p>Did you click <strong>Build Index</strong>? Uploading files doesn't automatically index them. Look for the "Indexed: yes" status.</p>
                                    </div>
                                </div>
                                <div className="collapse collapse-plus join-item border border-base-300">
                                    <input type="radio" name="faq" />
                                    <div className="collapse-title font-medium">Can I save my session?</div>
                                    <div className="collapse-content">
                                        <p>No. For security layout, sessions are ephemeral. Do not upload sensitive PII that you cannot risk losing when the tab closes.</p>
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
