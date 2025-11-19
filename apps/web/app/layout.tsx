import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthProvider } from "../components/AuthProvider";
import SiteNavbar from "../components/SiteNavbar";
import { TourProvider } from "../components/TourProvider";
import TourOverlay from "../components/TourOverlay";

export const metadata: Metadata = {
  title: "RAG Playground",
  description: "Upload docs → configure retrieval → ask questions → see sources.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED?.toLowerCase() === "true";
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  return (
    <html lang="en" data-theme="light">
      <body className="min-h-screen bg-base-200 text-base-content antialiased" data-theme-ready="false">
        <AuthProvider enabled={googleAuthEnabled} clientId={googleClientId}>
          <TourProvider>
            <div className="flex min-h-screen flex-col">
              <SiteNavbar />
              <div className="flex flex-1 flex-col">{children}</div>
            </div>
            <TourOverlay />
          </TourProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
