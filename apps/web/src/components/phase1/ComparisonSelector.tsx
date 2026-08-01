"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type ComparisonOption = { slug: string; name?: string; title?: string };

export function ComparisonSelector({ type, initial, options }: {
  type: string;
  initial: string[];
  options: ComparisonOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => initial.slice(0, 3));
  const [query, setQuery] = useState("");
  const available = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter((option) => !selected.includes(option.slug) &&
      (!needle || (option.name ?? option.title ?? option.slug).toLowerCase().includes(needle)));
  }, [options, query, selected]);
  const compare = () => {
    if (selected.length < 2) return;
    router.push(`/compare/${type}?items=${encodeURIComponent(selected.join(","))}`);
  };
  return <div className="comparison-selector">
    <label htmlFor={`compare-search-${type}`}>Search published {type}</label>
    <input id={`compare-search-${type}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${type}`} />
    <div className="comparison-options" role="list" aria-label={`Available ${type}`}>
      {available.slice(0, 8).map((option) => <button type="button" key={option.slug}
        disabled={selected.length >= 3}
        onClick={() => { setSelected((items) => [...items, option.slug]); setQuery(""); }}>
        Add {option.name ?? option.title ?? option.slug}
      </button>)}
    </div>
    <div className="comparison-selected" aria-label="Selected comparison items">
      {selected.map((slug) => {
        const option = options.find((item) => item.slug === slug);
        return <span key={slug}>{option?.name ?? option?.title ?? slug}<button type="button" aria-label={`Remove ${option?.name ?? option?.title ?? slug}`} onClick={() => setSelected((items) => items.filter((item) => item !== slug))}>×</button></span>;
      })}
    </div>
    <p role="status">{selected.length}/3 selected. Choose at least two.</p>
    <button className="button" type="button" disabled={selected.length < 2} onClick={compare}>Compare selected</button>
  </div>;
}
