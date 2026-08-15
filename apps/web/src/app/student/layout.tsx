import type { Metadata } from 'next';
import './student.css';

export const metadata: Metadata = {
  title: 'Student portal | Universta',
  // A private area has nothing to offer a search engine.
  robots: { index: false, follow: false },
};

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
