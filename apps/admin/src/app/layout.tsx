import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/features/auth/AuthProvider";
import "./globals.css";
/* The reference build's admin design system. Every rule in it is scoped under
 * `.pa`, so it costs the screens still on Tailwind nothing and applies only
 * where a workspace opts in. */
import "./portal.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Super Admin | Universta",
  description: "Secure Universta administration workspace",
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
      {/* The ported stylesheet is scoped under `.pa`, and several of its
          rules -- the app frame, the sign-in split -- target the element
          that carries the scope's own state. Putting the scope on the
          document, as the reference does, is what lets those match. */}
      <body className="pa min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
