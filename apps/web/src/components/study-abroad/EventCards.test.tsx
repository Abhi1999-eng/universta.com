// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EventCard, eventPlace, moreEvents, nextEvent, NextEventCard } from './EventCards';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const now = Date.parse('2026-10-19T12:00:00Z');
const guides = new Set(['japan']);

const event = (extra: Record<string, unknown> = {}) => ({
  id: 'e1',
  slug: 'tokyo-open-evening',
  title: 'Tokyo open evening',
  summary: 'Meet the admissions team.',
  description: '<p>Join us for {eventTitle} on {eventDate} at {eventVenue}.</p>',
  startsAt: '2026-11-20T09:00:00.000Z',
  endsAt: '2026-11-20T10:30:00.000Z',
  timezone: 'Asia/Tokyo',
  eventType: 'OFFLINE',
  venue: 'Shibuya Hall',
  city: { name: 'Tokyo', slug: 'tokyo' },
  country: { name: 'Japan', slug: 'japan', iso2Code: 'JP' },
  registrationUrl: 'https://register.example.test/tokyo',
  ...extra,
});

describe('EventCard (EV-U3-web)', () => {
  it('is an article whose title link covers the card, with Register as a link of its own', () => {
    const doc = parse(renderToStaticMarkup(<EventCard row={event()} guides={guides} now={now} />));
    const card = doc.querySelector('article.schcard.eventcard');
    expect(card).not.toBeNull();
    expect(card?.querySelector('h3 a.eventcard__link')?.getAttribute('href')).toBe('/events/tokyo-open-evening');
    expect(card?.querySelector('a.eventcard__register')?.getAttribute('href')).toBe('https://register.example.test/tokyo');
    /* No link inside another link. */
    expect(doc.querySelectorAll('a a')).toHaveLength(0);
    expect(card?.querySelector('.fundbadge')?.textContent).toBe('In person');
    expect(card?.querySelector('.badge')?.textContent).toBe('Upcoming');
  });

  it("lists the date, the time in the event's zone, the format and the place with its country chip (EV-C8-web)", () => {
    const doc = parse(renderToStaticMarkup(<EventCard row={event()} guides={guides} now={now} />));
    const facts = Object.fromEntries([...doc.querySelectorAll('.schcard__facts > div')].map((cell) => [cell.querySelector('dt')?.textContent, cell.querySelector('dd')]));
    expect(facts.Date?.textContent).toBe('20 Nov 2026');
    expect(facts.Time?.textContent).toBe('6:00 pm JST');
    expect(facts.Format?.textContent).toBe('In person');
    expect(facts.Where?.textContent).toBe('Shibuya Hall, TokyoJPJapan');
    expect(facts.Where?.querySelector('a.flagchip')?.getAttribute('href')).toBe('/study-abroad/japan');
  });

  it('links the country only where its guide is published', () => {
    const doc = parse(renderToStaticMarkup(<EventCard row={event()} guides={new Set()} now={now} />));
    expect(doc.querySelector('a.flagchip')).toBeNull();
    expect(doc.querySelector('span.flagchip')?.textContent).toBe('JPJapan');
  });

  it('drops Register and says Ended once the event is over', () => {
    const doc = parse(renderToStaticMarkup(<EventCard row={event()} now={Date.parse('2026-11-21T00:00:00Z')} />));
    expect(doc.querySelector('.eventcard__register')).toBeNull();
    expect(doc.querySelector('.badge')?.textContent).toBe('Ended');
  });

  it('draws the event picture as its thumbnail (EV-C5-web)', () => {
    const doc = parse(
      renderToStaticMarkup(<EventCard row={event({ featuredMedia: { id: 'm', publicUrl: '/media/hall.jpg', altText: 'The hall', title: null } })} now={now} />),
    );
    const img = doc.querySelector('.eventcard__media img');
    expect(img?.getAttribute('src')).toBe('/media/hall.jpg');
    expect(img?.getAttribute('alt')).toBe('The hall');
  });

  it('never fails on a mistyped zone (EV-C3)', () => {
    expect(() => renderToStaticMarkup(<EventCard row={event({ timezone: 'Tokyo' })} now={now} />)).not.toThrow();
  });
});

describe('eventPlace', () => {
  it('says each place once and keeps the country for its chip', () => {
    expect(eventPlace(event({ venue: 'Tokyo', state: { name: 'tokyo' } }))).toMatchObject({ text: 'Tokyo', place: 'Tokyo' });
    expect(eventPlace(event({ venue: null, city: null, country: null, eventType: 'ONLINE' }))).toEqual({ text: 'Online', place: null, country: null });
  });
});

describe('the next event and more events', () => {
  const rows = [
    event({ id: 'past', slug: 'past', startsAt: '2026-10-01T09:00:00Z', endsAt: '2026-10-01T10:00:00Z' }),
    event({ id: 'live', slug: 'live', eventType: 'ONLINE', country: null, startsAt: '2026-10-19T11:00:00Z', endsAt: '2026-10-19T13:00:00Z' }),
    event({ id: 'soon', slug: 'soon', eventType: 'ONLINE', country: null, startsAt: '2026-10-25T09:00:00Z', endsAt: null }),
    event({ id: 'later', slug: 'later', startsAt: '2026-12-01T09:00:00Z', endsAt: null }),
  ];

  it('picks the first event not yet over for the /events hero (EV-U8)', () => {
    expect(nextEvent(rows, now)?.id).toBe('live');
    expect(nextEvent([rows[0]], now)).toBeNull();
    const doc = parse(renderToStaticMarkup(<NextEventCard row={rows[3]} guides={guides} now={now} />));
    expect(doc.querySelector('.nextevent__date')?.textContent).toBe('1Dec2026');
    expect(doc.querySelector('.nextevent__t a')?.getAttribute('href')).toBe('/events/later');
    expect([...doc.querySelectorAll('.btn')].map((link) => link.textContent?.trim())).toEqual(['View event →', 'Register ↗']);
  });

  it('suggests upcoming events in the same format or country first, never this one or a past one (EV-U6)', () => {
    expect(moreEvents(rows[3], rows, now).map((row) => row.id)).toEqual(['live', 'soon']);
    const online = moreEvents(event({ id: 'x', slug: 'x', eventType: 'ONLINE', country: null }), [...rows].reverse(), now, 2);
    expect(online.map((row) => row.id)).toEqual(['live', 'soon']);
    const japan = moreEvents(event({ id: 'y', slug: 'y', eventType: 'HYBRID' }), rows, now, 3);
    expect(japan.map((row) => row.id)).toEqual(['later', 'live', 'soon']);
  });
});
