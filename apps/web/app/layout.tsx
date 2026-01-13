import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthProvider } from "../components/AuthProvider";
import SiteNavbar from "../components/SiteNavbar";
import { TourProvider } from "../components/TourProvider";
import TourOverlay from "../components/TourOverlay";

export const metadata: Metadata = {
  title: "Scientia",
  description: "A research assistant that helps you ask better questions. Retrieves relevant context, supports A/B testing, and enables graph-based exploration.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED?.toLowerCase() === "true";
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-WNLJMWSG9W" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

gtag('config', 'G-WNLJMWSG9W');`,
          }}
        />
      </head>
      <body className="min-h-screen bg-base-200 text-base-content antialiased" data-theme-ready="false">
        <AuthProvider enabled={googleAuthEnabled} clientId={googleClientId}>
          <TourProvider>
            <div className="flex min-h-screen flex-col">
              <SiteNavbar />
              <div className="bg-warning text-warning-content text-center py-2 text-sm font-medium px-4">
                This application has been tested to work on Chrome and Firefox browsers only and may not work on other browsers as of now.
              </div>
              <div className="flex flex-1 flex-col">{children}</div>
            </div>
            <TourOverlay />
          </TourProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
