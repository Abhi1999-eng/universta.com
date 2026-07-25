'use client';
/* API-selected media can come from approved external asset hosts; use a plain image to avoid an unbounded Next image allowlist. */
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Country } from '@/lib/countries';

type Continent = { id: string; name: string; slug: string; status: string };
function initialSearchState() {
  if (typeof window === 'undefined') return { query: '', region: 'all' };
  const params = new URLSearchParams(window.location.search);
  return { query: params.get('q') ?? '', region: params.get('region') ?? 'all' };
}

export function CountriesExplorer({ countries, continents }: { countries: Country[]; continents: Continent[] }) {
  const [initial] = useState(initialSearchState);
  const [query, setQuery] = useState(initial.query);
  const [submitted, setSubmitted] = useState(initial.query);
  const [region, setRegion] = useState(initial.region);
  const [suggestions, setSuggestions] = useState<Country[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/countries/suggestions?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((response) => response.json() as Promise<{ data?: Country[] }>)
        .then((body) => { setSuggestions(body.data ?? []); setActiveSuggestion(0); setOpen(true); })
        .catch(() => undefined);
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => { if (!searchRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick); return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const visible = useMemo(() => countries.filter((country) => {
    const matchesText = !submitted || `${country.name} ${country.slug}`.toLowerCase().includes(submitted.toLowerCase());
    return matchesText && (region === 'all' || country.continent.slug === region);
  }), [countries, region, submitted]);
  const groups = useMemo(() => {
    const map = new Map<string, Country[]>();
    [...countries].sort((a, b) => a.name.localeCompare(b.name)).forEach((country) => {
      const letter = country.name.slice(0, 1).toUpperCase();
      map.set(letter, [...(map.get(letter) ?? []), country]);
    });
    return [...map.entries()];
  }, [countries]);

  function syncUrl(nextQuery: string, nextRegion: string) {
    const params = new URLSearchParams(window.location.search);
    if (nextQuery) params.set('q', nextQuery); else params.delete('q');
    if (nextRegion !== 'all') params.set('region', nextRegion); else params.delete('region');
    window.history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`);
  }
  function commitSearch(value: string) { const next = value.trim(); setQuery(next); setSubmitted(next); syncUrl(next, region); setOpen(false); document.getElementById('country-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); commitSearch(event.currentTarget.querySelector<HTMLInputElement>('#country-search')?.value ?? ''); }
  function choose(item: Country) { setQuery(item.name); setSubmitted(item.name); setOpen(false); syncUrl(item.name, region); }
  function chooseRegion(next: string) { setRegion(next); syncUrl(submitted, next); }
  function keyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'Enter') { event.preventDefault(); if (open && suggestions[activeSuggestion]) choose(suggestions[activeSuggestion]); else commitSearch(query); return; }
    if (!open || !suggestions.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveSuggestion((value) => (value + 1) % suggestions.length); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveSuggestion((value) => (value - 1 + suggestions.length) % suggestions.length); }
  }

  return <>
    <section className="country-search-band" aria-labelledby="country-search-heading"><div className="shell"><div className="search-intro"><div><p className="eyebrow">Find your destination</p><h2 id="country-search-heading">Explore study destinations</h2></div><div className="platform-metrics" aria-label="Destination platform metrics"><Metric value={countries.length} label="destinations" /><Metric value={continents.length} label="regions" /><Metric value={countries.filter((country) => country.featured).length} label="featured" /></div></div><div className="search-row" ref={searchRef}><form onSubmit={submit} className="search-form"><label htmlFor="country-search">Search by country</label><div className="search-control"><input id="country-search" role="combobox" aria-label="Search by country" aria-expanded={open} aria-controls="country-suggestions" aria-activedescendant={open && suggestions[activeSuggestion] ? `suggestion-${suggestions[activeSuggestion].id}` : undefined} aria-autocomplete="list" value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value.trim()) setOpen(false); }} onKeyDown={keyDown} placeholder="Try Canada, France, or Australia" /><button type="submit">Search</button></div>{open && suggestions.length ? <ul id="country-suggestions" role="listbox" className="suggestions">{suggestions.map((item, index) => <li key={item.id} id={`suggestion-${item.id}`} role="option" aria-selected={index === activeSuggestion}><button type="button" onMouseEnter={() => setActiveSuggestion(index)} onClick={() => choose(item)}>{item.name}<span>{item.continent.name}</span></button></li>)}</ul> : null}</form><div className="quick-filters" aria-label="Quick filters"><button type="button" className={region === 'all' ? 'chip active' : 'chip'} onClick={() => chooseRegion('all')}>All destinations</button>{continents.map((continent) => <button type="button" className={region === continent.slug ? 'chip active' : 'chip'} key={continent.id} onClick={() => chooseRegion(continent.slug)}>{continent.name}</button>)}</div></div></div></section>
    <section id="country-results" className="shell results-section" aria-labelledby="country-results-heading"><div className="section-kicker"><p className="eyebrow">Browse by region</p><span className="result-count" role="status" aria-live="polite">{visible.length} {visible.length === 1 ? 'destination' : 'destinations'}</span></div><div className="results-heading"><div><h2 id="country-results-heading">{region === 'all' ? 'All destinations' : continents.find((item) => item.slug === region)?.name ?? 'Destinations'}</h2><p className="section-lede">Start with a country, then explore the verified profiles and editorial guidance available for that destination.</p></div></div>{visible.length ? <div className="country-grid">{visible.map((country) => <CountryCard key={country.id} country={country} />)}</div> : <div className="empty-state"><h3>No destinations found</h3><p>Try another country or clear the active filters.</p><button type="button" className="button secondary" onClick={() => { setSubmitted(''); setQuery(''); setRegion('all'); syncUrl('', 'all'); }}>Clear all</button></div>}</section>
    <section className="soft-band listing-cta"><div className="shell split-band"><div><p className="eyebrow">Need a starting point?</p><h2>Turn a destination into a plan.</h2><p className="section-lede">Use the country guide to compare what is actually published, then talk to a counsellor when you are ready.</p></div><Link className="button" href="#consultants">Explore guidance</Link></div></section>
    <section className="shell directory-section" aria-labelledby="directory-heading"><div className="section-kicker"><p className="eyebrow">A–Z directory</p><span className="result-count">{countries.length} listed</span></div><h2 id="directory-heading">Find a country by name</h2><div className="directory-grid">{groups.map(([letter, items]) => <div className="directory-group" key={letter}><h3>{letter}</h3>{items.map((country) => <Link key={country.id} href={`/countries/${country.slug}`}>{country.name}<span aria-hidden="true">→</span></Link>)}</div>)}</div></section>
    <section id="consultants" className="consultants listing-consultants"><div className="shell"><p className="eyebrow">Guidance when you need it</p><h2>Make your next decision with context.</h2><div className="consultant-grid"><article className="consultant-card"><h3>Compare destinations</h3><p>Use structured country information to narrow your shortlist.</p><Link href="#country-results">Browse countries →</Link></article><article className="consultant-card"><h3>Plan your questions</h3><p>Bring the details you need to verify with a trusted counsellor.</p><Link href="#country-search-heading">Start exploring →</Link></article></div></div></section>
    <section className="consultation-band"><div className="shell consultation-inner"><div><p className="eyebrow">Ready for a conversation?</p><h2>Get guidance for your shortlist.</h2><p>Country pages keep the next step clear and grounded in available information.</p></div><Link className="button light" href="#consultants">Explore guidance</Link></div></section>
  </>;
}
function Metric({ value, label }: { value: number; label: string }) { return <div><strong>{value}</strong><span>{label}</span></div>; }
function CountryCard({ country }: { country: Country }) { const profile = country.profiles; return <article className="country-card"><div className="card-top"><span className="country-flag">{country.flag ? <img src={country.flag.url} alt={country.flag.alt || `${country.name} flag`} /> : <span aria-hidden="true">◎</span>}</span><span className="country-region">{country.continent.name}</span></div><h3>{country.name}</h3><p>{country.shortDescription}</p><div className="card-facts">{profile?.statistics?.universitiesCount != null ? <span>{profile.statistics.universitiesCount} universities</span> : null}{profile?.cost?.tuitionMin ? <span>{profile.cost.currencySymbol ?? profile.cost.currencyCode} {profile.cost.tuitionMin}+ tuition</span> : null}{profile?.intakes?.length ? <span>{profile.intakes.map((item) => item.shortLabel ?? item.name).join(' · ')}</span> : null}</div><Link className="card-link" href={`/countries/${country.slug}`}>View country <span aria-hidden="true">→</span></Link></article>; }
