"use client";

import { useSearchParams } from "next/navigation";

export function useSectionFocus<const T extends readonly string[]>(
  allowed: T,
): T[number] | null {
  const selected = useSearchParams().get("section");
  return selected && allowed.includes(selected as T[number])
    ? (selected as T[number])
    : null;
}
