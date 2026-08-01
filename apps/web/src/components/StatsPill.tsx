import type { ResolvedStatsPill } from "@/lib/stats-pill";

function StatsIcon({ name }: { name: ResolvedStatsPill["icon"]["name"] }) {
  if (name === "dot") return <span className="dot" aria-hidden="true" />;
  if (name === "globe")
    return (
      <svg
        aria-hidden="true"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
      </svg>
    );
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 5.5v16M8 7h8" />
    </svg>
  );
}

export function StatsPill({ pill }: { pill?: ResolvedStatsPill | null }) {
  if (!pill?.visible || !pill.items.length) return null;
  return (
    <span
      className={`${pill.variant === "badge" ? "hero-badge" : "hero-pill"} stats-pill`}
      data-item-count={pill.items.length}
    >
      {pill.icon.visible ? <StatsIcon name={pill.icon.name} /> : null}
      {pill.items.map((item, index) => (
        <span className="stats-pill-item" key={item.id}>
          {index ? (
            <span className="stats-pill-separator" aria-hidden="true">
              ·
            </span>
          ) : null}
          <b>{item.value.toLocaleString('en-US')}</b> <span>{item.label}</span>
        </span>
      ))}
    </span>
  );
}
