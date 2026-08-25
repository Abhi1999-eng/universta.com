import type { Metadata } from "next";
import { Inter } from "next/font/google";
import {
  SiteChromeFooter,
  SiteChromeHeader,
} from "@/components/chrome/SiteChrome";
import { StudentSessionProvider } from "@/components/student/StudentSession";
import { jsonLdString } from "@/lib/json-ld";
import { siteOrigin } from "@/lib/site-origin";
import { siteVerificationMetadata } from "@/lib/seo-management";
import "./globals.css";
import "./visual-reference.css";
import "./global-chrome.css";
import "./public-ui-polish.css";
import "./public-ui-polish-fixes.css";
import "./phase1-shared-template.css";
import "./reference-listing-fidelity.css";
import "./client-reference.css";
import "./public-typography.css";
import "./public-detail-system.css";

const siteUrl = siteOrigin;
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Universta",
  url: siteUrl,
  description: "Structured study destination guidance from Universta",
};

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Universta",
    description: "Structured study destination guidance from Universta",
    ...(await siteVerificationMetadata()),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <StudentSessionProvider>
          {/* The one public Header/Footer for every route. Rendered here (server
              side) so navigation links are in the initial HTML, and so a single
              Admin change in Website Builder applies site-wide regardless of
              which page template the route uses. */}
          <SiteChromeHeader />
          {/* The page's own content, as a landmark: the header and footer are
              site chrome, and a visitor skipping to the content needs somewhere
              for that to land. */}
          <main id="content" className="flex-1">
            {children}
          </main>
          <SiteChromeFooter />
        </StudentSessionProvider>
        <script type="application/ld+json">
          {jsonLdString(organizationJsonLd)}
        </script>
      </body>
    </html>
  );
}
