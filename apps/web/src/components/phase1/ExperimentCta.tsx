"use client";

import Link from "next/link";

/**
 * Records a CTA_CLICK conversion for the section's experiment before/while
 * navigating. Fired with keepalive so the request survives the navigation
 * unmount; never awaited so the click never feels delayed.
 */
function recordClick(experimentKey: string) {
  try {
    void fetch("/api/experiments/conversions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ experimentKey, kind: "CTA_CLICK" }),
      keepalive: true,
    });
  } catch {
    // Conversion tracking must never block or break navigation.
  }
}

export function ExperimentCta({
  href,
  experimentKey,
  className,
  children,
}: {
  href: string;
  experimentKey?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      className={className}
      href={href}
      onClick={experimentKey ? () => recordClick(experimentKey) : undefined}
    >
      {children}
    </Link>
  );
}
