/** Subject glyphs from the approved ZIP; uploaded catalogue icons take precedence. */
const paths: Record<string, string> = {
  "computer-science": "M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3M9 9h6v6H9z",
  "engineering": "M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  "business-management": "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6",
  "data-analytics": "M3 3v18h18M7 15l4-5 3 3 5-7",
  "medicine-health": "M12 5v14M5 12h14M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
  "natural-sciences": "M9 3h6M10 3v6l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3M7 15h10",
  "architecture-design": "M3 21h18M6 21V7l6-4 6 4v14M10 21v-5h4v5M9 11h.01M15 11h.01",
  "law": "M12 3v18M7 7h10M5 21h14M8 7l-4 7h8zM16 7l-4 7h8z",
  "economics": "M3 3v18h18M7 16l4-6 4 3 5-8",
  "social-sciences": "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  "media-communication": "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 9h8M8 13h5",
  "arts-humanities-social-sciences": "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  "computing-information-technology": "M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3M9 9h6v6H9z",
  "psychology-behavioural-sciences": "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
};

export function subjectIconPath(slug: string): string | undefined {
  return paths[slug];
}
