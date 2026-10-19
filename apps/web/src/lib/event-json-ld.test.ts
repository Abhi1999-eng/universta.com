import { describe, expect, it } from 'vitest';
import { eventJsonLd } from './event-json-ld';

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
  state: { name: 'Tokyo Metropolis', slug: 'tokyo-metropolis' },
  country: { name: 'Japan', slug: 'japan', iso2Code: 'jp' },
  ...extra,
});

describe('eventJsonLd', () => {
  it('writes the description as plain text with its variables filled in (EV-C11, EV-M1)', () => {
    const json = eventJsonLd(event());
    expect(json.description).toMatch(/^Join us for Tokyo open evening on .+ at Shibuya Hall\.$/);
    expect(json.description).not.toMatch(/[<{]/);
    expect(json.eventStatus).toBe('https://schema.org/EventScheduled');
  });

  it('gives an in-person Place a PostalAddress (EV-M6)', () => {
    expect(eventJsonLd(event()).location).toEqual({
      '@type': 'Place',
      name: 'Shibuya Hall',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Shibuya Hall',
        addressLocality: 'Tokyo',
        addressRegion: 'Tokyo Metropolis',
        addressCountry: 'JP',
      },
    });
  });

  it('keeps the VirtualLocation for online and hybrid events', () => {
    const online = eventJsonLd(event({ eventType: 'ONLINE', venue: null, city: null, state: null, country: null, onlineUrl: 'https://meet.example.test/x' }));
    expect(online.location).toEqual({ '@type': 'VirtualLocation', url: 'https://meet.example.test/x' });
    expect(online.eventAttendanceMode).toBe('https://schema.org/OnlineEventAttendanceMode');
    const hybrid = eventJsonLd(event({ eventType: 'HYBRID', onlineUrl: 'https://meet.example.test/x' }));
    expect(Array.isArray(hybrid.location) && hybrid.location.map((place) => (place as { '@type': string })['@type'])).toEqual(['Place', 'VirtualLocation']);
  });

  it("uses the event's picture as an absolute image (EV-C5)", () => {
    const json = eventJsonLd(event({ featuredMedia: { id: 'm1', publicUrl: '/media/tokyo.jpg', altText: null, title: null } }));
    expect(json.image).toMatch(/^https?:\/\/[^/]+\/media\/tokyo\.jpg$/);
    expect(eventJsonLd(event()).image).toBeUndefined();
  });

  it('reads an older API that sends no state, country code or picture', () => {
    const json = eventJsonLd(event({ state: undefined, country: { name: 'Japan', slug: 'japan' }, featuredMedia: undefined }));
    expect((json.location as { address: Record<string, string> }).address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'Shibuya Hall',
      addressLocality: 'Tokyo',
      addressCountry: 'Japan',
    });
  });

  it('falls back to the summary when the description is empty', () => {
    expect(eventJsonLd(event({ description: '<p><br></p>' })).description).toBe('Meet the admissions team.');
  });
});
