import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuthProvider } from "../components/AuthProvider";

export const metadata: Metadata = {
  title: "RAG Playground",
  description: "Upload docs → configure retrieval → ask questions → see sources.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED?.toLowerCase() === "true";
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  return (
    <html lang="en" data-theme="light">
      <body className="min-h-screen bg-base-100 text-base-content antialiased">
        <AuthProvider enabled={googleAuthEnabled} clientId={googleClientId}>
          <div className="flex min-h-screen flex-col">
            <nav className="navbar border-b border-base-200 bg-base-100 px-4">
              <div className="navbar-start">
                <Link href="/" className="text-xl font-semibold">
                  RAG Playground
                </Link>
              </div>
              <div className="navbar-center hidden gap-4 lg:flex">
                <Link href="/" className="btn btn-ghost btn-sm">
                  Home
                </Link>
                <Link href="/playground" className="btn btn-ghost btn-sm">
                  Playground
                </Link>
              </div>
              <div className="navbar-end flex items-center gap-2">
                <button type="button" className="btn btn-sm btn-outline">
                  Theme
                </button>
                <div className="dropdown dropdown-end lg:hidden">
                  <label tabIndex={0} className="btn btn-ghost btn-sm">
                    Menu
                  </label>
                  <ul tabIndex={0} className="menu dropdown-content mt-3 w-40 rounded-box bg-base-200 p-2 shadow">
                    <li>
                      <Link href="/">Home</Link>
                    </li>
                    <li>
                      <Link href="/playground">Playground</Link>
                    </li>
                  </ul>
                </div>
              </div>
            </nav>
            <main className="flex-1">{children}</main>
            <footer className="footer footer-center bg-base-200 p-6 text-sm text-base-content">
              <p>Built with FastAPI, Next.js, Tailwind, and DaisyUI.</p>
              <div className="flex gap-3">
                <a className="link link-hover" href="https://github.com/amlandas/rag-playground" target="_blank">
                  GitHub
                </a>
                <a className="link link-hover" href="/playground">
                  Playground
                </a>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
