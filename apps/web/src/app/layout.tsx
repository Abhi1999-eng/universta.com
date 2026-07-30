import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { jsonLdString } from "@/lib/json-ld";
import "./globals.css";
import "./visual-reference.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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
        {children}
        <script type="application/ld+json">
          {jsonLdString(organizationJsonLd)}
        </script>
      </body>
    </html>
  );
}
