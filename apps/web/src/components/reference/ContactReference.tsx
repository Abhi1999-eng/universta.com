'use client';

import { useState } from 'react';
import Link from 'next/link';
import { contactPayload } from '@/lib/contact-payload';

/** The client-approved Contact page.
 *
 * The template's contact cards ship placeholder values ("+1 XXX XXX XXXX",
 * "Office address · City, Country") and a Live Chat tile that only fires a
 * toast. Universta has no live-chat product, so that tile is gone, and each
 * remaining card renders only if Settings actually holds that detail.
 *
 * The form posts to the real contact-enquiry endpoint. The template's "I am
 * a…", country and preferred-destination fields are not part of that
 * endpoint's payload, so they are omitted rather than collected and dropped on
 * the floor. */

export type ContactReferenceProps = {
  email: string | null;
  phone: string | null;
  address: string | null;
  whatsappLink: string | null;
};

export function ContactReference(props: ContactReferenceProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch('/api/contact-inquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(contactPayload(new FormData(form))),
      });
      if (!response.ok) throw new Error('failed');
      form.reset();
      setStatus({
        ok: true,
        message: 'Message sent — thank you. The right team will get back to you.',
      });
    } catch {
      setStatus({
        ok: false,
        message: 'That did not send. Please try again, or email us directly.',
      });
    } finally {
      setBusy(false);
    }
  }

  const cards = [
    props.email && {
      h: 'Email',
      sub: 'General support',
      main: (
        <a href={`mailto:${props.email}`}>{props.email}</a>
      ),
    },
    props.phone && { h: 'Phone', sub: 'During business hours', main: props.phone },
    props.address && { h: 'Office', sub: null, main: props.address },
    props.whatsappLink && {
      h: 'WhatsApp',
      sub: 'Message us directly',
      main: (
        <a href={props.whatsappLink} target="_blank" rel="noreferrer noopener">
          Open WhatsApp
        </a>
      ),
    },
  ].filter(Boolean) as Array<{ h: string; sub: string | null; main: React.ReactNode }>;

  return (
    <div className="cref">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> ›{' '}
          <Link href="/contact" aria-current="page">
            Contact
          </Link>
        </nav>
      </div>

      <section className="wrap about-hero">
        <div>
          <h1>We’re here to help</h1>
          <p className="lede">
            Whether you are a student planning to study abroad, a university looking to publish
            programmes, or a consultant interested in joining the directory, send us a message and
            the right team will pick it up.
          </p>
          <div className="hero-cta">
            <a href="#contact-form" className="btn btn-primary btn-lg">
              Send us a message
            </a>
            <Link href="/counselling" className="btn btn-outline btn-lg">
              Book free counselling
            </Link>
          </div>
        </div>
        <div className="about-illo" aria-hidden="true">
          <svg viewBox="0 0 460 360" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="60" y="60" width="260" height="150" rx="24" fill="#2563eb" />
            <rect x="92" y="100" width="150" height="14" rx="7" fill="#fff" opacity=".9" />
            <rect x="92" y="128" width="110" height="14" rx="7" fill="#fff" opacity=".55" />
            <rect x="92" y="156" width="80" height="14" rx="7" fill="#fff" opacity=".35" />
            <rect x="180" y="196" width="200" height="110" rx="22" fill="#fff" stroke="#dce7ff" strokeWidth="2" />
            <rect x="206" y="228" width="120" height="12" rx="6" fill="#dce7ff" />
            <rect x="206" y="252" width="86" height="12" rx="6" fill="#eff4ff" />
            <circle cx="380" cy="120" r="26" fill="#eff4ff" stroke="#dce7ff" strokeWidth="2" />
          </svg>
        </div>
      </section>

      {cards.length ? (
        <section className="wrap" style={{ paddingBottom: 44 }}>
          <div className="cc-grid">
            {cards.map((card) => (
              <div className="cc-card" key={card.h}>
                <h3>{card.h}</h3>
                <div className="cc-main">{card.main}</div>
                {card.sub ? <div className="cc-sub">{card.sub}</div> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <main className="wrap">
        <section className="sec" id="contact-form" style={{ paddingTop: 8 }}>
          <div className="sec-head">
            <span className="eyebrow">Get in touch</span>
            <h2>Send us a message</h2>
            <p>Fill in the form and the right team will get back to you.</p>
          </div>

          <div className="form-wrap">
            <div className="form-card">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit(event.currentTarget);
                }}
              >
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="fullName">Full name</label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="email">Email address</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@email.com"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="phoneNumber">
                      Phone number <span className="opt-tag">optional</span>
                    </label>
                    <input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+00 00000 00000"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="subject">
                      Subject <span className="opt-tag">optional</span>
                    </label>
                    <input id="subject" name="subject" type="text" placeholder="How can we help?" />
                  </div>
                  <div className="field full">
                    <label htmlFor="message">Message</label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={5}
                      placeholder="Tell us a bit more about what you need…"
                    />
                  </div>
                </div>

                <label className="honeypot" aria-hidden="true">
                  Company website
                  <input name="companyWebsite" tabIndex={-1} autoComplete="off" />
                </label>

                <label
                  style={{ display: 'flex', gap: 10, marginTop: 16, fontSize: 14 }}
                  htmlFor="privacyConsent"
                >
                  <input
                    id="privacyConsent"
                    name="privacyConsent"
                    type="checkbox"
                    value="true"
                    required
                  />
                  I agree that Universta may use this enquiry to respond.
                </label>

                <div className="form-actions">
                  <button className="btn btn-primary btn-lg" disabled={busy} type="submit">
                    {busy ? 'Sending…' : 'Send message'}
                  </button>
                  <Link href="/counselling" className="btn btn-ghost btn-lg">
                    Book free counselling
                  </Link>
                </div>

                {status ? (
                  <p className={`form-status ${status.ok ? 'ok' : 'err'}`} role="status">
                    {status.message}
                  </p>
                ) : null}
              </form>
            </div>

            <aside>
              <div className="aside-card">
                <h3>Choosing the right team</h3>
                <p>Students and parents — admissions and course guidance.</p>
                <p>Universities — publishing programmes and profiles.</p>
                <p>Consultants — joining the published directory.</p>
              </div>
              <div className="aside-card dark">
                <h3>Prefer to talk it through?</h3>
                <p>Book a free counselling conversation — no obligation.</p>
                <Link href="/counselling" className="btn btn-w btn-sm btn-block">
                  Book free counselling
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <section className="sec wrap">
        <div className="final-cta">
          <h2>Ready to take the next step?</h2>
          <p>Browse destinations and courses while you wait for a reply.</p>
          <div className="hero-ctas">
            <Link href="/countries" className="btn btn-secondary btn-lg">
              Browse destinations
            </Link>
            <Link href="/courses" className="btn btn-outline btn-lg">
              Browse courses
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
