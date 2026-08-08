import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import {
  SiteChromeFooter,
  SiteChromeHeader,
} from "@/components/chrome/SiteChrome";
import { jsonLdString } from "@/lib/json-ld";
import { siteOrigin } from "@/lib/site-origin";
import "./globals.css";
import "./visual-reference.css";
import "./global-chrome.css";
import "./public-ui-polish.css";
import "./public-ui-polish-fixes.css";

const siteUrl = siteOrigin;
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Universta",
  url: siteUrl,
  description: "Structured study destination guidance from Universta",
};

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Universta",
  description: "Structured study destination guidance from Universta",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* The one public Header/Footer for every route. Rendered here (server
            side) so navigation links are in the initial HTML, and so a single
            Admin change in Website Builder applies site-wide regardless of
            which page template the route uses. */}
        <SiteChromeHeader />
        {children}
        <SiteChromeFooter />
        <script type="application/ld+json">
          {jsonLdString(organizationJsonLd)}
        </script>
      </body>
    </html>
  );
}
